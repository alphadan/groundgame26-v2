// src/lib/db.ts
import Dexie, { Table } from "dexie";
import { collection, getDocs } from "firebase/firestore";
import { db as firestore } from "./firebase";
import { REFERENCE_DATA } from "../constants/referenceData";
import {
  Area,
  County,
  Group,
  Precinct,
  UserProfile,
  AppControl,
  State_Rep_District, // Ensure this is in your types
} from "../types";

// --- CONFIGURATION ---
const APP_VERSION = process.env.REACT_APP_VERSION || "0.0.0";
/** * CRITICAL: Increment this value in your .env file (REACT_APP_DB_VERSION)
 * or change the default below to 2 or 3 to trigger the schema update.
 */
const DB_VERSION = Number(process.env.REACT_APP_DB_VERSION) || 3;
const DB_NAME = "GroundGame26V2DB";
const SYNC_TIMEOUT_MS = 5000;

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

    this.version(DB_VERSION).stores({
      counties: "id, name, active",
      // Primary key is 'id', indexes provided for filtering in GeographicFilters
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
 */
export async function ensureDBInitialized(
  isAuthenticated: boolean = false,
): Promise<void> {
  console.log(`🚀 [DB] Initializing GroundGame DB (Target v${DB_VERSION})...`);

  try {
    const exists = await Dexie.exists(DB_NAME);

    if (!exists) {
      console.log("📂 [DB] No existing database found. Creating fresh...");
      await db.open();
      await initializeControlRecord();
      await seedDatabase(isAuthenticated);
      return;
    }

    await db.open();
    const control = await db.app_control.get("app_control");
    const currentLocalVersion = control?.current_db_version || 0;

    if (currentLocalVersion < DB_VERSION) {
      console.warn(
        `🔄 [DB] Version Mismatch! Local: ${currentLocalVersion}, Env: ${DB_VERSION}. Forcing Hard Reset...`,
      );
      await performHardReset(isAuthenticated);
    } else {
      const pCount = await db.precincts.count();
      if (pCount === 0) {
        console.warn(
          "⚠️ [DB] Database exists but tables are empty. Re-seeding...",
        );
        await seedDatabase(isAuthenticated);
      } else {
        console.log(
          `✅ [DB] Database verified (v${currentLocalVersion}) with ${pCount} precincts.`,
        );
      }
    }
  } catch (err) {
    console.error("❌ [DB] Critical Init Error:", err);
    await performHardReset(isAuthenticated);
  }
}

async function seedDatabase(isAuthenticated: boolean) {
  const start = performance.now();
  if (!isAuthenticated) {
    console.log("🛡️ [DB] User not authenticated. Bypassing Cloud Layer 1.");
    await seedFromConstants();
    return;
  }

  try {
    const syncPromise = syncFromFirebase();
    const timeoutPromise = new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new Error("Firebase timeout")), SYNC_TIMEOUT_MS),
    );

    const success = await Promise.race([syncPromise, timeoutPromise]);

    if (success) {
      console.log(
        `✅ [DB] Layer 1 Success: Synced in ${Math.round(performance.now() - start)}ms.`,
      );
      return;
    }
    throw new Error("Layer 1 returned no data");
  } catch (err) {
    console.error("⚠️ [DB] Layer 1 Failed, switching to Layer 2...");
    await seedFromConstants();
  }
}

/**
 * Layer 1: Firebase Fetch
 * Included 'state_rep_districts' in the cloud loop.
 */
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
      console.log(`🔍 [DB] Querying Cloud Collection: "${colName}"...`);
      const snap = await getDocs(collection(firestore, colName));

      if (!snap.empty) {
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        await db.table(colName).bulkPut(data);
        totalRows += data.length;
        console.log(`   -> Downloaded ${data.length} rows for ${colName}`);
      }
    }
    return totalRows > 0;
  } catch (e) {
    console.error("❌ [DB] Firebase Fetch Error:", e);
    return false;
  }
}

/**
 * Layer 2: Constants Fallback
 */
async function seedFromConstants() {
  try {
    await db.transaction(
      "rw",
      [db.counties, db.state_rep_districts, db.areas, db.precincts, db.groups],
      async () => {
        await db.counties.bulkPut(REFERENCE_DATA.counties as County[]);
        // Ensure REFERENCE_DATA has a state_rep_districts array, or use empty array fallback
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
    console.log("✨ [DB] Layer 2 Success: Seeded from local constants.");
  } catch (err) {
    console.error("❌ [DB] Static Seed Error:", err);
  }
}

async function performHardReset(isAuthenticated: boolean) {
  console.log("🧹 [DB] Performing Hard Reset...");
  db.close();
  await Dexie.delete(DB_NAME);
  await db.open();
  await initializeControlRecord();
  await seedDatabase(isAuthenticated);
}

async function initializeControlRecord() {
  await db.app_control.put({
    id: "app_control",
    current_app_version: APP_VERSION,
    current_db_version: DB_VERSION,
    last_updated: Date.now(),
    sync_status: "idle",
  });
}

export async function updateAppControlAfterSync(): Promise<void> {
  await db.app_control.update("app_control", {
    last_updated: Date.now(),
    sync_status: "idle",
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
