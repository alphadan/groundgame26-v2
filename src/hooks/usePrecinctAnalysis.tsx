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
  year: number,
) => {
  const [data, setData] = useState<{
    goal: Goal | null;
    stats: PrecinctMonthlyStats | null;
    allPrecincts: PrecinctMonthlyStats[]; // Added to return raw list if needed
  }>({
    goal: null,
    stats: null,
    allPrecincts: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!precinctId) return;
      setLoading(true);

      const formattedMonth = month < 10 ? `0${month}` : `${month}`;
      const isAll = precinctId === "all";

      try {
        const goalsRef = collection(db, "goals");
        const statsRef = collection(db, "precinct_monthly_stats");

        let goalData: Goal | null = null;
        let statsData: PrecinctMonthlyStats | null = null;
        let allStats: PrecinctMonthlyStats[] = [];

        if (isAll) {
          // 1. Fetch ALL goals and stats for the period
          const [goalsSnap, statsSnap] = await Promise.all([
            getDocs(goalsRef),
            getDocs(
              query(
                statsRef,
                where("month", "==", month),
                where("year", "==", year),
              ),
            ),
          ]);

          allStats = statsSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as PrecinctMonthlyStats,
          );

          // 2. Aggregate Stats
          statsData = allStats.reduce(
            (acc, curr) => ({
              ...acc,
              gop_registrations:
                (acc.gop_registrations || 0) + (curr.gop_registrations || 0),
              dem_registrations:
                (acc.dem_registrations || 0) + (curr.dem_registrations || 0),
              gop_has_mail_ballots:
                (acc.gop_has_mail_ballots || 0) +
                (curr.gop_has_mail_ballots || 0),
              dem_has_mail_ballots:
                (acc.dem_has_mail_ballots || 0) +
                (curr.dem_has_mail_ballots || 0),
              doors_knocked:
                (acc.doors_knocked || 0) + (curr.doors_knocked || 0),
              texts_sent: (acc.texts_sent || 0) + (curr.texts_sent || 0),
              volunteers_active_count:
                (acc.volunteers_active_count || 0) +
                (curr.volunteers_active_count || 0),
            }),
            {} as PrecinctMonthlyStats,
          );

          // 3. Aggregate Goals
          const totalGoals = goalsSnap.docs.map((d) => d.data() as Goal);
          goalData = {
            id: "all",
            precinct_id: "all",
            targets: totalGoals.reduce(
              (acc, curr) => ({
                registrations:
                  (acc.registrations || 0) + (curr.targets?.registrations || 0),
                mail_in: (acc.mail_in || 0) + (curr.targets?.mail_in || 0),
                user_activity:
                  (acc.user_activity || 0) + (curr.targets?.user_activity || 0),
                volunteers:
                  (acc.volunteers || 0) + (curr.targets?.volunteers || 0),
              }),
              { registrations: 0, mail_in: 0, user_activity: 0, volunteers: 0 },
            ),
          } as Goal;
        } else {
          // Existing single precinct logic
          const statsId = `${precinctId}_${formattedMonth}_${year}`;
          const q = query(goalsRef, where("precinct_id", "==", precinctId));
          const [goalQuerySnap, statsSnap] = await Promise.all([
            getDocs(q),
            getDoc(doc(db, "precinct_monthly_stats", statsId)),
          ]);

          const goalDoc = !goalQuerySnap.empty ? goalQuerySnap.docs[0] : null;
          goalData = goalDoc
            ? ({ id: goalDoc.id, ...goalDoc.data() } as Goal)
            : null;
          statsData = statsSnap.exists()
            ? ({
                id: statsSnap.id,
                ...statsSnap.data(),
              } as PrecinctMonthlyStats)
            : null;
        }

        setData({ goal: goalData, stats: statsData, allPrecincts: allStats });
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
