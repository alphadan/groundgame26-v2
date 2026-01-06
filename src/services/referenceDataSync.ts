// src/services/referenceDataSync.ts
import { db, ensureDBInitialized, updateAppControlAfterSync } from "../lib/db";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  counties as allCounties,
  areas as allAreas,
  precincts as allPrecincts,
  organizations as allOrgs,
} from "../constants/referenceData";
import { UserProfile, County, Area, Precinct } from "../types";

/**
 * Strategy:
 * 1. Normalize all access inputs (handling string vs array vs null).
 * 2. Filter Counties and Areas based on user access.
 * 3. Strategic Precinct Filtering:
 * - Committeepersons get ONLY their specific assigned precincts.
 * - Others (Admins/Chairs) get ALL precincts in their assigned areas.
 * 4. Clear and atomic-write to IndexedDB.
 */
export async function syncReferenceData(currentUid: string): Promise<void> {
  console.log("🟢 [Sync] Entering syncReferenceData for UID:", currentUid);

  if (!currentUid?.trim()) {
    console.error("🔴 [Sync] Aborting: No valid UID provided");
    return;
  }

  const uid = currentUid.trim();

  try {
    // 1. Initialize local database
    console.log("🟡 [Sync] Initializing IndexedDB...");
    await ensureDBInitialized();
    await db.app_control.update("app_control", { sync_status: "syncing" });

    // 2. Fetch User Profile via Cloud Function
    console.log("🚀 [Sync] Fetching profile via Cloud Function...");
    const functions = getFunctions(undefined, "us-central1");
    const fetchProfile = httpsCallable(functions, "getUserProfile");

    const result = await fetchProfile();
    const profileData = (result.data as any)?.profile;

    if (!profileData) {
      throw new Error("Server returned no profile data for this user.");
    }

    const userRole = profileData.role;
    console.log("🟢 [Sync] Profile received. Role:", userRole);

    // 3. Normalize Access Fields (Handles: null, string, or array)
    const normalizeToArray = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return [String(val)];
    };

    const allowedCounties = normalizeToArray(profileData.access?.counties);
    const allowedAreas = normalizeToArray(profileData.access?.areas);
    const allowedPrecincts = normalizeToArray(profileData.access?.precincts);

    console.group("🔍 [Sync] Normalization Check");
    console.log("Normalized Counties:", allowedCounties);
    console.log("Normalized Areas:", allowedAreas);
    console.log("Normalized Precincts:", allowedPrecincts);
    console.groupEnd();

    // 4. Strategic Filtering logic

    // Filter Counties: Match ID (e.g. "PA-C-15") or Code (e.g. "15")
    const filteredCounties = allCounties.filter(
      (c) => allowedCounties.includes(c.id) || allowedCounties.includes(c.code)
    );

    // Filter Areas: Match Area IDs exactly (e.g., "PA15-A-01")
    const filteredAreas = allAreas.filter((a) => allowedAreas.includes(a.id));

    // Filter Precincts based on Role
    let filteredPrecincts: Precinct[] = [];

    if (userRole === "committeeperson") {
      // Committeepersons: Only get the specific precincts assigned to them
      console.log("📍 Filtering strictly by Precinct IDs for Committeeperson");
      filteredPrecincts = allPrecincts.filter(
        (p) =>
          allowedPrecincts.includes(p.id) ||
          allowedPrecincts.includes(p.precinct_code)
      );
    } else {
      // Admins/Chairs: Get every precinct that belongs to their assigned areas
      console.log(
        "🗺️ Mapping all precincts from allowed areas for Admin/Chair"
      );
      filteredPrecincts = allPrecincts.filter((p) =>
        allowedAreas.includes(p.area_district)
      );
    }

    console.log(
      `📊 [Sync] Results: ${filteredCounties.length} counties, ${filteredAreas.length} areas, ${filteredPrecincts.length} precincts matched.`
    );

    // 5. Atomic Write to IndexedDB
    await db.transaction(
      "rw",
      [db.counties, db.areas, db.precincts, db.organizations, db.users],
      async () => {
        // Wipe local tables to ensure clean state
        await Promise.all([
          db.counties.clear(),
          db.areas.clear(),
          db.precincts.clear(),
          db.organizations.clear(),
          db.users.clear(),
        ]);

        // Bulk insert only if we have data to insert
        if (filteredCounties.length > 0)
          await db.counties.bulkPut(filteredCounties);
        if (filteredAreas.length > 0) await db.areas.bulkPut(filteredAreas);
        if (filteredPrecincts.length > 0)
          await db.precincts.bulkPut(filteredPrecincts);

        // Always load global orgs
        await db.organizations.bulkPut(allOrgs);

        // Store current user profile for offline checks
        await db.users.put(profileData);
      }
    );

    // 6. Finalize
    await updateAppControlAfterSync();
    console.log("✅ [Sync] Successfully populated IndexedDB.");
  } catch (err: any) {
    console.error("❌ [Sync] Fatal error during sync:", err.message);

    try {
      await db.app_control.update("app_control", {
        sync_status: "error",
        last_sync_attempt: Date.now(),
      });
    } catch (statusErr) {
      console.warn("Failed to update app_control status:", statusErr);
    }

    throw err;
  }
}
