/**
 * src/types.ts
 * Standardized Type Definitions for Political Organizing Dashboard (Jan 2026)
 */

// --- Base Interface ---
export interface BaseMetadata {
  id: string; // Maps to Firestore Document ID
  created_at: number; // Firestore Timestamp or number
  updated_at: number; // Standardized from last_updated
  active: boolean;
}

// --- Domain Models ---

export interface Group extends Omit<BaseMetadata, "id"> {
  id: string; // doc.id (e.g., "PA15-G-05")
  uid: string; // Must match id
  name: string; // Long name
  short_name?: string; // Abbreviated name
  code: string; // Internal slug (e.g., "ccfrw")
  county_id: string; // Relational key (e.g., "PA-C-15")

  // Contact Info
  website?: string;
  hq_phone?: string;
  social_facebook?: string;
  social_x?: string;
  social_instagram?: string;

  active: boolean;
  created_at: number;
  updated_at: number;
  created_by?: string;
}

export interface County extends Omit<BaseMetadata, "id"> {
  id: string;
  name: string;
  code: string;
  state_code: string;
  state_rep_district_ids?: string[];
}

export interface DistrictLeader {
  uid: string;
  name: string;
}

export interface State_Rep_District extends Omit<BaseMetadata, "id"> {
  id: string; // e.g., "PA-SRD-district_2"
  district_number: string; // "2"
  name: string; // "Chester County State Republican Party - District 2"
  party_rep_district: string; // For matching with precincts

  // UPDATED: Array of objects instead of single UIDs
  district_leaders: DistrictLeader[] | null;

  area_associations: string[];
  county_id: string;
  budget_status: "active" | "pending" | "locked";
  active: boolean;
  updated_at: number; // Unix Time (ms)
  created_at: number; // Unix Time (seconds)
  group_id?: string;
}
export interface Area extends Omit<BaseMetadata, "id"> {
  id: string;
  uid: string;
  name: string;
  state_rep_district_id: string;
  area_district: string;
  county_id: string;
  county_code?: string;
  active: boolean;
  created_at: number;
  updated_at: number;
}

export interface Precinct extends Omit<BaseMetadata, "id"> {
  id: string; // doc.id (e.g., "PA15-P-005")
  uid: string; // Must match id (e.g., "PA15-P-005")
  name: string; // e.g., "Atglen"
  precinct_code: string; // e.g., "005"
  county_id: string; // Relational key to County (e.g., "PA-C-15")
  county_code?: string; // Official state number (e.g., "15")
  state_rep_district_id: string; // NEW: Explicit link to the Power Nexus
  area_id: string; // Relational key to Area (e.g., "PA15-A-12")
  area_district?: string; // District number (e.g., "12")

  // Legislative Districts
  house_district?: string;
  senate_district?: string;
  congressional_district?: string;
  county_district?: string; // Added to match your form
  party_rep_district?: string;

  active: boolean;
  created_at: number;
  updated_at: number;
}

// --- UserRole ---

export type UserRole =
  | "developer"
  | "state_admin"
  | "county_chair"
  | "state_rep_district"
  | "area_chair"
  | "candidate"
  | "volunteer"
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
  can_download_records: boolean;
}

export interface CustomClaims {
  role: UserRole;
  group_id: string | null;
  counties: string[];
  areas: string[];
  precincts: string[];
  permissions: UserPermissions;
  [key: string]: any;
}

export type JurisdictionType =
  | "house"
  | "senate"
  | "congressional"
  | "countywide";

export interface CandidateJurisdiction {
  type: JurisdictionType;
  value: string; // e.g., "167", "44", "PA06", or "ALL"
}

export interface UserAccess {
  counties: string[];
  districts: string[];
  areas: string[];
  precincts: string[];
  jurisdiction?: CandidateJurisdiction;
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
  points_balance?: number;
  points_history?: PointsHistoryEntry[];
  requires_password_update?: boolean;
  has_agreed_to_terms?: boolean;
  terms_agreed_at?: number;
  legal_consent?: {
    version: string;
    agreed_at_ms: number;
    user_agent: string;
  };
  group_id: string | null;
  permissions: UserPermissions;
  county_id?: string;
  area_id?: string;
  precinct_id?: string;
  access: UserAccess;
  active: boolean;
  last_claims_sync?: any;
}

