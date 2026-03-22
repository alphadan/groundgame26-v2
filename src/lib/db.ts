import Dexie, { Table } from "dexie";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db as firestore } from "./firebase";
import { REFERENCE_DATA } from "../constants/referenceData";
import {
  Area,
  County,
  Group,
  Precinct,
  UserProfile,
  AppControl,
  State_Rep_District,
} from "../types";

// --- DYNAMIC CONFIGURATION ---
// These are fallbacks only. Real enforcement happens in VersionGuard via Firestore.
const DB_NAME = "GroundGame26V2DB";
const SYNC_TIMEOUT_MS = 8000;
const CURRENT_APP_VERSION = "0.4.3-beta.9";

class GroundGame26DB extends Dexie {
  counties!: Table<County>;
  state_rep_districts!: Table<State_Rep_District>;
  areas!: Table<Area>;
  precincts!: Table<Precinct>;
  groups!: Table<Group>;
  users!: Table<UserProfile>;
  app_control!: Table<AppControl>;

  constructor() {
    super(DB_NAME);

    // Schema versioning is now managed by the VersionGuard.
    // We keep a high base version to avoid Dexie's internal auto-upgrade conflicts.
    this.version(100).stores({
      counties: "id, name, active",
      state_rep_districts: "id, district_number, county_id, party_rep_district",
      areas: "id, county_id, active",
      precincts:
        "id, area_id, county_id, active, precinct_code, party_rep_district",
      groups: "id, county_id, active",
      users: "uid, role",
      app_control: "id",
    });
  }
}

export const db = new GroundGame26DB();

/**
 * PRODUCTION READY INITIALIZER
 * Note: version enforcement is now handled by VersionGuard.tsx
 * before this function is called in App.tsx.
 */
export async function ensureDBInitialized(
  isAuthenticated: boolean = false,
): Promise<void> {
  console.log(`🚀 [DB] Initializing GroundGame DB Engine...`);

  try {
    const exists = await Dexie.exists(DB_NAME);

    if (!exists) {
      console.log("📂 [DB] No existing database found. Creating fresh...");
      await db.open();
      // On fresh install, we seed immediately
      await seedDatabase(isAuthenticated);
      return;
    }

    if (!db.isOpen()) {
      await db.open();
    }

    const pCount = await db.precincts.count();
    if (pCount === 0) {
      console.warn("⚠️ [DB] Tables are empty. Re-seeding...");
      await seedDatabase(isAuthenticated);
    } else {
      console.log(`✅ [DB] Database verified with ${pCount} precincts.`);
    }
  } catch (err) {
    console.error("❌ [DB] Critical Init Error:", err);
    // If init fails, we attempt one hard reset to clear corruption
    await performHardReset(isAuthenticated);
  }
}

/**
 * THE RESET ENGINE
 * Exported so VersionGuard can trigger it remotely via Keystone updates.
 */
export async function performHardReset(isAuthenticated: boolean) {
  console.warn("🧹 [DB] SYSTEM SIGNAL: Performing Hard Reset & Cache Wipe...");

  if (db.isOpen()) {
    db.close();
  }

  await Dexie.delete(DB_NAME);

  // Re-open and re-initialize
  await db.open();
  await seedDatabase(isAuthenticated);
}

/**
 * DATA HYDRATION LAYER
 */
async function seedDatabase(isAuthenticated: boolean) {
  const start = performance.now();

  if (!isAuthenticated) {
    console.log("🛡️ [DB] User not authenticated. Using Static Fallback.");
    await seedFromConstants();
    return;
  }

  try {
    const syncPromise = syncFromFirebase();
    const timeoutPromise = new Promise<boolean>((_, reject) =>
      setTimeout(
        () => reject(new Error("Cloud Sync Timeout")),
        SYNC_TIMEOUT_MS,
      ),
    );

    const success = await Promise.race([syncPromise, timeoutPromise]);

    if (success) {
      console.log(
        `✅ [DB] Cloud Sync Success (${Math.round(performance.now() - start)}ms)`,
      );
      return;
    }
    throw new Error("Cloud returned empty dataset");
  } catch (err) {
    console.error(
      "⚠️ [DB] Cloud Sync Failed, using local constants fallback.",
      err,
    );
    await seedFromConstants();
  }
}

async function syncFromFirebase(): Promise<boolean> {
  const collections = [
    "counties",
    "state_rep_districts",
    "areas",
    "precincts",
    "groups",
  ];
  let totalRows = 0;

  try {
    if (!db.isOpen()) await db.open();

    for (const colName of collections) {
      const snap = await getDocs(collection(firestore, colName));
      if (!snap.empty) {
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        await db.table(colName).bulkPut(data);
        totalRows += data.length;
      }
    }
    return totalRows > 0;
  } catch (e) {
    console.error("❌ [DB] Firebase Fetch Error:", e);
    return false;
  }
}

async function seedFromConstants() {
  try {
    await db.transaction(
      "rw",
      [db.counties, db.state_rep_districts, db.areas, db.precincts, db.groups],
      async () => {
        await db.counties.bulkPut(REFERENCE_DATA.counties as County[]);
        if ((REFERENCE_DATA as any).state_rep_districts) {
          await db.state_rep_districts.bulkPut(
            (REFERENCE_DATA as any).state_rep_districts,
          );
        }
        await db.areas.bulkPut(REFERENCE_DATA.areas as Area[]);
        await db.precincts.bulkPut(REFERENCE_DATA.precincts as Precinct[]);
        await db.groups.bulkPut(REFERENCE_DATA.groups as Group[]);
      },
    );
  } catch (err) {
    console.error("❌ [DB] Static Seed Error:", err);
  }
}

/**
 * APP CONTROL UPDATER
 * Called by referenceDataSync.ts after a successful Cloud update.
 */
export async function updateAppControlAfterSync(
  keystoneData?: Partial<AppControl>,
): Promise<void> {
  await db.app_control.put({
    id: "app_control",
    current_app_version: CURRENT_APP_VERSION,
    current_db_version: keystoneData?.current_db_version || 0,
    last_updated: Date.now(),
    latest_stable_build:
      keystoneData?.latest_stable_build || CURRENT_APP_VERSION,
    legal_terms_version: keystoneData?.legal_terms_version || "",
    maintenance_mode: keystoneData?.maintenance_mode || false,
    stage: keystoneData?.stage || "production",
    // Add these to satisfy the full interface if necessary
    min_app_version: keystoneData?.min_app_version || "0.1.0",
    min_required_build: keystoneData?.min_required_build || "0.0.0",
    min_required_version: keystoneData?.min_required_version || "0.1.0",
  });
}

/**
 * RELATIONAL QUERIES
 */
export const getPrecinctsBySRD = async (srdId: string) => {
  if (!srdId) return [];
  return await db.precincts.where("party_rep_district").equals(srdId).toArray();
};

export const getPrecinctsByArea = async (areaId: string) => {
  if (!areaId) return [];
  return await db.precincts.where("area_id").equals(areaId).toArray();
};
