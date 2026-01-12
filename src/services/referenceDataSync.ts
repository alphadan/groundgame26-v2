import { db, ensureDBInitialized, updateAppControlAfterSync } from "../lib/db";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  counties as allCounties,
  areas as allAreas,
  precincts as allPrecincts,
  groups as allGroups,
} from "../constants/referenceData";
import { UserProfile, Precinct } from "../types";

/**
 * Strategy:
 * 1. Fetch the computed profile (role, permissions, and access IDs) from Cloud Function.
 * 2. Filter local constants based on the returned access ID arrays.
 * 3. Perform an atomic write to IndexedDB to ensure data consistency.
 */
export async function syncReferenceData(currentUid: string): Promise<void> {
  console.log("🟢 [Sync] Entering syncReferenceData for UID:", currentUid);

  if (!currentUid?.trim()) {
    console.error("🔴 [Sync] Aborting: No valid UID provided");
    return;
  }

  try {
    // 1. Initialize local database
    await ensureDBInitialized();
    await db.app_control.update("app_control", { sync_status: "syncing" });

    // 2. Fetch User Profile via v2 Cloud Function
    const functions = getFunctions(undefined, "us-central1");
    const fetchProfile = httpsCallable(functions, "getUserProfile");

    const result = await fetchProfile();
    const profileData = (result.data as any)?.profile as UserProfile;

    if (!profileData) {
      throw new Error("Server returned no profile data for this user.");
    }

    const { role: userRole, access } = profileData;
    console.log("🟢 [Sync] Profile received. Primary Role:", userRole);

    // 3. Filter using standardized IDs from the Cloud Function
    // We match against the 'id' field in our constants
    const filteredCounties = allCounties.filter((c) =>
      access.counties.includes(c.id)
    );

    const filteredAreas = allAreas.filter((a) => access.areas.includes(a.id));

    // 4. Strategic Precinct Filtering
    let filteredPrecincts: Precinct[] = [];

    if (userRole === "committeeperson") {
      // Committeepersons: Strictly assigned precincts only
      filteredPrecincts = allPrecincts.filter((p) =>
        access.precincts.includes(p.id)
      );
    } else {
      // Admins/Chairs/Devs: Get all precincts belonging to their allowed areas
      filteredPrecincts = allPrecincts.filter((p) =>
        access.areas.includes(p.area_id)
      );
    }

    console.log(
      `📊 [Sync] Results: ${filteredCounties.length} counties, ${filteredAreas.length} areas, ${filteredPrecincts.length} precincts matched.`
    );

    // 5. Atomic Write to IndexedDB (Dexie Transaction)
    await db.transaction(
      "rw",
      [db.counties, db.areas, db.precincts, db.groups, db.users],
      async () => {
        // Clear old data for a clean state
        await Promise.all([
          db.counties.clear(),
          db.areas.clear(),
          db.precincts.clear(),
          db.groups.clear(),
          db.users.clear(),
        ]);

        // Bulk put filtered data
        if (filteredCounties.length > 0)
          await db.counties.bulkPut(filteredCounties);
        if (filteredAreas.length > 0) await db.areas.bulkPut(filteredAreas);
        if (filteredPrecincts.length > 0)
          await db.precincts.bulkPut(filteredPrecincts);

        // Groups are global for now, but we use the filtered county_id to narrow if needed
        await db.groups.bulkPut(allGroups);

        // Store the full profile for offline permission checks
        await db.users.put(profileData);
      }
    );

    // 6. Finalize sync metadata
    await updateAppControlAfterSync();
    console.log("✅ [Sync] Successfully populated IndexedDB.");
  } catch (err: any) {
    console.error("❌ [Sync] Fatal error during sync:", err.message);

    await db.app_control.update("app_control", {
      sync_status: "error",
      last_sync_attempt: Date.now(),
    });

    throw err;
  }
}
