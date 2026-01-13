// src/hooks/useDncMap.ts
import { useMemo } from "react";
import { useAdminCRUD } from "./useAdminCRUD";
import { DncRecord } from "../types";

export const useDncMap = () => {
  const { data: dncList } = useAdminCRUD<DncRecord>({
    collectionName: "dnc",
    defaultOrderBy: "created_at",
  });

  const dncSet = useMemo(() => {
    const set = new Set<string>();
    dncList.forEach((record) => {
      if (record.voter_id) set.add(record.voter_id);
      if (record.phone) {
        // Normalize to raw digits for matching
        set.add(record.phone.replace(/\D/g, ""));
      }
      if (record.email) set.add(record.email.toLowerCase());
    });
    return set;
  }, [dncList]);

  return dncSet;
};
