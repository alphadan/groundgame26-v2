/**
 * src/types.ts
 * Standardized Type Definitions for Political Organizing Dashboard (Dec 2025)
 */

// --- Base Interface ---
export interface BaseMetadata {
  id: string; // Maps to Firestore Document ID
  created_at: number | null; // Unix epoch milliseconds
  last_updated: number | null; // Unix epoch milliseconds (Renamed for consistency)
  active: boolean | null;
}

// --- Domain Models ---

export interface Organization extends BaseMetadata {
  id: string;
  code: string;
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
  id: string;
  name: string;
  code: string;
}

export interface Area extends BaseMetadata {
  org_id?: string;
  area_district: string;
  county_code?: string;
  name: string;
  chair_uid?: string | null;
  vice_chair_uid?: string | null;
  chair_email?: string | null;
}

export interface Precinct extends BaseMetadata {
  id: string;
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

// --- UserRole ---

export type UserRole =
  | "state_admin"
  | "county_chair"
  | "state_rep_district"
  | "area_chair"
  | "candidate"
  | "ambassador"
  | "committeeperson"
  | "user"
  | "base";



// --- Auth & Claims ---
export interface UserPermissions {
  can_manage_team: boolean;
  can_manage_resources?: boolean;
  can_upload_collections?: boolean;
  can_create_collections?: boolean;
  can_create_documents?: boolean;
  [key: string]: any; // Allow for future expansion
}

export interface CustomClaims {
  role: UserRole;
  org_id: string;
  counties: string[];
  areas: string[];
  precincts: string[];
  user_id?: string;
  uid?: string;
  roles?: string[];
  scope?: string[];
  permissions?: UserPermissions;
  [key: string]: any; // Safety net for dynamic Firebase properties
}

// --- UserProfile ---

export interface UserProfile {
  uid: string;
  display_name: string | null;
  email: string | null;
  role: UserRole | null;
  permissions: UserPermissions;
  org_id: string | null;
  preferred_name: string | null;
  phone: string | null;
  photo_url: string | null;
  access?: {
    counties: string[];
    areas: string[];
    precincts: string[];
  };
  last_claims_sync?: number;
}

// --- Org_Role ---
export interface OrgRole {
  id: string; // "PA15-R-committeeperson-220"
  uid: string | null; // ID of the user assigned (null if vacant)
  role: string;
  org_id: string;
  county_code: string;
  area_district: string;
  precinct_code: string;
  is_vacant: boolean;
  active: boolean;
}

// --- App Metadata & Sync ---

export interface AppControl {
  id: "app_control"; // Fixed primary key
  current_app_version: string; // e.g., "0.1.0-alpha.3"
  current_db_version: number; // e.g., 5
  last_updated: number; // Timestamp of last successful sync
  last_sync_attempt?: number; // Optional: for retry logic
  sync_status?: "idle" | "syncing" | "error"; // Optional: useful for UI
}

export interface FilterValues {
  county: string;
  area: string;
  precinct: string;
  name?: string;
  street?: string;
  modeledParty?: string;
  turnout?: string;
  ageGroup?: string;
  mailBallot?: string;
}

export interface MessageTemplate {
  id: string;
  subject_line?: string;
  body: string;
  category: string;
  tone: string;
  age_group?: string;
  modeled_party?: string;
  turnout_score_general?: string;
  has_mail_ballot?: string;
  tags?: string[];
  active: boolean;
}

export interface VoterNotesProps {
  voterId: string | null;
  fullName?: string;
  address?: string;
}

export interface CampaignResource {
  id: string;
  title: string;
  description: string;
  category: "Brochures" | "Ballots" | "Forms" | "Graphics" | "Scripts";
  url: string;
  thumbnail?: string;
}

export interface UsefulLink {
  name: string;
  description: string;
  phone?: string;
  email?: string;
  website: string;
}
