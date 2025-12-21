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

/**
 * ONLY core reference data that is shared across all users.
 * Sensitive data (users/roles) is fetched fresh via Auth/Firestore.
 */
const REFERENCE_COLLECTIONS = [
  "counties",
  "areas",
  "precincts",
  "organizations",
] as const;

/**
 * ID Generator based on your specified nomenclature
 */
const generateNomenclatureId = (coll: string, data: any): string => {
  const state = "PA";
  const county = data.county_code || "00";

  switch (coll) {
    case "counties":
      return `${state}-C-${data.code}`;
    case "areas":
      return `${state}${county}-A-${data.area_district}`;
    case "precincts":
      return `${state}${county}-P-${data.precinct_code}`;
    case "organizations":
      // Uses org_id if available, otherwise falls back to code
      const orgId = data.org_id || data.code;
      return `${state}${county}-O-${orgId}`;
    default:
      return data.id || "auto";
  }
};

/**
 * dualPathSync: Loads data from local constants during development
 * to bypass App Check and Firestore 429 rate limits on localhost.
 */
// src/services/referenceDataSync.ts

const dualPathSync = async (force: boolean) => {
  const isDev = process.env.NODE_ENV === "development";

  // 🚀 DEBUG LOGS TO CLEAR THE CONFUSION
  console.log(
    "🔍 [Sync Debug] Exported Names from referenceData:",
    Object.keys(LocalData)
  );
  console.log(
    "🔍 [Sync Debug] Is LOCAL_COUNTIES defined?",
    !!LocalData.LOCAL_COUNTIES
  );
  console.log(
    "🔍 [Sync Debug] IndexedDB Tables known to Dexie:",
    indexedDb.tables.map((t) => t.name)
  );

  if (isDev && !force) {
    console.log("💾 [Sync] DEV MODE: Mapping local reference constants...");

    await Promise.all(
      REFERENCE_COLLECTIONS.map((coll) => indexedDb.table(coll).clear())
    );

    // 1. Map and Load Counties
    await indexedDb.counties.bulkPut(
      (LocalData.LOCAL_COUNTIES || []).map((c) => ({
        ...c,
        id: generateNomenclatureId("counties", c),
      }))
    );

    // 2. Map and Load AREAS
    await indexedDb.areas.bulkPut(
      ((LocalData.LOCAL_AREAS as any[]) || []).map((a) => ({
        // Use explicit field mapping to ensure the interface is satisfied
        id: generateNomenclatureId("areas", a),
        org_id: a.org_id,
        area_district: a.area_district,
        name: a.name || "Unknown Area", // Fallback for the missing 'name' property
        active: a.active ?? true, // Fallback for missing 'active'
        created_at: a.created_at || Date.now(),
        last_updated: a.last_updated || Date.now(),
        chair_uid: a.chair_uid ?? null,
        vice_chair_uid: a.vice_chair_uid ?? null,
        chair_email: a.chair_email ?? null,
      }))
    );

    // 3. Map and Load Precincts
    await indexedDb.precincts.bulkPut(
      (LocalData.LOCAL_PRECINCTS || []).map((p) => ({
        ...p,
        id: generateNomenclatureId("precincts", p),
      }))
    );

    // 4. Map and Load Organizations
    await indexedDb.organizations.bulkPut(
      (LocalData.LOCAL_ORGANIZATIONS || []).map((o) => ({
        ...o,
        id: generateNomenclatureId("organizations", o),
        vice_chair_uid: o.vice_chair_uid ?? null,
        president_uid: o.president_uid ?? null,
      }))
    );

    // ... rest of metadata update
    return true;
  }
  return false;
};

export const syncReferenceData = async (force = false): Promise<boolean> => {
  // Check Dev Path first
  const usedLocalPath = await dualPathSync(force);
  if (usedLocalPath) return true;

  // PRODUCTION PATH: Sync from Firestore
  console.log(
    "🛠️ [Sync] PRODUCTION MODE: Starting handshake with Firestore..."
  );
  try {
    const metadataRef = doc(firestoreDb, "metadata", "app_control");

    // Fetch metadata to check version
    const metadataSnap = (await Promise.race([
      getDoc(metadataRef),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Firestore handshake timeout (10s)")),
          10000
        );
      }),
    ])) as DocumentSnapshot;

    if (!metadataSnap.exists()) {
      console.error("❌ [Sync] FAILED: metadata/app_control doc not found.");
      return true;
    }

    const { current_version: serverVersion, last_updated: serverUpdated } =
      metadataSnap.data() as any;
    const localMeta = await indexedDb.app_metadata.get("app_control");

    // Only proceed if version mismatch or forced
    if (!force && localMeta?.current_version === serverVersion) {
      console.log(`✅ [Sync] App is up to date: ${serverVersion}`);
      return true;
    }

    console.log(
      `📡 [Sync] Version Mismatch: Local(${
        localMeta?.current_version || "none"
      }) -> Server(${serverVersion})`
    );

    // Clear and reload
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
            const standardizedId = generateNomenclatureId(coll, docData);

            // Standard data integrity filters
            if (
              coll === "precincts" &&
              (!docData.county_code || !docData.precinct_code)
            )
              return null;
            if (coll === "areas" && (!docData.org_id || !docData.area_district))
              return null;

            return { ...docData, id: standardizedId };
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
    return true; // Return true to unlock the app loading gate
  }
};
