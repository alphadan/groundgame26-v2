/**
 * src/types.ts
 * Standardized Type Definitions for Political Organizing Dashboard (Dec 2025)
 */

// --- Base Interface ---
export interface BaseMetadata {
  id: string; // Maps to Firestore Document ID
  created_at: number; // Unix epoch milliseconds
  last_updated: number; // Unix epoch milliseconds (Renamed for consistency)
  active: boolean;
}

// --- Domain Models ---

export interface Organization extends BaseMetadata {
  // Primary Key in DB: id (formerly org_id)
  code: string; // e.g., 'gop'
  name: string;
  short_name: string;
  county_code: string;
  county_name: string;
  chair_uid: string | null;
  vice_chair_uid: string | null;
  chair_email: string | null;
  hq_phone?: string | null;
  website?: string | null;
  social_facebook?: string | null;
  social_x?: string | null;
  social_instagram?: string | null;
}

export interface County extends BaseMetadata {
  // Primary Key in DB: id (formerly code '15')
  name: string;
}

export interface Area extends BaseMetadata {
  // Compound Key in DB: [org_id+area_district]
  // 'id' is still present for general reference
  org_id: string;
  area_district: string;
  name: string;
  chair_uid: string | null;
  vice_chair_uid: string | null;
  chair_email: string | null;
}

export interface Precinct extends BaseMetadata {
  // Compound Key in DB: [county_code+precinct_code]
  county_code: string;
  precinct_code: string;
  name: string;
  area_district: string;
  congressional_district: string;
  senate_district: string;
  house_district: string;
  county_district: string;
  party_rep_district: string;
}

// --- App Metadata & Sync ---

export interface AppSyncMetadata {
  key: string; // e.g., 'app_control' or 'reference_data'
  last_updated: number;
  current_version: string;
}

export interface AppVersionMetadata {
  id: string; // Maps to doc ID 'app_control'
  current_version: string;
  min_required_version: string;
  stage: "alpha" | "beta" | "prod";
  last_updated: number;
}

// --- Auth & Claims ---

export interface UserPermissions {
  can_export_csv: boolean;
  can_manage_team: boolean;
  can_view_phone: boolean;
  can_view_full_address: boolean;
  can_cut_turf: boolean;
}

export interface CustomClaims {
  role:
    | "state_admin"
    | "county_chair"
    | "area_chair"
    | "candidate"
    | "ambassador"
    | "committeeperson"
    | "user"
    | "base";
  roles: string[];
  org_id: string;
  counties: string[];
  areas: string[];
  precincts: string[];
  scope: string[];
  permissions: UserPermissions;
}
