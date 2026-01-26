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
} from "../types";

// --- CONFIGURATION ---
const APP_VERSION = process.env.REACT_APP_VERSION || "0.0.0";
const DB_VERSION = Number(process.env.REACT_APP_DB_VERSION) || 1;
const DB_NAME = "GroundGame26V2DB";
const SYNC_TIMEOUT_MS = 5000; // 5 seconds to try Firebase before falling back

class GroundGame26DB extends Dexie {
  counties!: Table<County>;
  areas!: Table<Area>;
  precincts!: Table<Precinct>;
  groups!: Table<Group>;
  users!: Table<UserProfile>;
  app_control!: Table<AppControl>;

  constructor() {
    super(DB_NAME);

    /**
     * SCHEMA DEFINITION
     * Fixed DexieError: Added 'active', 'precinct_code', and 'role' to indexes.
     * Note: Only fields used in .where() or .orderBy() need to be listed here.
     */
    this.version(DB_VERSION).stores({
      counties: "id, name, active",
      areas: "id, county_id, active",
      precincts: "id, area_id, county_id, active, precinct_code",
      groups: "id, county_id, active",
      users: "uid, role",
      app_control: "id",
    });
  }
}

export const db = new GroundGame26DB();

/**
 * PRODUCTION READY INITIALIZER
 * Logic: Checks version -> Resets if needed -> Seeds if empty
 * Added 'isAuthenticated' parameter to prevent unauth cloud calls.
 */
export async function ensureDBInitialized(
  isAuthenticated: boolean = false,
): Promise<void> {
  console.log(`🚀 [DB] Initializing GroundGame DB (Target v${DB_VERSION})...`);
  const exists = await Dexie.exists(DB_NAME);

  try {
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

/**
 * PHASE 2: Seed Strategy
 * Wraps Firebase Sync in a timeout and checks auth status.
 */
async function seedDatabase(isAuthenticated: boolean) {
  const start = performance.now();
  console.log("📥 [DB] Beginning seed sequence...");

  // If not logged in, skip Cloud Layer and go straight to Constants for security
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
      const end = performance.now();
      console.log(
        `✅ [DB] Layer 1 Success: Synced from Cloud in ${Math.round(end - start)}ms.`,
      );
      return;
    }
    throw new Error("Layer 1 returned no data");
  } catch (err) {
    console.error(
      "⚠️ [DB] Layer 1 Failed:",
      err instanceof Error ? err.message : err,
    );
    console.log("📦 [DB] Switching to Layer 2: Local Static Constants...");
    await seedFromConstants();
  }
}

/**
 * Layer 1: Firebase Fetch
 */
async function syncFromFirebase(): Promise<boolean> {
  const collections = ["counties", "areas", "precincts", "groups"];
  let totalRows = 0;

  try {
    for (const colName of collections) {
      console.log(`🔍 [DB] Querying Cloud Collection: "${colName}"...`);
      const snap = await getDocs(collection(firestore, colName));

      if (!snap.empty) {
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        await db.table(colName).bulkPut(data);
        totalRows += data.length;
        console.log(`   -> Downloaded ${data.length} rows for ${colName}`);
      } else {
        console.warn(`   -> Cloud collection "${colName}" is empty!`);
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
      [db.counties, db.areas, db.precincts, db.groups],
      async () => {
        await db.counties.bulkPut(REFERENCE_DATA.counties as County[]);
        await db.areas.bulkPut(REFERENCE_DATA.areas as Area[]);
        await db.precincts.bulkPut(REFERENCE_DATA.precincts as Precinct[]);
        await db.groups.bulkPut(REFERENCE_DATA.groups as Group[]);
      },
    );
    console.log(
      `✨ [DB] Layer 2 Success: Seeded from referenceData.ts (${REFERENCE_DATA.precincts.length} precincts)`,
    );
  } catch (err) {
    console.error("❌ [DB] Static Seed Error:", err);
  }
}

// --- CORE UTILITIES ---

async function performHardReset(isAuthenticated: boolean) {
  console.log("🧹 [DB] Performing Hard Reset (Deleting IndexedDB)...");
  db.close();
  await Dexie.delete(DB_NAME);
  console.log("🧹 [DB] Old data cleared. Re-opening...");
  await db.open();
  await initializeControlRecord();
  await seedDatabase(isAuthenticated);
  console.log("✨ [DB] Hard-reset complete.");
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

export const getPrecinctsByArea = async (areaId: string) => {
  if (!areaId) return [];
  // Note: 'area_id' is indexed in our constructor
  const results = await db.precincts.where("area_id").equals(areaId).toArray();
  console.log(
    `🔎 [DB] Query: Precincts in Area ${areaId} -> Found ${results.length}`,
  );
  return results;
};
