export interface UserDoc {
  created_at?: any; // Firestore Timestamp
  display_name: string;
  email: string;
  last_ip?: string;
  login_count?: number;
  org_id?: string;
  permissions?: string[];
  phone?: string;
  photo_url?: string;
  preferred_name?: string;
  primary_county?: string;
  primary_precinct?: string;
  role?: string;
  theme?: string;
  updated_at?: any;
}
