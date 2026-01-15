// src/app/voters/VoterListPage.tsx
import React, { useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { useDncMap } from "../../hooks/useDncMap";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Alert,
  TextField,
  Button,
  useTheme,
  useMediaQuery,
  Snackbar,
  Chip,
} from "@mui/material";
import {
  Phone,
  Message,
  Download as DownloadIcon,
  MailOutline,
  Block,
} from "@mui/icons-material";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { FilterValues } from "../../types";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";

interface Voter {
  voter_id: string;
  full_name?: string;
  age?: number | string;
  party?: string;
  address?: string;
  precinct?: string;
  phone_mobile?: string;
  phone_home?: string;
  email?: string;
}

function CustomToolbar() {
  return (
    <GridToolbarContainer sx={{ p: 2, justifyContent: "space-between" }}>
      <Typography variant="h6" fontWeight="bold">
        Voter Contact List
      </Typography>
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}

export default function VoterListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user, isLoaded: authLoaded } = useAuth();

  // 1. Initialize the DNC protection Map
  const dncMap = useDncMap();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.precinct) {
      setSnackbarMessage("Please select a precinct to generate a voter list");
      setSnackbarOpen(true);
      return;
    }
    setFilters(submittedFilters);
  }, []);

  const handleCall = useCallback(
    (phone?: string) => {
      if (!phone || !isMobile) return;
      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;
      setSnackbarMessage("Opening Phone app...");
      setSnackbarOpen(true);
      setTimeout(() => {
        window.location.href = `tel:${normalized}`;
      }, 2000);
    },
    [isMobile]
  );

  const handleText = useCallback(
    async (phone?: string) => {
      if (!phone || !isMobile) return;
      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;
      setSnackbarMessage("Opening Messages app...");
      setSnackbarOpen(true);
      setTimeout(() => {
        window.location.href = `sms:${normalized}?body=`;
      }, 2000);
    },
    [isMobile]
  );

  // 2. Define columns with DNC check integration
  const columns: GridColDef<Voter>[] = [
    {
      field: "full_name",
      headerName: "Voter",
      flex: 1.2,
      minWidth: 180,
      renderCell: ({ row }) => {
        // Check if voter is in DNC Registry
        const normalizedPhone = row.phone_mobile?.replace(/\D/g, "") || "";
        const isDnc =
          dncMap.has(row.voter_id) ||
          dncMap.has(normalizedPhone) ||
          (row.email && dncMap.has(row.email.toLowerCase()));

        return (
          <Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="body1"
                fontWeight="medium"
                color={isDnc ? "error" : "textPrimary"}
              >
                {row.full_name || "Unknown"}
              </Typography>
              {isDnc && (
                <Tooltip title="Voter has requested no contact (DNC)">
                  <Chip
                    label="DNC"
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.65rem" }}
                  />
                </Tooltip>
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {row.address || "No address on file"}
            </Typography>
          </Stack>
        );
      },
    },
    {
      field: "age",
      headerName: "Age",
      width: 80,
      align: "center",
      headerAlign: "center",
      valueGetter: (_v, row) => row.age ?? "?",
    },
    {
      field: "party",
      headerName: "Party",
      width: 100,
      align: "center",
      headerAlign: "center",
      renderCell: ({ value }) => (
        <Chip
          label={value || "N/A"}
          size="small"
          sx={{
            minWidth: 60,
            bgcolor:
              value === "R"
                ? theme.palette.voter.hardR
                : value === "D"
                ? theme.palette.voter.hardD
                : undefined,
            color: value === "R" || value === "D" ? "#FFFFFF" : "text.primary",
            fontWeight: "bold",
          }}
        />
      ),
    },
    {
      field: "precinct",
      headerName: "Precinct",
      flex: 1,
      minWidth: 140,
      valueGetter: (_v, row) => row.precinct || "—",
    },
    {
      field: "contact",
      headerName: "Contact",
      width: 220,
      align: "right",
      sortable: false,
      renderCell: ({ row }) => {
        // 3. Contact Protection Logic
        const normalizedPhone = row.phone_mobile?.replace(/\D/g, "") || "";
        const isDnc =
          dncMap.has(row.voter_id) ||
          dncMap.has(normalizedPhone) ||
          (row.email && dncMap.has(row.email.toLowerCase()));

        return (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            {isDnc ? (
              <Tooltip title="Outreach Disabled: DNC Status">
                <IconButton size="small" color="error" disabled>
                  <Block fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <>
                {(row.phone_mobile || row.phone_home) && isMobile && (
                  <IconButton
                    size="small"
                    color="success"
                    onClick={() =>
                      handleCall(row.phone_mobile || row.phone_home)
                    }
                  >
                    <Phone fontSize="small" />
                  </IconButton>
                )}
                {row.phone_mobile && isMobile && (
                  <IconButton
                    size="small"
                    color="info"
                    onClick={() => handleText(row.phone_mobile)}
                  >
                    <Message fontSize="small" />
                  </IconButton>
                )}
                {row.email && (
                  <IconButton
                    size="small"
                    color="primary"
                    component="a"
                    href={`mailto:${row.email}`}
                    target="_blank"
                  >
                    <MailOutline fontSize="small" />
                  </IconButton>
                )}
              </>
            )}
          </Stack>
        );
      },
    },
    {
      field: "note",
      headerName: "Note",
      width: 100,
      align: "center",
      renderCell: ({ row }) => (
        <VoterNotes
          voterId={row.voter_id}
          fullName={row.full_name}
          address={row.address}
        />
      ),
    },
  ];

  if (!authLoaded) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Voter Contact List
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Targeted voter lists for canvassing and outreach
      </Typography>

      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        unrestrictedFilters={["party", "turnout", "ageGroup", "mailBallot"]}
      />

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          Failed to load voters.
        </Alert>
      )}

      {filters && voters.length > 0 && (
        <Box sx={{ height: { xs: 700, md: 800 }, width: "100%", mt: 5 }}>
          <DataGrid
            rows={voters}
            getRowId={(row) => row.voter_id}
            columns={columns}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            pageSizeOptions={[10, 25, 50, 100]}
            disableRowSelectionOnClick
            slots={{ toolbar: CustomToolbar }}
            sx={{
              "& .MuiDataGrid-columnHeaders": {
                bgcolor: "secondary.main",
                color: "secondary.contrastText",
                fontWeight: "bold",
              },
              borderRadius: 3,
              boxShadow: 4,
            }}
          />
        </Box>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="info" variant="filled">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
