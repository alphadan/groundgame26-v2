// src/lib/db.ts
import Dexie, { Table } from "dexie";
import {
  Area,
  County,
  Organization,
  Precinct,
  AppSyncMetadata,
  UserProfile,
} from "../types";

export class GroundGame26DB extends Dexie {
  organizations!: Table<Organization>;
  counties!: Table<County>;
  areas!: Table<Area>;
  precincts!: Table<Precinct>;
  users!: Table<UserProfile>;
  app_metadata!: Table<AppSyncMetadata>;

  constructor() {
    super("GroundGame26V2DB");

    console.log("Initializing DB Version 5");

    // Version 4: Shifting to standardized string IDs as Primary Keys
    this.version(5).stores({
      counties: "id, name",
      areas: "id, [org_id+area_district], active",
      precincts: "id, [county_code+precinct_code], area_district",
      organizations: "id, code, county_code",
      users: "uid, email, org_id, role",
      state_rep_districts: "id, party_rep_district, member_uid",
      org_roles: "id, uid, [org_id+role], precinct_code",
      committeemen_roles: "id, uid, [county_code+area_district+precinct_code]",
      app_metadata: "key",
    });
  }
}

export const db = new GroundGame26DB();
