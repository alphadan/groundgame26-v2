// src/services/referenceDataSync.ts
import { db, ensureDBInitialized, updateAppControlAfterSync } from "../lib/db";
import { doc, getDoc } from "firebase/firestore";
import { db as firestoreDb } from "../lib/firebase"; // Adjust path if needed

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

    // Fetch current user profile from Firestore
    let userProfileSynced = false; // ← DECLARED HERE

    try {
      console.log("👤 Fetching user profile for UID:", uid);

      if (!firestoreDb) {
        console.warn(
          "Firestore instance not available – skipping user profile fetch"
        );
      } else {
        const userRef = doc(firestoreDb, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const rawData = userSnap.data();

          const profile: UserProfile = {
            uid,
            ...(rawData as Omit<UserProfile, "uid">),
          };

          await db.users.put(profile);
          console.log(
            "👤 Current user profile successfully synced from Firestore"
          );
          userProfileSynced = true;
        } else {
          console.warn("👤 No Firestore document found for current user");
        }
      }
    } catch (fetchErr) {
      console.warn(
        "⚠️ Failed to fetch user profile from Firestore:",
        (fetchErr as Error)?.message ?? fetchErr
      );
    }

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
