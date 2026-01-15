import React, { useState, useEffect } from "react";
import { Box, Chip, Paper } from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridRenderCellParams,
  GridRowParams,
} from "@mui/x-data-grid";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import {
  updateRedemptionStatus,
  getAllRedemptions,
} from "../../../services/rewardsService";

export default function RedemptionHistoryGrid() {
  const [rows, setRows] = useState([]);

  const columns: GridColDef[] = [
    { field: "user_name", headerName: "Volunteer", flex: 1 },
    { field: "reward_title", headerName: "Reward", flex: 1 },
    {
      field: "status",
      headerName: "Status",
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          color={params.value === "completed" ? "success" : "warning"}
          size="small"
        />
      ),
    },
    {
      field: "actions",
      type: "actions",
      headerName: "Fulfill",
      width: 100,
      getActions: (params: GridRowParams) => [
        <GridActionsCellItem
          key="ship"
          icon={<LocalShippingIcon color="primary" />}
          label="Mark Shipped"
          onClick={() => updateRedemptionStatus(params.id as string, "shipped")}
          disabled={params.row.status === "completed"}
        />,
      ],
    },
  ];

  return (
    <Paper sx={{ height: 400, width: "100%" }}>
      <DataGrid rows={rows} columns={columns} />
    </Paper>
  );
}
