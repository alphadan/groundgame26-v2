export interface Area {
  org_id: string;
  area_district: string;
  name: string;
  chair_uid: string | null;
  vice_chair_uid: string | null;
  chair_email: string | null;
  active: boolean;
}
