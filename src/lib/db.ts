import Dexie, { Table } from "dexie";
import {
  Area,
  County,
  Organization,
  Precinct,
  AppSyncMetadata,
} from "../types";

export class GroundGame26DB extends Dexie {
  // Define tables with their Typescript interfaces
  organizations!: Table<Organization>;
  counties!: Table<County>;
  areas!: Table<Area>;
  precincts!: Table<Precinct>;
  app_metadata!: Table<AppSyncMetadata>;

  constructor() {
    super("GroundGame26V2DB");

    this.version(2).stores({
      organizations: "id, code, county_code",
      counties: "id, name",
      areas: "[org_id+area_district], id, active",
      precincts: "[county_code+precinct_code], id, area_district",
      app_metadata: "key",
    });
  }
}

export const db = new GroundGame26DB();
