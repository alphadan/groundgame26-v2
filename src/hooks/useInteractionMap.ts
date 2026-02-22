import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export function useInteractionMap(precinct: string | undefined) {
  const [interactionMap, setInteractionMap] = useState<Set<string>>(new Set());

  // src/hooks/useInteractionMap.ts
  useEffect(() => {
    if (!precinct) return;

    // RE-VERIFY: Ensure this is a number comparison
    const now = Date.now();

    const q = query(
      collection(db, "voter_interactions"),
      where("precinct", "==", String(precinct)), // Ensure string matching
      where("expires_at", ">", now),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // DEBUG LOG: See if data is actually arriving
      console.log(
        "Firestore Hook Update:",
        snapshot.size,
        "active interactions found",
      );

      const suppressedIds = new Set<string>();
      snapshot.forEach((doc) => {
        suppressedIds.add(doc.data().voter_id);
      });
      setInteractionMap(suppressedIds);
    });

    return () => unsubscribe();
  }, [precinct]); // This ensures the hook refreshes when you change precincts

  return interactionMap;
}
