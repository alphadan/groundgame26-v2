// src/services/referenceDataSync.ts
import { db as firestoreDb } from "../lib/firebase";
import { db as indexedDb } from "../lib/db";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  DocumentSnapshot,
} from "firebase/firestore";

// Import your local constants for development
import * as LocalData from "../constants/referenceData";

const REFERENCE_COLLECTIONS = [
  "counties",
  "areas",
  "precincts",
  "organizations",
] as const;

/**
 * dualPathFetch: Helper to decide whether to use Local Constants or Firestore
 */
const dualPathSync = async (force: boolean) => {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev && !force) {
    console.log(
      "💾 [Sync] DEVELOPMENT MODE: Loading reference data from local constants..."
    );

    // Clear existing tables to ensure a clean local state
    await Promise.all(
      REFERENCE_COLLECTIONS.map((coll) => indexedDb.table(coll).clear())
    );

    // Map local data to their respective IndexedDB tables
    await indexedDb.counties.bulkPut(LocalData.LOCAL_COUNTIES || []);
    await indexedDb.areas.bulkPut(LocalData.LOCAL_AREAS || []);
    await indexedDb.precincts.bulkPut(LocalData.LOCAL_PRECINCTS || []);
    await indexedDb.organizations.bulkPut(LocalData.LOCAL_ORGANIZATIONS || []);

    // Update local metadata so the app knows it is in a "DEV" sync state
    await indexedDb.app_metadata.put({
      key: "app_control",
      current_version: "0.1.0-dev-local",
      last_updated: Date.now(),
    });

    console.log("🏁 [Sync] Local dev sync complete via constants.");
    return true;
  }
  return false; // Continue to Production Firestore sync
};

export const syncReferenceData = async (force = false): Promise<boolean> => {
  // 1. Check if we should use the Local Path (Dev Mode)
  const usedLocalPath = await dualPathSync(force);
  if (usedLocalPath) return true;

  // 2. PRODUCTION PATH: Real-time Cloud Firestore Sync
  console.log(
    "🛠️ [Sync] PRODUCTION MODE: Starting handshake with Firestore..."
  );
  try {
    const metadataRef = doc(firestoreDb, "metadata", "app_control");

    console.log("[DEBUG] Attempting to fetch metadata/app_control...");
    const metadataSnap = (await Promise.race([
      getDoc(metadataRef),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Firestore metadata fetch timeout (10s)"));
        }, 10000);
      }),
    ])) as DocumentSnapshot;

    if (!metadataSnap.exists()) {
      console.error("❌ [Sync] FAILED: metadata/app_control doc not found.");
      return true;
    }

    const serverData = metadataSnap.data();
    const serverVersion = serverData?.current_version || "0.0.0";
    const serverUpdated = serverData?.last_updated || 0;

    const localMeta = await indexedDb.app_metadata.get("app_control");
    const localVersion = localMeta?.current_version || "0.0.0";

    // Skip download if versions match
    if (!force && localVersion === serverVersion) {
      console.log(`✅ [Sync] App is up to date: ${localVersion}`);
      return true;
    }

    console.log(
      `📡 [Sync] Version Mismatch: Local(${localVersion}) -> Server(${serverVersion})`
    );

    // Clear and re-fill tables from Firestore
    await Promise.all(
      REFERENCE_COLLECTIONS.map((coll) => indexedDb.table(coll).clear())
    );

    for (const coll of REFERENCE_COLLECTIONS) {
      try {
        console.log(`📥 [Sync] Fetching ${coll}...`);
        const snapshot = await getDocs(collection(firestoreDb, coll));

        const data = snapshot.docs
          .map((d) => {
            const docData = d.data();
            const standardizedDoc = { id: d.id, ...docData };

            // Apply standard data integrity filters
            if (
              coll === "precincts" &&
              (!docData.county_code || !docData.precinct_code)
            )
              return null;
            if (coll === "areas" && (!docData.org_id || !docData.area_district))
              return null;
            return standardizedDoc;
          })
          .filter((item) => item !== null);

        if (data.length > 0) {
          await indexedDb.table(coll).bulkPut(data);
          console.log(`✔️ [Sync] Saved ${data.length} records to ${coll}`);
        }
      } catch (err) {
        console.error(`❌ [Sync] Failed to sync ${coll}:`, err);
      }
    }

    // Save final production metadata
    await indexedDb.app_metadata.put({
      key: "app_control",
      current_version: serverVersion,
      last_updated: serverUpdated,
    });

    console.log("🏁 [Sync] Reference data sync complete via Firestore.");
    return true;
  } catch (globalErr) {
    console.error("❌ [Sync] CRITICAL GLOBAL ERROR:", globalErr);
    return true; // Always return true to release App.tsx loading gate
  }
};
