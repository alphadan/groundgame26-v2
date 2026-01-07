/**
 * src/types.ts
 * Standardized Type Definitions for Political Organizing Dashboard (Jan 2026)
 */

// --- Base Interface ---
export interface BaseMetadata {
  id: string; // Maps to Firestore Document ID
  created_at: any; // Firestore Timestamp or number
  updated_at: any; // Standardized from last_updated
  active: boolean;
}

// --- Domain Models ---

export interface Organization extends Omit<BaseMetadata, "id"> {
  id: string;
  code: string;
  name: string;
  short_name: string;
  county_id: string;
  category?: string; // Change to optional if not in all constants
  hq_phone?: string | null;
  website?: string | null;
  // Add these back if they exist in your constants but aren't in the type
  social_facebook?: string | null;
  social_x?: string | null;
  social_instagram?: string | null;
}

export interface County extends Omit<BaseMetadata, "id"> {
  id: string; // e.g., "PA-C-15"
  name: string;
  code: string; // BigQuery matching (e.g., "15")
  state_code: string;
}

export interface Area extends Omit<BaseMetadata, "id"> {
  id: string;
  org_id: string;
  county_id: string;
  area_district: string;
  name: string;
  // Fallback for old data during transition
  last_updated?: number;
  updated_at: any;
}

export interface Precinct extends Omit<BaseMetadata, "id"> {
  id: string; // e.g., "PA15-P-005"
  county_id: string; // Linked to County.id
  area_id: string; // Linked to Area.id
  precinct_code: string; // BigQuery matching (e.g., "5")
  name: string;
  house_district?: string;
  senate_district?: string;
  congressional_district?: string;
}

// --- UserRole ---

export type UserRole =
  | "developer"
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
  can_create_users: boolean;
  can_manage_resources: boolean;
  can_upload_collections: boolean;
  can_create_collections: boolean;
  can_create_documents: boolean;
}

export interface CustomClaims {
  role: UserRole;
  org_id: string | null;
  counties: string[];
  areas: string[];
  precincts: string[];
  permissions: UserPermissions;
  [key: string]: any;
}

// --- UserProfile ---

export interface UserProfile {
  uid: string;
  display_name: string | null;
  email: string | null;
  preferred_name: string | null;
  phone: string | null;
  photo_url: string | null;
  role: UserRole;
  org_id: string | null;
  permissions: UserPermissions;
  access: {
    counties: string[];
    areas: string[];
    precincts: string[];
  };
  last_claims_sync?: any; // Firestore Timestamp
}

// --- Org_Role ---

export interface OrgRole extends Omit<BaseMetadata, "id"> {
  id: string;
  uid: string | null;
  role: UserRole;
  org_id: string;
  county_id: string;
  area_id?: string | null; // Replaces area_district
  precinct_id?: string | null; // Replaces precinct_code
  is_vacant: boolean;
  active: boolean;
}

// --- App Metadata & Sync ---

export interface AppControl {
  id: "app_control";
  current_app_version: string;
  current_db_version: number;
  last_updated: number;
  last_sync_attempt?: number;
  sync_status?: "idle" | "syncing" | "error";
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