// --- Org_Role ---

export interface OrgRole extends Omit<BaseMetadata, "id"> {
  id: string;
  uid: string | null;
  role: UserRole;
  group_id: string;
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
  sync_status?: "idle" | "syncing" | "error";
  last_sync_attempt?: number;
  last_updated: number;
  latest_stable_build: string;
  legal_terms_version: string;
  maintenance_mode: boolean;
  min_app_version: string;
  min_required_build: string;
  min_required_version: string;
  stage: "beta" | "production";
}

export interface GeoPayload {
  sql: string; // e.g., "5" (Cleaned for BigQuery)
  full: string; // e.g., "PA15-P-005" (Firestore Doc ID)
  name: string; // e.g., "Atglen" (For UI/Analytics)
}

export type FilterKey =
  | "name"
  | "street"
  | "modeledParty"
  | "party"
  | "turnout"
  | "ageGroup"
  | "mailBallot"
  | "zipCode"
  | "sex";

export interface FilterValues {
  // --- Geographic Context (Upgraded to Dual-Value) ---
  county?: GeoPayload | null;
  area?: GeoPayload | null;
  precinct?: GeoPayload | null;
  srd?: GeoPayload | null; // State Rep District

  // --- Search & Identity ---
  name?: string;
  street?: string;
  precinct_id?: string; // Legacy support or direct lookup
  zipCode?: string;

  // --- Demographic & Party ---
  modeledParty?: string;
  party?: string;
  sex?: string;
  ageGroup?: string;

  // --- Turnout & Behavioral ---
  turnout?: string;
  turnout_score_general?: number;
  turnout_score_primary?: number;
  mailBallot?: string;

  // --- Specific Election Dropoff Logic ---
  gn_pr_11_04_25?: string;
  gn_11_05_24?: string;
  dropoffOnly?: boolean;
  hardGopSuper?: boolean;
  date_registered?: string;
  date_last_changed?: string;
  likely_moved?: boolean;
}

/**
 * Message Template Categories for strict typing
 */
export type MessageCategory =
  | "Affordability"
  | "Crime & Drugs"
  | "Energy & Utilities"
  | "Healthcare"
  | "Housing"
  | "Local";

export type Gender = "M" | "F";

/**
 * The Master Script Template
 */
export interface MessageTemplate {
  id: string; // Auto-generated human-readable slug
  subject_line: string; // Required, max 60 chars
  body: string; // HTML-supported content
  category: MessageCategory; // Strictly typed dropdown

  // Filtering Metadata (null = "Any/All")
  age_group: string | null;
  party: string | null; // Changed from modeled_party
  turnout_score_general: string | null;
  has_mail_ballot: string | null;

  tags: string[]; // Saved as array of strings
  active: boolean;

  // Analytics & Engagement (Admin Visibility)
  favorite_count: number; // Total "Hearts"
  copy_count: number; // Total "Clicks"
  word_count: number; // Calculated on save

  created_at: number; // Unix timestamp
  last_updated: number; // Unix timestamp
  created_by_uid: string; // Tracking who created the template
}

/**
 * Junction Interface for Personal Favorites
 * Stored in collection: `user_favorites`
 * Doc ID pattern: `{uid}_{templateId}`
 */
export interface UserFavorite {
  id: string; // Composite ID
  uid: string; // The user who favorited
  template_id: string; // Reference to MessageTemplate
  created_at: number;
}

