// src/hooks/useVoterStats.ts
import { useQuery } from "@tanstack/react-query";
import { useCloudFunctions } from "./useCloudFunctions";
import { useAuth } from "../context/AuthContext";
import { VoterStats, VoterStatsParams } from "../types";

export const useVoterStats = (params: VoterStatsParams) => {
  const { callFunction } = useCloudFunctions();
  const { isLoaded } = useAuth();

  return useQuery<VoterStats>({
    queryKey: ["voterStats", params],
    queryFn: async () => {
      const result = await callFunction<{ stats: VoterStats }>(
        "getDashboardStats",
        params,
      );
      return result.stats;
    },
    enabled: isLoaded,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};
