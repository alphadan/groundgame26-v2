import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { useDncMap } from "../../hooks/useDncMap";
import { awardPoints } from "../../services/rewardsService";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Alert,
  Button,
  useTheme,
  Snackbar,
  Chip,
  Divider,
  useMediaQuery,
} from "@mui/material";
import {
  Phone,
  Message,
  Download as DownloadIcon,
  MailOutline,
  Block,
  Home as HomeIcon,
} from "@mui/icons-material";
import DoorbellIcon from "@mui/icons-material/Doorbell";
import { FilterValues } from "../../types";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarQuickFilter,
  GridRenderCellParams,
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
  city?: string;
  zip_code?: number | string;
}

export default function WalkListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user, isLoaded: authLoaded } = useAuth();
  const dncMap = useDncMap();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Fetch voters (Sorted by Address in Cloud Function)
  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  const PURPLE_MAIN = "#673ab7";

  // --- REWARD HANDLER ---
  const handleRewardAction = async (
    action: "sms" | "email" | "walk",
    label: string,
    url?: string,
  ) => {
    if (!user?.uid) return;

    // Logic: Walk visit = 5 pts, Comms = 1 pt
    const points = action === "walk" ? 1 : 1;

    try {
      await awardPoints(user.uid, action, points);
      setSnackbarMessage(`+${points} points awarded for ${label}!`);
      setSnackbarOpen(true);

      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Failed to award points:", err);
    }
  };

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.precinct) {
      setSnackbarMessage(
        "Precinct selection is required for a valid walk list.",
      );
      setSnackbarOpen(true);
      return;
    }
    setFilters(submittedFilters);
  }, []);

  const handleDownloadCSV = useCallback(() => {
    if (!voters.length) return;
    const headers = [
      "Full Name",
      "Address",
      "Party",
      "Age",
      "Phone",
      "DNC Status",
    ];
    const csvContent = [
      headers.join(","),
      ...voters.map((v: any) => {
        const phoneNorm = v.phone_mobile?.replace(/\D/g, "") || "";
        const isDnc =
          dncMap.has(v.voter_id) || (phoneNorm !== "" && dncMap.has(phoneNorm));
        return [
          `"${v.full_name}"`,
          `"${v.address}"`,
          `"${v.party}"`,
          v.age,
          `"${v.phone_mobile || v.phone_home || ""}"`,
          isDnc ? "DO NOT CONTACT" : "Active",
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `walklist_${filters?.precinct}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }, [voters, dncMap, filters]);

  // Define Toolbar inside to prevent Context/Theme errors
  const CustomToolbar = () => (
    <GridToolbarContainer
      sx={{ p: 2, justifyContent: "space-between", bgcolor: "grey.50" }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <HomeIcon color="primary" />
        <Typography variant="h6" fontWeight="bold">
          Canvassing Walk List
        </Typography>
      </Stack>
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );

  const columns: GridColDef<Voter>[] = useMemo(
    () => [
      {
        field: "address",
        headerName: "Household / Address",
        flex: 1.5,
        minWidth: 220,
        renderCell: (params: GridRenderCellParams<Voter>) => {
          const { row, api, id } = params;
          const rowIndex = api.getRowIndexRelativeToVisibleRows(id);
          const prevRowId =
            rowIndex > 0 ? api.getRowIdFromRowIndex(rowIndex - 1) : null;
          const prevRow = prevRowId
            ? (api.getRowModels().get(prevRowId) as any)
            : null;

          const isNewHouse = !prevRow || prevRow.address !== row.address;

          return (
            <Box sx={{ py: 1 }}>
              {isNewHouse ? (
                <Typography
                  variant="body2"
                  fontWeight="900"
                  color="primary.main"
                >
                  {row.address}
                </Typography>
              ) : (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ pl: 2, fontStyle: "italic" }}
                >
                  (Same Household)
                </Typography>
              )}
            </Box>
          );
        },
      },
      {
        field: "full_name",
        headerName: "Voter Name",
        flex: 1.2,
        minWidth: 180,
        renderCell: ({ row }) => {
          const isDnc =
            dncMap.has(row.voter_id) ||
            (row.phone_mobile &&
              dncMap.has(row.phone_mobile.replace(/\D/g, "")));
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="body2"
                fontWeight="medium"
                color={isDnc ? "error.main" : "text.primary"}
              >
                {row.full_name}
              </Typography>
              {isDnc && (
                <Chip
                  label="DNC"
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ height: 16, fontSize: "0.6rem" }}
                />
              )}
            </Stack>
          );
        },
      },
      {
        field: "party",
        headerName: "Party",
        width: 80,
        renderCell: ({ value }) => (
          <Chip
            label={value || "U"}
            size="small"
            sx={{
              fontWeight: "bold",
              bgcolor:
                value === "R"
                  ? theme.palette.error.light
                  : value === "D"
                    ? theme.palette.info.light
                    : "grey.300",
              color: "white",
            }}
          />
        ),
      },
      {
        field: "actions",
        headerName: "Contact & Rewards",
        width: 250,
        sortable: false,
        renderCell: ({ row }) => {
          const phone = row.phone_mobile || row.phone_home;
          const isDnc =
            dncMap.has(row.voter_id) ||
            (row.phone_mobile &&
              dncMap.has(row.phone_mobile.replace(/\D/g, "")));

          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {!isDnc && (
                <>
                  <Tooltip title="Log House Visit (+1 pts)">
                    <IconButton
                      size="small"
                      sx={{ color: PURPLE_MAIN }}
                      onClick={() =>
                        handleRewardAction("walk", `visiting ${row.full_name}`)
                      }
                    >
                      <DoorbellIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  {phone && isMobile && (
                    <Tooltip title="Call Voter">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() =>
                          (window.location.href = `tel:${phone.replace(/\D/g, "")}`)
                        }
                      >
                        <Phone fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}

                  {row.phone_mobile && isMobile && (
                    <Tooltip title="Text Voter (+1 pt)">
                      <IconButton
                        size="small"
                        color="info"
                        onClick={() =>
                          handleRewardAction(
                            "sms",
                            "SMS Outreach",
                            `sms:${row.phone_mobile!.replace(/\D/g, "")}`,
                          )
                        }
                      >
                        <Message fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}

                  {row.email && (
                    <Tooltip title="Email Voter (+1 pt)">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() =>
                          handleRewardAction(
                            "email",
                            "Email Outreach",
                            `mailto:${row.email}`,
                          )
                        }
                      >
                        <MailOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              )}
              {isDnc && <Block color="error" sx={{ fontSize: 18, mx: 1 }} />}
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <VoterNotes
                voterId={row.voter_id}
                fullName={row.full_name}
                address={row.address}
              />
            </Stack>
          );
        },
      },
    ],
    [dncMap, theme.palette, handleRewardAction],
  );

  if (!authLoaded)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom color="primary">
        Household Walk List
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Sorted by address for optimized canvassing.
      </Typography>

      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        demographicFilters={[
          "zipCode",
          "street",
          "party",
          "turnout",
          "ageGroup",
          "mailBallot",
        ]}
      />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Error loading walk list. Please refresh the page.
        </Alert>
      )}

      {filters && voters.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="body2" color="text.secondary">
              Found <strong>{voters.length}</strong> voters in{" "}
              <strong>{new Set(voters.map((v) => v.address)).size}</strong>{" "}
              households.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadCSV}
            >
              Export CSV
            </Button>
          </Stack>

          <Paper
            sx={{
              height: 800,
              width: "100%",
              borderRadius: 3,
              overflow: "hidden",
              boxShadow: 3,
            }}
          >
            <DataGrid
              rows={voters}
              getRowId={(row) => row.voter_id}
              columns={columns}
              rowHeight={75}
              disableRowSelectionOnClick
              slots={{ toolbar: CustomToolbar }}
              initialState={{
                pagination: { paginationModel: { pageSize: 50 } },
              }}
              sx={{
                border: "none",
                "& .MuiDataGrid-cell:focus": { outline: "none" },
              }}
            />
          </Paper>
        </Box>
      )}

      {!filters && (
        <Paper
          sx={{
            p: 10,
            textAlign: "center",
            bgcolor: "grey.50",
            border: "1px dashed grey",
          }}
        >
          <Typography variant="h6" color="text.secondary">
            Apply filters to generate your walking route
          </Typography>
        </Paper>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="success" variant="filled" sx={{ width: "100%" }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
