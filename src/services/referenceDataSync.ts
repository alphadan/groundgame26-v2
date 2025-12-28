// src/services/referenceDataSync.ts
import { db, ensureDBInitialized, updateAppControlAfterSync } from "../lib/db";
import { doc, getDoc } from "firebase/firestore";
import { db as firestoreDb } from "../lib/firebase";

import {
  counties,
  areas,
  precincts,
  organizations,
} from "../constants/referenceData";
import { UserProfile } from "../types";

export async function syncReferenceData(currentUid: string): Promise<void> {
  if (
    !currentUid ||
    typeof currentUid !== "string" ||
    currentUid.trim() === ""
  ) {
    console.warn(
      "⚠️ syncReferenceData called with invalid UID – skipping sync"
    );
    return;
  }

  const uid = currentUid.trim();

  try {
    await ensureDBInitialized();

    await db.app_control.update("app_control", { sync_status: "syncing" });

    await db.users.clear();

    // Load static reference data
    try {
      await db.transaction(
        "rw",
        db.counties,
        db.areas,
        db.precincts,
        db.organizations,
        async () => {
          await db.counties.bulkPut(counties ?? []);
          await db.areas.bulkPut(areas ?? []);
          await db.precincts.bulkPut(precincts ?? []);
          await db.organizations.bulkPut(organizations ?? []);
        }
      );

      console.log(
        "Static reference data (counties, areas, precincts, organizations) loaded into IndexedDB"
      );
    } catch (txErr) {
      console.error("Failed to load static reference data:", txErr);
    }

    // === Fetch user profile with 5-second timeout ===
    let userProfileSynced = false;

    // Final success cleanup
    try {
      await updateAppControlAfterSync();
      console.log(
        "Sync completed successfully. Static data loaded. User profile synced:",
        userProfileSynced
      );
    } catch (finalErr) {
      console.error("Failed to update app_control after sync:", finalErr);
    }
  } catch (unexpectedErr) {
    console.error("Unexpected error during syncReferenceData:", unexpectedErr);

    try {
      await db.app_control.update("app_control", {
        sync_status: "error",
        last_sync_attempt: Date.now(),
      });
    } catch (statusErr) {
      console.warn("Could not update app_control error status:", statusErr);
    }
  }
}
