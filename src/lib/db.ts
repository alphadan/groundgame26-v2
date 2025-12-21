// src/lib/db.ts
import Dexie, { Table } from "dexie";
import {
  Area,
  County,
  Organization,
  Precinct,
  AppSyncMetadata,
} from "../types";

export class GroundGame26DB extends Dexie {
  organizations!: Table<Organization>;
  counties!: Table<County>;
  areas!: Table<Area>;
  precincts!: Table<Precinct>;
  app_metadata!: Table<AppSyncMetadata>;

  constructor() {
    super("GroundGame26V2DB");

    // Version 4: Shifting to standardized string IDs as Primary Keys
    this.version(4).stores({
      users: "uid, email, org_id, role",
      state_rep_districts: "id, party_rep_district, member_uid",
      org_roles: "id, uid, [org_id+role], precinct_code",
      committeemen_roles: "id, uid, [county_code+area_district+precinct_code]",
    });
  }
}

export const db = new GroundGame26DB();
