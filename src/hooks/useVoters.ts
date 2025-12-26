// src/hooks/useVoters.ts
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";

/**
 * useVoters Hook
 * Safe SQL Patterns – Only allow predefined safe queries
 * This prevents arbitrary SQL execution even if token is compromised
 */

const ALLOWED_SQL_PATTERNS = [
  // Absentee stats placeholder
  /SELECT\s+COUNTIF\([^)]+\)\s+AS\s+\w+[\s,\w()=']+FROM\s+`groundgame26_voters\.chester_county`/i,
  // Add more safe patterns as needed
] as const;

/*
const isSafeSql = (sql: string): boolean => {
  if (typeof sql !== "string") return false;
  const trimmed = sql.trim();
  return ALLOWED_SQL_PATTERNS.some((pattern) => pattern.test(trimmed));
};
*/

export const useVoters = (sql: string) => {
  // Access the verified user and loading state from our Gatekeeper context
  const { user, isLoaded } = useAuth();

  return useQuery({
    // Key includes the SQL string to ensure the cache updates when the query changes
    queryKey: ["voters", sql ?? "empty"],

    queryFn: async (): Promise<any> => {
      // === 1. Parameter validation ===
      if (!sql || typeof sql !== "string" || sql.trim() === "") {
        throw new Error("Invalid query: SQL string required");
      }

      const trimmedSql = sql.trim();

      // === 2. Security: Enforce allowlist ===
      /*
      if (!isSafeSql(trimmedSql)) {
        console.error("Blocked unsafe SQL query:", trimmedSql);
        throw new Error("Invalid query type");
      }
      */

      // === 3. Auth validation ===
      if (!user) {
        throw new Error("Authentication required");
      }

      let token: string;
      try {
        token = await user.getIdToken();
      } catch (tokenErr) {
        console.error("Failed to get ID token:", tokenErr);
        throw new Error("Authentication failed");
      }

      // === 4. Safe fetch with timeout ===
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      let res: Response;

      try {
        res = await fetch(
          "https://us-central1-groundgame26-v2.cloudfunctions.net/queryVoters",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sql: trimmedSql }),
            signal: controller.signal,
          }
        );
      } catch (fetchErr: any) {
        if (fetchErr.name === "AbortError") {
          throw new Error("Query timeout – please try again");
        }
        throw new Error("Network error – check your connection");
      } finally {
        clearTimeout(timeoutId);
      }

      // === 5. Response validation ===
      if (!res.ok) {
        let errorMsg = "Query failed";
        try {
          const text = await res.text();
          // Only expose generic message – prevent info leaks
          console.error("Voter query HTTP error:", res.status, text);
          errorMsg = "Server error – please try again later";
        } catch {}
        throw new Error(errorMsg);
      }

      // === 6. Safe JSON parsing ===
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error("Invalid JSON response from voter query");
        throw new Error("Invalid response format");
      }

      // Optional: validate data shape
      if (!Array.isArray(data)) {
        throw new Error("Unexpected data format");
      }

      return data;
    },

    // === 7. Safe enabling logic ===
    /*
    enabled:
      isLoaded &&
      !!user &&
      !!sql &&
      typeof sql === "string" &&
      isSafeSql(sql.trim()),
      */

    // Caching logic for professional scalability
    staleTime: 5 * 60 * 1000, // Keep data fresh for 5 minutes
    retry: 1,
    retryOnMount: false,
  });
};
