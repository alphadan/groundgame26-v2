import { db, ensureDBInitialized, updateAppControlAfterSync } from "../lib/db";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore"; // Added for Keystone fetch
import { db as firestore } from "../lib/firebase"; // Added for Keystone fetch
import {
  counties as localCounties,
  areas as localAreas,
  precincts as localPrecincts,
  groups as localGroups,
} from "../constants/referenceData";
import { UserProfile, AppControl } from "../types";

export async function syncReferenceData(currentUid: string): Promise<void> {
  console.log("🟢 [Sync] Start for UID:", currentUid);

  if (!currentUid?.trim()) {
    console.error("🔴 [Sync] Aborting: No valid UID provided");
    return;
  }

  try {
    // 1. Fetch the Keystone (Source of Truth) BEFORE syncing data
    // This ensures we stamp the DB with the EXACT version the cloud currently requires.
    const keystoneRef = doc(firestore, "config", "app_control");
    const keystoneSnap = await getDoc(keystoneRef);
    const keystoneData = keystoneSnap.exists()
      ? (keystoneSnap.data() as AppControl)
      : null;

    if (!keystoneData) {
      console.warn(
        "⚠️ [Sync] Could not find Keystone doc. Syncing with default governance.",
      );
    }

    // 2. Prepare Local Environment
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
      // 3. CLOUD FETCH
      console.log("📡 [Sync] Calling getSyncCollections...");
      const result = await fetchSyncData();
      const data = result.data as any;

      if (data.success) {
        sourcePrecincts = data.precincts || [];
        sourceAreas = data.areas || [];
        sourceCounties = data.counties || [];
        sourceGroups = data.groups || [];
        sourceDistricts = data.districts || [];
        profileData = data.profile;
        isCloudSource = true;
        console.log(`✅ [Sync] Cloud Data Retrieved.`);
      }
    } catch (cloudErr) {
      console.error(
        "⚠️ [Sync] Cloud Error. Falling back to local data.",
        cloudErr,
      );
    }

    // 4. RESOLVE PROFILE
    if (!profileData) {
      profileData = (await db.users.get(currentUid)) as UserProfile;
      if (!profileData)
        throw new Error("Critical Sync Failure: No profile available.");
    }

    // 5. PREPARE FINAL COLLECTIONS (Filtering Logic)
    let finalCounties = sourceCounties;
    let finalDistricts = sourceDistricts;
    let finalAreas = sourceAreas;
    let finalPrecincts = sourcePrecincts;

    if (!isCloudSource) {
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

    // 6. SANITIZATION HELPER
    const sanitize = (items: any[]) =>
      items.map((item) => ({
        ...item,
        id: String(item.id || item.uid).trim(),
        uid: String(item.id || item.uid).trim(),
        active: item.active ?? true,
        last_updated: item.last_updated || Date.now(),
      }));

    // 7. ATOMIC TRANSACTION
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
        await Promise.all([
          db.counties.clear(),
          db.state_rep_districts.clear(),
          db.areas.clear(),
          db.precincts.clear(),
          db.groups.clear(),
          db.users.clear(),
        ]);

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

    // 8. FINALIZATION: Stamp local DB with Keystone Governance
    // This tells VersionGuard that we are now on the correct schema version.
    await updateAppControlAfterSync(keystoneData || undefined);

    console.log(
      "🏁 [Sync] SUCCESS. Local database is fully hydrated and governed.",
    );
  } catch (err: any) {
    console.error("🔴 [Sync] FATAL ERROR:", err.message);
    await db.app_control.update("app_control", {
      sync_status: "error",
      last_sync_attempt: Date.now(),
    });
    throw err;
  }
}
