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
      counties: "id, name",
      areas: "id, [org_id+area_district], active",
      precincts: "id, [county_code+precinct_code], area_district",
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

  if (!exists) {
    // First-time creation
    await db.open();
    await db.transaction("rw", db.app_control, async () => {
      await db.app_control.put({
        id: "app_control",
        current_app_version: APP_VERSION,
        current_db_version: DB_VERSION,
        last_updated: Date.now(),
        sync_status: "idle",
      });
    });
    console.log(
      "IndexedDB created for the first time with version",
      DB_VERSION
    );
    return;
  }

  // DB exists — check version in app_control
  const control = await db.app_control.get("app_control");

  if (!control || control.current_db_version < DB_VERSION) {
    console.log(
      control
        ? `DB version mismatch: stored ${control.current_db_version} < env ${DB_VERSION} → resetting DB`
        : "No app_control record found → resetting DB"
    );

    // Close and delete the old database
    db.close();
    await Dexie.delete(DB_NAME);

    // Re-open with new schema
    await db.open();

    // Insert fresh app_control record
    await db.transaction("rw", db.app_control, async () => {
      await db.app_control.put({
        id: "app_control",
        current_app_version: APP_VERSION,
        current_db_version: DB_VERSION,
        last_updated: Date.now(),
        sync_status: "idle",
      });
    });

    console.log("IndexedDB reset and recreated with version", DB_VERSION);
    return;
  }

  // DB is up-to-date
  console.log(
    "IndexedDB already up-to-date (version",
    control.current_db_version,
    ")"
  );
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
