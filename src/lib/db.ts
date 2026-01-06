// src/lib/db.ts
import Dexie, { Table } from "dexie";
import {
  Area,
  County,
  Organization,
  Precinct,
  UserProfile,
  AppControl,
} from "../types";

const APP_VERSION = process.env.REACT_APP_VERSION || "0.0.0";
const DB_VERSION = Number(process.env.REACT_APP_DB_VERSION) || 1;
const DB_NAME = "GroundGame26V2DB";

class GroundGame26DB extends Dexie {
  counties!: Table<County>;
  areas!: Table<Area>;
  precincts!: Table<Precinct>;
  organizations!: Table<Organization>;
  users!: Table<UserProfile>;
  app_control!: Table<AppControl>;

  constructor() {
    super(DB_NAME);

    this.version(DB_VERSION).stores({
      counties: "id, name, active",
      areas: "id, county_code, area_district, active",
      precincts: "id, county_code, area_district, precinct_code, active",
      organizations: "id, code, county_code",
      users: "uid, email, org_id, role",
      app_control: "id",
    });
  }
}

export const db = new GroundGame26DB();

/**
 * Ensures the database is initialized and up-to-date.
 * - If DB doesn't exist → create it and insert app_control row
 * - If DB exists but stored current_db_version < env DB_VERSION → delete and recreate
 * - Otherwise → DB is ready
 */
export async function ensureDBInitialized(): Promise<void> {
  const exists = await Dexie.exists(DB_NAME);

  // If DB exists, we MUST open it to check the version stored in app_control
  if (exists) {
    try {
      // Add a timeout to the open call
      await db.open();
    } catch (err) {
      console.error("Failed to open DB, force deleting...", err);
      await Dexie.delete(DB_NAME);
      await db.open();
    }
  } else {
    await db.open();
  }

  const control = await db.app_control.get("app_control");

  // Logic: If version is lower OR record is missing, RESET
  if (!control || control.current_db_version < DB_VERSION) {
    console.warn("🔄 [DB] Version Mismatch or Missing Control. Resetting...");

    // 1. Close connections
    db.close();

    // 2. Delete
    await Dexie.delete(DB_NAME);

    // 3. Re-open and INITIALIZE the control record immediately
    await db.open();
    await db.app_control.put({
      id: "app_control",
      current_app_version: APP_VERSION,
      current_db_version: DB_VERSION,
      last_updated: Date.now(),
      sync_status: "idle",
    });

    console.log("✅ [DB] Database recreated and control record saved.");
  }
}

/**
 * Optional helper: update last_updated after a successful sync
 */
export async function updateAppControlAfterSync(): Promise<void> {
  await db.app_control.update("app_control", {
    last_updated: Date.now(),
    sync_status: "idle",
  });
}
