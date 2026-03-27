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
        // 1. TRANSFORMATION LAYER: Flatten GeoPayload objects into SQL strings
        // This ensures BigQuery receives "5" instead of the whole Atglen object.
        const sqlParams = {
          ...filters,
          county: filters.county?.sql || filters.county,
          area: filters.area?.sql || filters.area,
          precinct: filters.precinct?.sql || filters.precinct,
          srd: filters.srd?.sql || filters.srd,
        };

        // 2. Execute the call with the flattened parameters
        const result = await callFunction<{ voters: any[] }>(
          "queryVotersDynamic",
          sqlParams,
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
