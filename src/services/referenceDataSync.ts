import { db, ensureDBInitialized, updateAppControlAfterSync } from "../lib/db";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  counties as localCounties,
  areas as localAreas,
  precincts as localPrecincts,
  groups as localGroups,
} from "../constants/referenceData";
import {
  UserProfile,
  Precinct,
  Area,
  Group,
  County,
  State_Rep_District,
} from "../types";

/**
 * Production Sync Strategy:
 * 1. Fetch unified payload from Cloud Function 'getSyncCollections'.
 * 2. Handle State Rep Districts tier.
 * 3. Atomic Dexie Transaction to ensure data integrity.
 * 4. Comprehensive logging to debug "NotFoundError" and schema mismatches.
 */
export async function syncReferenceData(currentUid: string): Promise<void> {
  console.log("🟢 [Sync] Start for UID:", currentUid);

  if (!currentUid?.trim()) {
    console.error("🔴 [Sync] Aborting: No valid UID provided");
    return;
  }

  try {
    // 1. Prepare Local Environment
    await ensureDBInitialized(true);
    await db.app_control.update("app_control", { sync_status: "syncing" });

    const functions = getFunctions(undefined, "us-central1");
    const fetchSyncData = httpsCallable(functions, "getSyncCollections");

    // Initialize local sources for fallback
    let sourcePrecincts: any[] = localPrecincts;
    let sourceAreas: any[] = localAreas;
    let sourceCounties: any[] = localCounties;
    let sourceGroups: any[] = localGroups;
    let sourceDistricts: any[] = [];
    let profileData: UserProfile | null = null;
    let isCloudSource = false;

    try {
      // 2. CLOUD FETCH
      console.log("📡 [Sync] Calling getSyncCollections...");
      const result = await fetchSyncData();
      const data = result.data as any;

      if (data.success) {
        sourcePrecincts = data.precincts || [];
        sourceAreas = data.areas || [];
        sourceCounties = data.counties || [];
        sourceGroups = data.groups || [];
        sourceDistricts = data.districts || []; // Capture from Cloud
        profileData = data.profile;
        isCloudSource = true;
        console.log(
          `✅ [Sync] Cloud Data Retrieved: ${sourceDistricts.length} Districts, ${sourceAreas.length} Areas`,
        );
      } else {
        console.warn(
          "⚠️ [Sync] Cloud returned success:false. Reason:",
          data.reason,
        );
      }
    } catch (cloudErr) {
      console.error(
        "⚠️ [Sync] Network/Cloud Error. Falling back to local data.",
        cloudErr,
      );
    }

    // 3. RESOLVE PROFILE
    if (!profileData) {
      profileData = (await db.users.get(currentUid)) as UserProfile;
      if (!profileData)
        throw new Error(
          "Critical Sync Failure: No local or cloud profile available.",
        );
      console.log("💾 [Sync] Using cached profile from IndexedDB.");
    }

    // 4. PREPARE FINAL COLLECTIONS
    let finalCounties = sourceCounties;
    let finalDistricts = sourceDistricts;
    let finalAreas = sourceAreas;
    let finalPrecincts = sourcePrecincts;

    if (!isCloudSource) {
      console.log("🛠️ [Sync] Manually filtering fallback data...");
      const { access } = profileData;
      const hasAll = (arr: string[] | undefined) =>
        arr?.includes("ALL") || false;

      finalCounties = sourceCounties.filter(
        (c) => hasAll(access.counties) || access.counties?.includes(c.id),
      );
      finalDistricts = sourceDistricts.filter(
        (d) => hasAll(access.districts) || access.districts?.includes(d.id),
      );
      finalAreas = sourceAreas.filter(
        (a) => hasAll(access.areas) || access.areas?.includes(a.id),
      );
      finalPrecincts = sourcePrecincts.filter(
        (p) => hasAll(access.precincts) || access.areas?.includes(p.area_id),
      );
    }

    // 5. SANITIZATION HELPER
    const sanitize = (items: any[]) =>
      items.map((item) => ({
        ...item,
        id: String(item.id || item.uid).trim(),
        uid: String(item.id || item.uid).trim(),
        active: item.active ?? true,
        last_updated: item.last_updated || Date.now(),
      }));

    // 6. ATOMIC TRANSACTION
    // This is where the 'objectStore not found' error is usually triggered.
    console.log(
      "🧬 [Sync] Starting Transaction. Checking Dexie Table Availability...",
    );

    // Debug: Check if tables are correctly defined in Dexie instance
    const requiredTables = [
      { name: "counties", table: db.counties },
      { name: "state_rep_districts", table: db.state_rep_districts },
      { name: "areas", table: db.areas },
      { name: "precincts", table: db.precincts },
      { name: "groups", table: db.groups },
      { name: "users", table: db.users },
    ];

    requiredTables.forEach((t) => {
      if (!t.table)
        console.error(
          `❌ [Sync] ERROR: Table '${t.name}' is UNDEFINED in db.ts!`,
        );
      else console.log(`   - Table '${t.name}' is registered.`);
    });

    await db.transaction(
      "rw",
      [
        db.counties,
        db.state_rep_districts,
        db.areas,
        db.precincts,
        db.groups,
        db.users,
      ],
      async () => {
        console.log(
          "🧹 [Sync] Transaction Active: Clearing existing local data...",
        );

        await Promise.all([
          db.counties.clear(),
          db.state_rep_districts.clear(),
          db.areas.clear(),
          db.precincts.clear(),
          db.groups.clear(),
          db.users.clear(),
        ]);

        console.log("📥 [Sync] Writing sanitized data to IndexedDB...");

        if (finalCounties.length > 0)
          await db.counties.bulkPut(sanitize(finalCounties));
        if (finalDistricts.length > 0)
          await db.state_rep_districts.bulkPut(sanitize(finalDistricts));
        if (finalAreas.length > 0) await db.areas.bulkPut(sanitize(finalAreas));
        if (finalPrecincts.length > 0)
          await db.precincts.bulkPut(sanitize(finalPrecincts));
        if (sourceGroups.length > 0)
          await db.groups.bulkPut(sanitize(sourceGroups));

        await db.users.put(profileData!);
      },
    );

    // 7. FINALIZATION
    await updateAppControlAfterSync();
    console.log("🏁 [Sync] SUCCESS. Local database is fully hydrated.");
  } catch (err: any) {
    console.error("🔴 [Sync] FATAL ERROR:", err.name, err.message);

    await db.app_control.update("app_control", {
      sync_status: "error",
      last_sync_attempt: Date.now(),
    });

    throw err;
  }
}
