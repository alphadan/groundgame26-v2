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
  id: string;
  code: string;
  name: string;
  short_name: string;
  county_id: string;
  category?: string;
  hq_phone?: string | null;
  website?: string | null;
  active: boolean;
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

// --- UserProfile ---

export interface UserProfile {
  uid: string;
  display_name: string | null;
  email: string | null;
  preferred_name: string | null;
  phone: string | null;
  photo_url: string | null;
  role: UserRole;
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
  access: {
    counties: string[];
    areas: string[];
    precincts: string[];
  };
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
  last_updated: number;
  last_sync_attempt?: number;
  sync_status?: "idle" | "syncing" | "error";
}

export interface FilterValues {
  precinct_id?: string;
  county?: string;
  area?: string;
  precinct?: string;
  name?: string;
  street?: string;
  modeledParty?: string;
  party?: string;
  turnout?: string;
  ageGroup?: string;
  mailBallot?: string;
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

export interface CampaignResource {
  id: string;
  title: string;
  category: string;
  url: string;
  description?: string;
  verified_by_role?: "county_chair" | "area_chair" | string;
  scope?: "county" | "area" | "precinct";
  county_id?: string;
  area_id?: string;
  precinct_id?: string;
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

export interface Goal extends BaseMetadata {
  precinct_id: string; // Maps to PA15-P-XXX
  precinct_name: string;
  cycle: string; // e.g., "2025_PRIMARY"
  county_id: string; // For scoped filtering
  area_id: string; // For scoped filtering
  targets: GoalTargets; // The target numbers
  current?: Partial<GoalTargets>; // To track actual progress
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
