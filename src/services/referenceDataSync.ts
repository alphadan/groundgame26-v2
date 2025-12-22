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
import { UserProfile } from "../types";

/**
 * ONLY core reference data that is shared across all users.
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
  switch (coll) {
    case "counties":
    case "areas":
    case "precincts":
    case "organizations":
      return `${data.id}`;
    default:
      return data.id || "auto";
  }
};

/**
 * dualPathSync: Loads data from local constants during development.
 * Now incorporates a mock UserProfile for local testing.
 */
const dualPathSync = async (force: boolean, currentUid?: string) => {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev && !force) {
    console.log("💾 [Sync] DEV MODE: Mapping local reference constants...");

    // Clear reference tables but NOT users (unless forced)
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
        id: generateNomenclatureId("areas", a),
        org_id: a.org_id,
        area_district: a.area_district,
        name: a.name || "Unknown Area",
        active: a.active ?? true,
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

    // 5. MOCK USER PROFILE (DEV ONLY)
    if (currentUid) {
      const mockProfile: UserProfile = {
        uid: currentUid,
        display_name: "Daniel Keane",
        email: "info@alphabetsigns.com",
        role: "state_admin",
        org_id: "PA15-O-1",
        photo_url: null,
        preferred_name: "Dan",
        phone: "+16108066875",
      };
      await indexedDb.users.put(mockProfile);
      console.log("👤 [Sync] DEV MODE: Mock user profile created.");
    }

    return true;
  }
  return false;
};

/**
 * syncReferenceData: Main entry point.
 * currentUid is passed in to ensure the profile is synced alongside reference data.
 */
export const syncReferenceData = async (
  force = false,
  currentUid?: string
): Promise<boolean> => {
  // Check Dev Path first
  const usedLocalPath = await dualPathSync(force, currentUid);
  if (usedLocalPath) return true;

  console.log("🛠️ [Sync] PRODUCTION MODE: Handshaking with Firestore...");
  try {
    const metadataRef = doc(firestoreDb, "metadata", "app_control");
    const metadataSnap = await getDoc(metadataRef);

    if (!metadataSnap.exists()) {
      console.error("❌ [Sync] FAILED: metadata/app_control doc not found.");
      return true;
    }

    const { current_version: serverVersion, last_updated: serverUpdated } =
      metadataSnap.data() as any;
    const localMeta = await indexedDb.app_metadata.get("app_control");

    // Check version - if forced or outdated, sync reference data
    if (force || localMeta?.current_version !== serverVersion) {
      await Promise.all(
        REFERENCE_COLLECTIONS.map((coll) => indexedDb.table(coll).clear())
      );

      for (const coll of REFERENCE_COLLECTIONS) {
        const snapshot = await getDocs(collection(firestoreDb, coll));
        const data = snapshot.docs
          .map((d) => ({
            ...d.data(),
            id: generateNomenclatureId(coll, d.data()),
          }))
          .filter((item) => item !== null);

        if (data.length > 0) await indexedDb.table(coll).bulkPut(data);
      }

      await indexedDb.app_metadata.put({
        key: "app_control",
        current_version: serverVersion,
        last_updated: serverUpdated,
      });
    }

    // PRODUCTION USER PROFILE SYNC
    if (currentUid) {
      const userRef = doc(firestoreDb, "users", currentUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const profile = { ...userSnap.data(), uid: currentUid } as UserProfile;
        await indexedDb.users.put(profile);
        console.log("👤 [Sync] User profile synced from Firestore.");
      }
    }

    return true;
  } catch (globalErr) {
    console.error("❌ [Sync] CRITICAL GLOBAL ERROR:", globalErr);
    return true;
  }
};
