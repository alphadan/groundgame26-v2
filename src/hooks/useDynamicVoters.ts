// src/hooks/useDynamicVoters.ts
import { useQuery } from "@tanstack/react-query";
import { useCloudFunctions } from "./useCloudFunctions";
import { FilterValues } from "../types";

export const useDynamicVoters = (filters: FilterValues | null) => {
  const { callFunction } = useCloudFunctions();

  return useQuery({
    queryKey: ["dynamicVoters", filters],
    queryFn: async (): Promise<any[]> => {
      if (!filters) return [];

      try {
        const result = await callFunction<{ voters: any[] }>(
          "queryVotersDynamic", // ← Now uses the new dynamic function
          filters
        );

        return result.voters ?? [];
      } catch (err) {
        console.error("Dynamic voter query failed:", err);
        return [];
      }
    },
    enabled: !!filters,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};
