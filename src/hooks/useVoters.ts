// src/hooks/useVoters.ts
import { useQuery } from "@tanstack/react-query";
import { auth } from "../lib/firebase";

export const useVoters = (sql: string) => {
  return useQuery({
    queryKey: ["voters", sql],
    queryFn: async () => {
      const token = await auth.currentUser!.getIdToken();
      const res = await fetch(
        "https://us-central1-groundgame26.cloudfunctions.net/queryVoters",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql }),
        }
      );

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      return res.json();
    },
    enabled: !!auth.currentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
