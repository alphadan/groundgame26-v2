// src/types/County.ts
export interface County {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at?: any;
  updated_at?: any;
  [key: string]: any;
}
