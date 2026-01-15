// src/app/admin/engagement/UserPointsManagementGrid.tsx
import React, { useState, useEffect } from "react";
import { DataGrid, GridColDef, GridActionsCellItem } from "@mui/x-data-grid";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Box } from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import PointAdjustmentDialog from "./PointAdjustmentDialog";

export default function UserPointsManagementGrid() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustmentDialog, setAdjustmentDialog] = useState<{
    open: boolean;
    userId: string | null;
    mode: "add" | "deduct";
  }>({
    open: false,
    userId: null,
    mode: "add",
  });

  useEffect(() => {
    // Sync with the main users collection to see real-time point balances
    const unsubscribe = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const columns: GridColDef[] = [
    { field: "display_name", headerName: "User", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    {
      field: "points_balance",
      headerName: "Current Points",
      width: 150,
      renderCell: (params) => (
        <Box sx={{ fontWeight: "bold", color: "primary.main" }}>
          {params.value || 0} pts
        </Box>
      ),
    },
    {
      field: "actions",
      type: "actions",
      headerName: "Adjust Points",
      width: 150,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<AddCircleIcon color="success" />}
          label="Add Points"
          onClick={() =>
            setAdjustmentDialog({
              open: true,
              userId: params.id as string,
              mode: "add",
            })
          }
          showInMenu={false}
        />,
        <GridActionsCellItem
          icon={<RemoveCircleIcon color="error" />}
          label="Deduct Points"
          onClick={() =>
            setAdjustmentDialog({
              open: true,
              userId: params.id as string,
              mode: "deduct",
            })
          }
          showInMenu={false}
        />,
      ],
    },
  ];

  return (
    <Box sx={{ height: 600, width: "100%" }}>
      <DataGrid rows={users} columns={columns} loading={loading} />

      <PointAdjustmentDialog
        open={adjustmentDialog.open}
        userId={adjustmentDialog.userId}
        mode={adjustmentDialog.mode}
        onClose={() =>
          setAdjustmentDialog({ ...adjustmentDialog, open: false })
        }
      />
    </Box>
  );
}
