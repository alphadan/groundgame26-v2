import React, { useState, useEffect } from "react";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";

interface BadgeAchievementRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  badge_id: string;
  badge_title: string;
  badge_unicode: string;
  badge_sponsor: string;
  earned_at: number;
}

export default function BadgeAchievementsByUser() {
  const [rows, setRows] = useState<BadgeAchievementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAchievements = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "user_badges"), 
          orderBy("earned_at", "desc")
        );
        
        const snap = await getDocs(q);
        // 3. Map the data and cast it to our interface
        const data = snap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as BadgeAchievementRow[];

        setRows(data);
      } catch (error) {
        console.error("Error fetching achievements:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, []);

  const columns: GridColDef[] = [
    { field: "user_name", headerName: "User", flex: 1 },
    { field: "badge_unicode", headerName: "Icon", width: 70 },
    { field: "badge_title", headerName: "Badge", flex: 1 },
    { field: "badge_sponsor", headerName: "Sponsor", width: 150 },
    {
      field: "earned_at",
      headerName: "Date",
      width: 180,
      valueFormatter: (value) => new Date(value).toLocaleDateString(),
    },
  ];

  return (
    <div style={{ height: 600, width: "100%" }}>
      <DataGrid rows={rows} columns={columns} loading={loading} />
    </div>
  );
}
