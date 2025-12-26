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

    try {
      console.log("👤 Attempting to fetch user profile for UID:", uid);
      console.log("🔍 Firestore instance available:", !!firestoreDb);
      console.log("🔑 App Check active:");

      if (!firestoreDb) {
        console.warn(
          "Firestore instance not available - skipping user profile fetch"
        );
      } else {
        const userRef = doc(firestoreDb, "users", uid);
        console.log("📍 Document path:", userRef.path);

        // Inline timeout wrapper – rejects after 5 seconds
        const userSnap = await Promise.race([
          getDoc(userRef),
          new Promise<never>((_, reject) =>
            setTimeout(() => {
              reject(new Error("Firestore read timeout after 8 seconds"));
            }, 8000)
          ),
        ]);

        if (userSnap.exists()) {
          const rawData = userSnap.data();
          console.log("📄 Raw user data:", rawData);

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
          console.log("👤 No user document found (normal for new users)");
        }
      }
    } catch (fetchErr: any) {
      if (fetchErr?.message?.includes("timeout")) {
        console.warn(
          "⚠️ User profile fetch timed out after 5s – possible Firestore rules or network issue"
        );
        console.error("❌ User profile fetch failed:", fetchErr);
        console.error("Error name:", fetchErr.name);
        console.error("Error message:", fetchErr.message);
        console.error("Error code:", fetchErr.code);
      } else {
        console.warn(
          "⚠️ Failed to fetch user profile:",
          fetchErr?.message ?? fetchErr
        );
        console.error("❌ User profile fetch failed:", fetchErr);
        console.error("Error name:", fetchErr.name);
        console.error("Error message:", fetchErr.message);
        console.error("Error code:", fetchErr.code);
      }
      // Continue without profile – app remains functional
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
