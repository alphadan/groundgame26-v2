// src/constants/usersToImport.ts
export interface UserToImport {
  email: string;
  displayName: string;
}

export const USERS_TO_IMPORT: UserToImport[] = [
  { email: "john.doe@example.com", displayName: "John Doe" },
  { email: "jane.smith@example.com", displayName: "Jane Smith" },
];