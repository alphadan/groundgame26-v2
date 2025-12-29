// src/hooks/useVoterStats.ts
import { useQuery } from "@tanstack/react-query";
import { useCloudFunctions } from "./useCloudFunctions";
import { useAuth } from "../context/AuthContext";

export type VoterStatsParams = {
  areaCode?: string;
  precinctCodes?: string[];
};

export type VoterStats = {
  total_r: number;
  total_d: number;
  total_nf: number;
  mail_r: number;
  mail_d: number;
  mail_nf: number;
  returned_r: number;
  returned_d: number;
  returned_nf: number;
  hard_r: number;
  weak_r: number;
  swing: number;
  weak_d: number;
  hard_d: number;

  // === Age Group Breakdowns ===
  age_18_25_r: number;
  age_18_25_d: number;
  age_26_40_r: number;
  age_26_40_d: number;
  age_41_70_r: number;
  age_41_70_d: number;
  age_71_plus_r: number;
  age_71_plus_d: number;

  // === Mail Ballots by Age ===
  mail_age_18_25_r: number;
  mail_age_18_25_d: number;
  mail_age_26_40_r: number;
  mail_age_26_40_d: number;
  mail_age_41_70_r: number;
  mail_age_41_70_d: number;
  mail_age_71_plus_r: number;
  mail_age_71_plus_d: number;
};

export const useVoterStats = (params: VoterStatsParams) => {
  const { callFunction } = useCloudFunctions();
  const { isLoaded } = useAuth();

  return useQuery<VoterStats>({
    queryKey: ["voterStats", params],
    queryFn: async () => {
      const result = await callFunction<{ stats: VoterStats }>(
        "getDashboardStats",
        params
      );
      return result.stats;
    },
    enabled: isLoaded,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};
