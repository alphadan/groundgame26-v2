// src/hooks/useVoters.ts
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";

/**
 * useVoters Hook
 * Executes a raw SQL query against the BigQuery voter database via a secure Cloud Function.
 * Integrates with AuthContext to ensure requests are only made when a valid JWT is available.
 */
export const useVoters = (sql: string) => {
  // Access the verified user and loading state from our Gatekeeper context
  const { user, isLoaded } = useAuth();

  return useQuery({
    // Key includes the SQL string to ensure the cache updates when the query changes
    queryKey: ["voters", sql],
    
    queryFn: async () => {
      // Safety check: double-check for a user object
      if (!user) throw new Error("Authentication required to fetch voter data.");

      // Fetch the latest JWT token from the SDK
      const token = await user.getIdToken();

      const res = await fetch(
        "https://us-central1-groundgame26-v2.cloudfunctions.net/queryVoters",
        {
          method: "POST",
          headers: {
            // Standard professional Bearer token authentication
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql }),
        }
      );

      // Handle server-side errors
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Voter Query Error:", errorText);
        throw new Error(errorText || "An error occurred while querying the voter database.");
      }

      return res.json();
    },

    /**
     * ARCHITECTURAL GATE:
     * This query will remain 'pending' and WILL NOT fire until:
     * 1. AuthContext confirms the role and token are ready (isLoaded).
     * 2. A valid SQL string is provided.
     */
    enabled: isLoaded && !!user && !!sql && sql !== "SELECT 1 WHERE FALSE",

    // Caching logic for professional scalability
    staleTime: 5 * 60 * 1000, // Keep data fresh for 5 minutes
    retry: 1, 
  });
};