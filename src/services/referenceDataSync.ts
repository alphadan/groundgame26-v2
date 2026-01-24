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
 * Production Sync Strategy:
 * 1. Wildcard Handling: Supports "ALL" string in access arrays for Developers/Admins.
 * 2. ID Consistency: Matches composite string IDs (e.g., PA15-A-28).
 * 3. Atomic Dexie Transactions: Ensures IndexedDB is never in a partial state.
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

    // --- HELPER: Wildcard Check ---
    const hasAll = (arr: string[] | undefined) => arr?.includes("ALL") || false;

    // 3. Filter Counties
    console.log("🛠️ [Sync Debug] Starting Filter Phase");
    console.log(
      "🛠️ [Sync Debug] Full Access Object:",
      JSON.stringify(access, null, 2),
    );

    const hasAllCounties = hasAll(access.counties);
    const hasAllAreas = hasAll(access.areas);

    // COUNTY LOGGING
    const filteredCounties = allCounties.filter(
      (c) => hasAllCounties || access.counties.includes(c.id),
    );
    console.log(
      `🛠️ [Sync Debug] Counties: Found ${allCounties.length} in refData, Matched ${filteredCounties.length} via access.`,
    );

    // 4. Filter Areas

    console.log("DEBUG: access.areas is:", access.areas);
    console.log("DEBUG: hasAll(access.areas) is:", hasAll(access.areas));

    // AREA LOGGING
    const filteredAreas = allAreas.filter((a) => {
      const isMatch = hasAllAreas || access.areas.includes(a.id);
      // Optional: log why a specific area failed if you expected it to pass
      if (a.id === "PA15-A-28" && !isMatch) {
        console.warn(
          "⚠️ [Sync Debug] Area PA15-A-28 exists in refData but access.areas does not include it and hasAll is false.",
        );
      }
      return isMatch;
    });
    console.log(
      `🛠️ [Sync Debug] Areas: Found ${allAreas.length} in refData, Matched ${filteredAreas.length} via access.`,
    );

    console.log(`DEBUG: Filtered Areas Count: ${filteredAreas.length}`);

    // 5. Strategic Precinct Filtering
    // PRECINCT LOGGING
    let filteredPrecincts: Precinct[] = [];
    if (userRole === "developer") {
      console.log(
        "🛠️ [Sync Debug] User is Developer: Bypassing Precinct filters.",
      );
      filteredPrecincts = allPrecincts;
    } else {
      filteredPrecincts = allPrecincts.filter(
        (p) => hasAllAreas || access.areas.includes(p.area_id),
      );
    }

    console.log(
      `📊 [Sync] Results: ${filteredCounties.length} counties, ${filteredAreas.length} areas, ${filteredPrecincts.length} precincts matched.`,
    );

    // 6. Atomic Write to IndexedDB (Dexie Transaction)
    // We wrap everything in a transaction so if one write fails, none are committed.
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

        // Bulk put filtered data if available
        if (filteredCounties.length > 0)
          await db.counties.bulkPut(filteredCounties);
        if (filteredAreas.length > 0) await db.areas.bulkPut(filteredAreas);
        if (filteredPrecincts.length > 0)
          await db.precincts.bulkPut(filteredPrecincts);

        // Groups/Teams are typically global within a campaign
        if (allGroups.length > 0) await db.groups.bulkPut(allGroups);

        // Store the full profile for offline permission checks and UI display
        await db.users.put(profileData);
      },
    );

    // 7. Finalize sync metadata
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
