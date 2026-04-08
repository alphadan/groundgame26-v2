import { useQuery } from "@tanstack/react-query";
import { useCloudFunctions } from "./useCloudFunctions";
import { FilterValues } from "../types";

export const useVoterAnalytics = (filters: FilterValues | null) => {
  const { callFunction } = useCloudFunctions();

  return useQuery({
    queryKey: ["voterAnalytics", filters],
    queryFn: async () => {
      if (!filters) return null;
      return await callFunction<{
        partyCounts: { label: string; val: number }[];
        topStreets: { name: string; count: number }[];
        totalCount: number;
      }>("queryVoterAnalyticsDynamic", filters);
    },
    enabled: !!filters,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
};