export interface Voter {
  // Core Data Fields
  voter_id: string;
  full_name?: string;
  age?: number | string;
  party?: string;
  political_party?: string;
  sex?: string;
  address?: string;
  address_num?: number; // Used for numeric sorting in WalkList
  city?: string;
  zip_code?: string;
  precinct?: string;
  phone_mobile?: string;
  phone_home?: string;
  email?: string;
  modeled_party?: string;
  turnout_score_general?: string;
  gn_pr_11_04_25?: string; // For dropoff voters
  gn_11_05_24?: string; // For dropoff voters
  has_mail_ballot?: boolean;
  isFirstInHouse?: boolean; // For household grouping
  isDnc?: boolean; // From useDncMap
  isRecentlyContacted?: boolean; // From useInteractionMap
  isRecentlyVisited?: boolean; // From useInteractionMap (Walk-specific)
  isLocked?: boolean; // Combined suppression flag
}

export interface VoterStatsParams {
  type: "county" | "srd" | "area" | "precinct" | "all";
  id: string; // The Firestore UUID
  code?: string; // The BigQuery ID (e.g., "105" or "AREA-15")
}

export type VoterStats = {
  total_r: number;
  total_d: number;
  total_nf: number;
  mail_r: number;
  mail_d: number;
  mail_nf: number;
  returned_r: number;
  returned_d: number;
  returned_nf: number;
  hard_r: number;
  weak_r: number;
  swing: number;
  weak_d: number;
  hard_d: number;

  // === Age Group Breakdowns ===
  age_18_25_r: number;
  age_18_25_i: number;
  age_18_25_d: number;
  age_26_40_r: number;
  age_26_40_i: number;
  age_26_40_d: number;
  age_41_70_r: number;
  age_41_70_i: number;
  age_41_70_d: number;
  age_71_plus_r: number;
  age_71_plus_i: number;
  age_71_plus_d: number;

  // === Mail Ballots by Age ===
  mail_age_18_25_r: number;
  mail_age_18_25_i: number;
  mail_age_18_25_d: number;
  mail_age_26_40_r: number;
  mail_age_26_40_i: number;
  mail_age_26_40_d: number;
  mail_age_41_70_r: number;
  mail_age_41_70_i: number;
  mail_age_41_70_d: number;
  mail_age_71_plus_r: number;
  mail_age_71_plus_i: number;
  mail_age_71_plus_d: number;
};

export interface VoterNotesProps {
  voterId: string | null;
  fullName?: string;
  address?: string;
}

export interface VoterNote {
  id: string;
  voter_id: string;
  note: string;
  created_by_name?: string;
  created_at: number;
}

export interface VoterInteraction {
  voter_id: string;
  volunteer_uid: string;
  interaction_type: "walk" | "call" | "sms" | "email" | "survey";
  timestamp: number; // Date.now
  expires_at: number; // Date.now + 30 days
  precinct: string;
}

export interface CampaignResource {
  id: string;
  title: string;
  category:
    | "Maps"
    | "Brochures"
    | "Ballots"
    | "Graphics"
    | "Forms"
    | "Scripts"
    | "Legal"
    | string;
  description: string;
  url: string;
  storagePath: string;
  scope: "county" | "area" | "precinct";
  location: {
    county: { id: string; code: string };
    area?: { id: string; code: string } | null;
    precinct?: { id: string; code: string } | null;
  };
  active: boolean;
  created_at: number;
  verified_by_role?: string;
}

export interface UsefulLink {
  name: string;
  description: string;
  phone?: string;
  email?: string;
  website: string;
}

export interface GoalTargets {
  registrations: number;
  mail_in: number;
  volunteers: number;
  user_activity: number;
  [key: string]: number;
}
export interface AINarratives {
  summary: string;
  positive: string;
  immediate: string;
  actionable: string;
}

export interface Goal extends BaseMetadata {
  precinct_id: string; // Maps to PA15-P-XXX
  precinct_name: string;
  cycle: string; // e.g., "2025_PRIMARY"
  county_id: string; // For scoped filtering
  area_id: string; // For scoped filtering
  targets: GoalTargets; // The target numbers
  current?: Partial<GoalTargets>;
  ai_narratives: AINarratives;
}

