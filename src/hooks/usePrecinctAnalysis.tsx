import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore"; // Added query imports
import { db } from "../lib/firebase";
import { Goal, PrecinctMonthlyStats } from "../types";

export const usePrecinctAnalysis = (
  precinctId: string,
  month: number,
  year: number
) => {
  const [data, setData] = useState<{
    goal: Goal | null;
    stats: PrecinctMonthlyStats | null;
  }>({
    goal: null,
    stats: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!precinctId) return;
      setLoading(true);

      const formattedMonth = month < 10 ? `0${month}` : `${month}`;
      const statsId = `${precinctId}_${formattedMonth}_${year}`;

      try {
        // 1. QUERY for the Goal (Since ID doesn't match precinctId)
        const goalsRef = collection(db, "goals");
        const q = query(goalsRef, where("precinct_id", "==", precinctId));

        // 2. FETCH Stats by ID
        const statsRef = doc(db, "precinct_monthly_stats", statsId);

        const [goalQuerySnap, statsSnap] = await Promise.all([
          getDocs(q),
          getDoc(statsRef),
        ]);

        // Extract first matching goal from query results
        const goalDoc = !goalQuerySnap.empty ? goalQuerySnap.docs[0] : null;

        setData({
          goal: goalDoc
            ? ({ id: goalDoc.id, ...goalDoc.data() } as Goal)
            : null,
          stats: statsSnap.exists()
            ? ({
                id: statsSnap.id,
                ...statsSnap.data(),
              } as PrecinctMonthlyStats)
            : null,
        });

        console.log(
          `📊 Goal Found: ${!!goalDoc}, Stats Found: ${statsSnap.exists()}`
        );
      } catch (err) {
        console.error("❌ Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [precinctId, month, year]);

  return { ...data, loading };
};
