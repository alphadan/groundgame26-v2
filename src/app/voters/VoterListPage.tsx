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
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Alert,
  Snackbar,
  Chip,
  useTheme,
  Divider,
  useMediaQuery,
  AlertTitle,
  Button,
  Avatar,
} from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import {
  Phone,
  Message,
  MailOutline,
  Block,
  Download as DownloadIcon,
} from "@mui/icons-material";
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
  gender?: string;
  address?: string;
  city?: string;
  zip_code?: string;
  precinct?: string;
  phone_mobile?: string;
  phone_home?: string;
  email?: string;
  modeled_party?: string;
  turnout_score_general?: string;
  has_mail_ballot?: boolean;
}

const REWARD_PURPLE = "#673ab7";

export default function VoterListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user, claims, isLoaded: authLoaded } = useAuth();
  const dncMap = useDncMap();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [isRewardToast, setIsRewardToast] = useState(false);

  const PRESET_FILTERS = [
    {
      label: "High Primary Turnout",
      icon: "🗳️",
      filters: {
        party: "R",
        turnout_score_primary: 4,
        turnout_score_general: undefined,
      },
    },
    {
      label: "GOP Women",
      icon: "👩",
      filters: { party: "R", gender: "F" },
    },
  ];

  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  // Permission Check - Updated to can_manage_resources
  const canDownload = !!claims?.permissions?.can_manage_resources;

  // --- CSV DOWNLOAD HANDLER ---
  const handleDownloadCSV = useCallback(() => {
    if (!voters || voters.length === 0) return;

    const headers = [
      "Full Name",
      "Age",
      "Gender",
      "Party",
      "Address",
      "City",
      "Zip Code",
      "Phone Mobile",
      "Phone Home",
      "Precinct",
      "Modeled Party",
      "Turnout Score General",
      "Turnout Score Primary",
      "Has Mail Ballot",
    ];

    const rows = voters.map((voter: any) => [
      voter.full_name || "",
      voter.age || "",
      voter.gender || "",
      voter.party || "",
      voter.address || "",
      voter.city || "",
      voter.zip_code || "",
      voter.phone_mobile || "",
      voter.phone_home || "",
      voter.precinct || "",
      voter.modeled_party || "",
      voter.turnout_score_general ?? "N/A",
      voter.turnout_score_primary ?? "N/A",
      voter.has_mail_ballot ? "Yes" : "No",
      voter.has_mail_ballot ? "Yes" : "No",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((field) => `"${(field + "").replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `voter_list_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsRewardToast(false);
    setSnackbarMessage(`Downloaded ${voters.length} voters as CSV`);
    setSnackbarOpen(true);
  }, [voters]);

  // --- REWARDED ACTION HANDLER ---
  const handleContactAction = async (
    type: "sms" | "email" | "phone",
    voterName: string,
    protocolUrl: string,
  ) => {
    if (!user?.uid) return;
    try {
      await awardPoints(user.uid, type === "phone" ? "sms" : type, 1);
      setIsRewardToast(true);
      setSnackbarMessage(`+1 point earned for contacting ${voterName}!`);
      setSnackbarOpen(true);
      setTimeout(() => {
        window.location.href = protocolUrl;
      }, 1000);
    } catch (err) {
      window.location.href = protocolUrl;
    }
  };

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.precinct) {
      setSnackbarMessage("Please select a precinct to generate a voter list");
      setSnackbarOpen(true);
      return;
    }

    // If the user uses the manual form, they are opting BACK into General Turnout logic.
    // We explicitly wipe the "hidden" primary score here.
    setFilters({
      ...submittedFilters,
      turnout_score_primary: undefined,
    });
  }, []);

  const isPresetActive = (presetFilters: Partial<FilterValues>) => {
    if (!filters) return false;
    return Object.keys(presetFilters).every(
      (key) =>
        filters[key as keyof FilterValues] ===
        presetFilters[key as keyof FilterValues],
    );
  };

  // Logic to apply filters and handle mutual exclusivity
  const applyQuickFilter = (presetFilters: Partial<FilterValues>) => {
    setFilters((prev) => {
      const currentPrecinct = prev?.precinct || "";
      return {
        ...presetFilters,
        precinct: currentPrecinct,
      } as FilterValues;
    });
  };

  // Simple Toolbar without the download button
  const CustomToolbar = useCallback(
    () => (
      <GridToolbarContainer
        sx={{ p: 2, justifyContent: "space-between", bgcolor: "grey.50" }}
      >
        <Typography variant="h6" fontWeight="bold">
          Voter Contact List
        </Typography>
        <GridToolbarQuickFilter />
      </GridToolbarContainer>
    ),
    [],
  );

  const columns: GridColDef<Voter>[] = useMemo(
    () => [
      {
        field: "full_name",
        headerName: "Voter",
        flex: 1.2,
        minWidth: 180,
        renderCell: ({ row }) => {
          const isDnc = dncMap.has(row.voter_id);
          return (
            <Stack sx={{ py: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography
                  variant="body1"
                  fontWeight="medium"
                  color={isDnc ? "error" : "textPrimary"}
                >
                  {row.full_name || "Unknown"}
                </Typography>
                {isDnc && (
                  <Chip
                    label="DNC"
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ height: 20 }}
                  />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {row.address || "No address on file"}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "gender",
        headerName: "Sex",
        width: 90,
        align: "center",
        headerAlign: "center",
        renderCell: ({ value }) => (
          <Typography
            variant="caption"
            sx={{
              fontWeight: "bold",
              fontSize: "1.1rem",
              color:
                value === "F"
                  ? theme.palette.primary.light
                  : value === "M"
                    ? theme.palette.secondary.dark
                    : "grey.400",
            }}
          >
            {value || " "}
          </Typography>
        ),
      },
      {
        field: "party",
        headerName: "Party",
        width: 90,
        renderCell: ({ value }) => (
          <Chip
            label={value || "?"}
            size="small"
            sx={{
              fontWeight: "bold",
              bgcolor:
                value === "R"
                  ? theme.palette.error.main
                  : value === "D"
                    ? theme.palette.info.main
                    : "grey.400",
              color: "white",
            }}
          />
        ),
      },
      {
        field: "contact",
        headerName: "Contact & Rewards",
        width: 280,
        sortable: false,
        renderCell: ({ row }) => {
          const phone = row.phone_mobile || row.phone_home;
          const normalizedPhone = phone?.replace(/\D/g, "");
          const isDnc = dncMap.has(row.voter_id);
          if (isDnc) return <Block color="error" sx={{ mr: 2 }} />;

          return (
            <Stack
              direction="row"
              spacing={1}
              justifyContent="flex-end"
              alignItems="center"
            >
              {(row.phone_mobile || row.phone_home) && !isMobile && (
                <Typography variant="body2">
                  {row.phone_mobile || row.phone_home}
                </Typography>
              )}
              {phone && isMobile && (
                <Tooltip title="Call Voter (+1 pt)">
                  <IconButton
                    size="small"
                    color="success"
                    onClick={() =>
                      handleContactAction(
                        "phone",
                        row.full_name || "Voter",
                        `tel:${normalizedPhone}`,
                      )
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
                      handleContactAction(
                        "sms",
                        row.full_name || "Voter",
                        `sms:${normalizedPhone}`,
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
                      handleContactAction(
                        "email",
                        row.full_name || "Voter",
                        `mailto:${row.email}`,
                      )
                    }
                  >
                    <MailOutline fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Divider
                orientation="vertical"
                flexItem
                sx={{ mx: 0.5, pr: 1 }}
              />
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
    [dncMap, theme.palette, handleContactAction, isMobile],
  );

  if (!authLoaded)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
        Voter Contact List
      </Typography>
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <BoltIcon color="primary" fontSize="small" />
          <Typography
            variant="subtitle2"
            fontWeight="bold"
            color="text.secondary"
          >
            Quick Targets (Specialized Search)
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ gap: 1.5 }}>
          {PRESET_FILTERS.map((preset) => {
            // Check if this preset's specific primary score is active
            const active = isPresetActive(preset.filters);

            return (
              <Chip
                key={preset.label}
                label={preset.label}
                // The Magic: This function sets turnout_score_primary and WIPES turnout_score_general
                onClick={() => applyQuickFilter(preset.filters)}
                onDelete={active ? () => setFilters(null) : undefined}
                color={active ? "primary" : "default"}
                variant={active ? "filled" : "outlined"}
                avatar={
                  <Avatar sx={{ bgcolor: "transparent", fontSize: "1.2rem" }}>
                    {preset.icon}
                  </Avatar>
                }
                sx={{
                  borderRadius: "12px",
                  fontWeight: 600,
                  height: 44,
                  px: 1,
                  // Visual feedback that this is a "Power User" feature
                  border: active
                    ? undefined
                    : `1px solid ${theme.palette.primary.light}`,
                  "&:hover": { transform: "translateY(-1px)", boxShadow: 2 },
                }}
              />
            );
          })}
          {filters && (
            <Button
              size="small"
              variant="text"
              onClick={() => setFilters(null)}
              sx={{ color: theme.palette.error.main, fontWeight: "bold" }}
            >
              Clear All
            </Button>
          )}
        </Stack>
      </Box>

      {/* --- STANDARD FILTER SELECTOR (General Turnout is default here) --- */}
      <FilterSelector
        onSubmit={handleSubmit} // This function will clear Primary Turnout if used manually
        isLoading={isLoading}
        demographicFilters={[
          "party",
          "turnout", // This maps to turnout_score_general by default in your hook/form
          "ageGroup",
          "mailBallot",
          "gender",
        ]}
      />
      {/* Inside the VoterListPage JSX, below the FilterSelector */}
      {filters?.turnout_score_primary !== undefined && (
        <Alert severity="warning" sx={{ mt: 4, borderRadius: 2 }}>
          <strong>Specialized Filter Active:</strong> High Primary Turnout
          (Score: {filters.turnout_score_primary}) is currently applied. This
          filter is not available in the manual selector.
        </Alert>
      )}

      {voters.length > 0 && (
        <>
          <Alert
            severity="error"
            variant="outlined"
            sx={{
              mt: 3,
              mb: 3,
              borderColor: "error.main",
              backgroundColor: "white",
            }}
          >
            <AlertTitle sx={{ fontWeight: "bold" }}>
              SMS Messaging Warning
            </AlertTitle>
            <Typography variant="body2">
              <strong>Carrier Suspension:</strong> Sending more than 10 messages
              per hour can cause providers to flag your number as automated
              spam.
            </Typography>
          </Alert>

          {/* DOWNLOAD ACTION ROW - Just above DataGrid */}
          {canDownload && (
            <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadCSV}
                sx={{
                  bgcolor: "#B22234",
                  px: 3,
                  py: 1,
                  fontWeight: "bold",
                  "&:hover": { bgcolor: "#8B1A1A" },
                }}
              >
                Download Voter Export (CSV)
              </Button>
            </Box>
          )}

          <Box sx={{ height: 800, width: "100%" }}>
            <DataGrid
              rows={voters}
              getRowId={(row) => row.voter_id}
              columns={columns}
              rowHeight={70}
              slots={{ toolbar: CustomToolbar }}
              sx={{ borderRadius: 3, boxShadow: 2, border: "none" }}
            />
          </Box>
        </>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          severity={isRewardToast ? "success" : "info"}
          variant="filled"
          sx={{ bgcolor: isRewardToast ? REWARD_PURPLE : undefined }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