export interface DncRecord extends BaseMetadata {
  voter_id: string; // The unique voter identification number
  phone?: string; // Normalized numeric string
  email?: string; // Lowercase email string
  reason?: string; // e.g., "Requested via SMS", "Hostile", "Email Bounce"
  do_not_contact: boolean; // Always true for records in this collection
}

export enum RewardStatus {
  active = "active",
  inactive = "inactive",
  out_of_stock = "out_of_stock",
}

export enum RedemptionStatus {
  pending = "pending",
  completed = "completed",
  cancelled = "cancelled",
}

export enum RewardCategory {
  giftcard = "Gift Card",
  merchandise = "Merchandise",
  experience = "Experience",
  discount = "Discount",
  swag = "Swag",
  digital = "Digital",
  event = "Event",
}

/**
 * The Reward Catalog Item
 */
export interface ireward {
  id: string;
  title: string;
  description: string;
  points_cost: number;
  status: RewardStatus;
  category: RewardCategory;
  sponsor?: string | null;
  is_digital: boolean;
  stock_quantity?: number;
  image_url?: string;
  expiry_date?: number;
  created_at: number;
  updated_at: number;
}

/**
 * The Transaction Record
 */
export interface iredemption {
  id: string;
  user_id: string;
  reward_id: string;

  snapshot: {
    title: string;
    points_paid: number;
  };

  status: RedemptionStatus;
  redeemed_at: number;

  shipping_address?: {
    street: string;
    city: string;
    zip_code: string;
  };

  fulfillment_data?: {
    promo_code?: string;
    download_url?: string;
  };
}

export interface ibadge {
  id?: string;
  title: string;
  description: string;
  unicode: string;
  status: "active" | "inactive";
  sponsor?: string | null;
  created_at?: number;
}

// User-specific badge assignment
export interface iuserBadge {
  id?: string;
  user_id: string;
  badge_id: string;
  earned_at: number;
}

export interface iuserBadgeDenormalized {
  id: string;
  // User Snapshot
  user_id: string;
  user_name: string; // Flattened
  user_email: string; // Flattened
  // Badge Snapshot
  badge_id: string;
  badge_title: string; // Flattened
  badge_unicode: string; // Flattened
  badge_sponsor: string; // Flattened
  // Metadata
  earned_at: number;
}

// src/types.ts add to existing types
// src/types.ts

export interface PrecinctMonthlyStats {
  // Metadata & ID: {precinct_id}_{month}_{year}
  id: string;
  precinct_id: string;
  month: number;
  year: number;
  county_id: string;

  // === STATUS (Official County Data - Lagging Indicators) ===
  // Current snapshots of the voter file provided by the county
  gop_registrations: number;
  dem_registrations: number;
  indep_registrations: number;

  gop_has_mail_ballots: number;
  dem_has_mail_ballots: number;
  indep_has_mail_ballots: number;

  // === ACTIVITY (Volunteer Data - Leading Indicators) ===
  // Aggregated real-time counts of what your team is doing
  doors_knocked: number;
  texts_sent: number;
  emails_sent: number;
  surveys_completed: number;
  volunteers_active_count: number; // Unique UIDs that contributed this month

  // System Metadata
  last_updated: number; // Timestamp of the most recent activity or status sync
  updated_by: string; // UID of the admin or system process that last modified it
}

export interface PointsHistoryEntry {
  action: "sms" | "email" | "walk" | "survey" | "admin_adj";
  amount: number;
  timestamp: number;
}

export interface LegalConsent {
  agreed_at_ms: number;
  ip_verified: boolean;
  user_agent: string;
  version: string;
}

export type AgeGroup = "18-24" | "25-40" | "41-70" | "71+";
export type PartyAffiliation = "Republican" | "Democratic" | "Independent";
export type Sex = "M" | "F" | "Other";

// Main Survey interface
export interface Survey {
  id: string;
  jsonPath: string;
  demographics: {
    age_group?: AgeGroup;
    area_id?: string;
    sex?: Sex;
    party_affiliation?: PartyAffiliation;
  };
  name: string;
  survey_id: string;
  created_at?: any;
  updated_at?: any;
  description?: string;
  active?: boolean;
}
