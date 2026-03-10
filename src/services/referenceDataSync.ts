import { db, ensureDBInitialized, updateAppControlAfterSync } from "../lib/db";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  counties as localCounties,
  areas as localAreas,
  precincts as localPrecincts,
  groups as localGroups,
} from "../constants/referenceData";
import { UserProfile, Precinct, Area, Group, County } from "../types";

/**
 * Production Sync Strategy (Cloud-First):
 * 1. Fetch unified payload (Profile + Permissions + Filtered Collections).
 * 2. Sanitize all IDs (trim and mirror ID to UID).
 * 3. Atomic Dexie Transaction (Prevents partial data states).
 * 4. Offline Fallback: Uses local referenceData if network is unreachable.
 */
export async function syncReferenceData(currentUid: string): Promise<void> {
  console.log("🟢 [Sync] Initializing for UID:", currentUid);

  if (!currentUid?.trim()) {
    console.error("🔴 [Sync] Aborting: No valid UID provided");
    return;
  }

  try {
    // 1. Prepare Local Environment
    await ensureDBInitialized();
    await db.app_control.update("app_control", { sync_status: "syncing" });

    const functions = getFunctions(undefined, "us-central1");
    const fetchSyncData = httpsCallable(functions, "getSyncCollections");

    // Initialize temporary sources with local constants (the fallback)
    let sourcePrecincts: any[] = localPrecincts;
    let sourceAreas: any[] = localAreas;
    let sourceCounties: any[] = localCounties;
    let sourceGroups: any[] = localGroups;
    let profileData: UserProfile | null = null;
    let isCloudSource = false;

    try {
      // 2. ATTEMPT CLOUD FETCH
      console.log("📡 [Sync] Calling getSyncCollections...");
      const result = await fetchSyncData();
      const data = result.data as any;

      if (data.success) {
        sourcePrecincts = data.precincts;
        sourceAreas = data.areas;
        sourceCounties = data.counties;
        sourceGroups = data.groups;
        profileData = data.profile; // Contains cloud-calculated permissions
        isCloudSource = true;
        console.log("✅ [Sync] Live data and permissions retrieved.");
      } else if (data.reason === "no_profile") {
        console.warn(
          "⚠️ [Sync] User has no database profile. Syncing base data only.",
        );
      }
    } catch (cloudErr) {
      console.warn(
        "⚠️ [Sync] Network/Cloud error. Reverting to Offline Fallback.",
        cloudErr,
      );
    }

    // 3. RESOLVE PROFILE (Required for filtering fallback data)
    if (!profileData) {
      // Pull last known profile (with permissions) from IndexedDB
      profileData = (await db.users.get(currentUid)) as UserProfile;

      if (!profileData) {
        throw new Error(
          "Critical Sync Failure: No local or cloud profile available.",
        );
      }
      console.log("💾 [Sync] Using cached profile for fallback filtering.");
    }

    // 4. APPLY FALLBACK FILTERS (Only if Cloud failed)
    let finalCounties: County[];
    let finalAreas: Area[];
    let finalPrecincts: Precinct[];

    if (isCloudSource) {
      // Cloud has already filtered these for us!
      finalCounties = sourceCounties;
      finalAreas = sourceAreas;
      finalPrecincts = sourcePrecincts;
    } else {
      console.log(
        "🛠️ [Sync] Applying security filters to local fallback data...",
      );
      const { role: userRole, access } = profileData;
      const hasAll = (arr: string[] | undefined) =>
        arr?.includes("ALL") || false;

      const hasAllCounties = hasAll(access.counties);
      const hasAllAreas = hasAll(access.areas);

      finalCounties = sourceCounties.filter(
        (c) => hasAllCounties || access.counties?.includes(c.id),
      );
      finalAreas = sourceAreas.filter(
        (a) => hasAllAreas || access.areas?.includes(a.id),
      );

      if (userRole === "developer") {
        finalPrecincts = sourcePrecincts;
      } else {
        const allowedAreaIds = new Set(finalAreas.map((a) => a.id));
        finalPrecincts = sourcePrecincts.filter(
          (p) => hasAllAreas || allowedAreaIds.has(p.area_id),
        );
      }
    }

    // 5. SANITIZATION HELPER
    const sanitize = (items: any[]) =>
      items.map((item) => ({
        ...item,
        id: String(item.id).trim(),
        uid: String(item.id).trim(), // doc.id = id = uid
        active: item.active ?? true,
        last_updated: item.last_updated || Date.now(),
      }));

    // 6. ATOMIC WRITE TO INDEXEDDB
    await db.transaction(
      "rw",
      [db.counties, db.areas, db.precincts, db.groups, db.users],
      async () => {
        // Clear all relevant tables for a clean sync state
        await Promise.all([
          db.counties.clear(),
          db.areas.clear(),
          db.precincts.clear(),
          db.groups.clear(),
          db.users.clear(),
        ]);

        if (finalCounties.length > 0)
          await db.counties.bulkPut(sanitize(finalCounties));
        if (finalAreas.length > 0) await db.areas.bulkPut(sanitize(finalAreas));
        if (finalPrecincts.length > 0)
          await db.precincts.bulkPut(sanitize(finalPrecincts));
        if (sourceGroups.length > 0)
          await db.groups.bulkPut(sanitize(sourceGroups));

        // Save the full profile (including those crucial .permissions)
        await db.users.put(profileData!);
      },
    );

    // 7. Success Finalization
    await updateAppControlAfterSync();
    console.log(
      "🏁 [Sync] Success. Permissions and reference data are now in-sync.",
    );
  } catch (err: any) {
    console.error("🔴 [Sync] Fatal Error:", err.message);
    await db.app_control.update("app_control", {
      sync_status: "error",
      last_sync_attempt: Date.now(),
    });
    throw err;
  }
}
