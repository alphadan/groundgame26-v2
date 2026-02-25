// src/app/voters/VoterListPage.tsx
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { useDncMap } from "../../hooks/useDncMap";
import { useInteractionMap } from "../../hooks/useInteractionMap";
import { logVoterContact } from "../../services/voterService";
import { awardPoints } from "../../services/rewardsService";
import { logEvent } from "../../lib/analytics";

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
  Paper,
  Collapse,
} from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import {
  Phone,
  Message,
  MailOutline,
  Block,
  Download as DownloadIcon,
  Sort as SortIcon,
} from "@mui/icons-material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Voter, FilterValues } from "../../types";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";

const REWARD_PURPLE = "#673ab7";

export default function VoterListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { user, claims, isLoaded: authLoaded } = useAuth();
  const dncMap = useDncMap();
  const interactionMap = useInteractionMap(filters?.precinct);

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
    {
      label: "Has Mail-In Ballot",
      icon: "📩",
      filters: { party: "R", has_mail_ballot: true },
      disabled: true,
    },
    {
      label: "Not Voted Mail-In Ballot",
      icon: "📩",
      filters: { party: "R", has_mail_ballot: false },
      disabled: true,
    },
  ];

  const { data: rawVoters = [], isLoading, error } = useDynamicVoters(filters);

  const voters = useMemo(() => {
    let result = [...rawVoters];

    // Apply Sort
    result.sort((a, b) => {
      const nameA = (a.full_name || "").toLowerCase();
      const nameB = (b.full_name || "").toLowerCase();
      const comp = nameA.localeCompare(nameB);
      return sortOrder === "asc" ? comp : -comp;
    });

    // Apply Suppression & Grouping Flags
    return result.map((voter, index, array): Voter => {
      const prev = index > 0 ? array[index - 1] : null;
      const vId = voter.voter_id ? String(voter.voter_id) : `temp-${index}`;

      const isDnc = dncMap.has(vId);
      const isRecentlyContacted = interactionMap.has(vId);

      return {
        ...voter,
        isFirstInHouse: !prev || prev.address !== voter.address,
        isDnc,
        isRecentlyContacted,
        isLocked: isDnc || isRecentlyContacted,
      };
    });
  }, [rawVoters, dncMap, interactionMap, filters?.precinct, sortOrder]);

  useEffect(() => {
    if (interactionMap.size > 0) {
      console.log(
        `PHASE 1 SUCCESS: Found ${interactionMap.size} suppressed voters in this precinct.`,
      );
    }
  }, [interactionMap]);

  // Permission Check
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

  // --- REWARDED & ANALYTICS ACTION HANDLER ---
  const handleContactAction = async (
    type: "sms" | "email" | "phone",
    voter: Voter,
  ) => {
    if (!user?.uid) return;

    const phone = voter.phone_mobile || voter.phone_home;
    const normalizedPhone = phone?.replace(/\D/g, "");
    const protocolUrl =
      type === "sms"
        ? `sms:${normalizedPhone}`
        : type === "phone"
          ? `tel:${normalizedPhone}`
          : `mailto:${voter.email}`;

    try {
      await logVoterContact(voter, type, user.uid);
      await awardPoints(user.uid, type === "phone" ? "sms" : type, 1);
      setIsRewardToast(true);

      // FIX: Change voterName to voter.full_name
      setSnackbarMessage(`+1 point earned for contacting ${voter.full_name}!`);

      setSnackbarOpen(true);
      setTimeout(() => {
        window.location.href = protocolUrl;
      }, 1000);
    } catch (err) {
      // This is defined as 'err'
      // FIX: Change 'e' to 'err' to match the catch block above
      console.error("Failed to log contact:", err);
      window.location.href = protocolUrl;
    }
  };

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.precinct) {
      setSnackbarMessage("Please select a precinct to generate a voter list");
      setSnackbarOpen(true);
      return;
    }
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

  const applyQuickFilter = (presetFilters: Partial<FilterValues>) => {
    setFilters((prev) => {
      const currentPrecinct = prev?.precinct || "";
      return {
        ...presetFilters,
        precinct: currentPrecinct,
      } as FilterValues;
    });
  };

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
        field: "sex",
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
        field: "political_party",
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
        headerName: "Actions",
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
                    onClick={() => handleContactAction("phone", row)}
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
                    onClick={() => handleContactAction("sms", row)}
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
                    onClick={() => handleContactAction("email", row)}
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

  const VoterCard = ({ row }: { row: Voter }) => {
    return (
      <Paper
        elevation={row.isLocked ? 0 : 2}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          opacity: row.isLocked ? 0.6 : 1,
          bgcolor: row.isLocked ? "grey.50" : "background.paper",
          borderLeft: `6px solid ${
            row.isLocked
              ? "grey"
              : row.party === "R"
                ? "#B22234"
                : row.party === "D"
                  ? "#3C3B6E"
                  : "#ccc"
          }`,
        }}
      >
        <Stack spacing={2}>
          {/* Row 1: Name and Metadata */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Box>
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                sx={{ textDecoration: row.isLocked ? "line-through" : "none" }}
              >
                {row.full_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID: {row.voter_id} • Precinct: {row.precinct}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5}>
              <Chip label={row.age || "?"} size="small" variant="outlined" />
              <Chip
                label={row.party || "U"}
                size="small"
                sx={{
                  bgcolor:
                    row.party === "R"
                      ? "error.main"
                      : row.party === "D"
                        ? "info.main"
                        : "grey.400",
                  color: "white",
                  fontWeight: "bold",
                }}
              />
            </Stack>
          </Box>

          {/* Row 2: Address */}
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {row.address}
          </Typography>

          {/* Row 3: Suppression Badges */}
          {(row.isDnc || row.isRecentlyContacted) && (
            <Stack direction="row" spacing={1}>
              {row.isDnc && (
                <Chip
                  label="DNC"
                  size="small"
                  color="error"
                  variant="outlined"
                  icon={<Block sx={{ fontSize: "1rem !important" }} />}
                />
              )}
              {row.isRecentlyContacted && (
                <Chip
                  label="Contacted"
                  size="small"
                  color="success"
                  variant="outlined"
                />
              )}
            </Stack>
          )}

          <Divider />

          {/* Row 4: Static Action Buttons (No Collapse) */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Stack direction="row" spacing={1}>
              <IconButton
                disabled={row.isLocked || !row.email}
                color="primary"
                onClick={() => handleContactAction("email", row)}
                sx={{ border: "1px solid", borderColor: "divider" }}
              >
                <MailOutline />
              </IconButton>
              <IconButton
                disabled={
                  row.isLocked || (!row.phone_mobile && !row.phone_home)
                }
                color="success"
                onClick={() => handleContactAction("phone", row)}
                sx={{ border: "1px solid", borderColor: "divider" }}
              >
                <Phone />
              </IconButton>
              <IconButton
                disabled={row.isLocked || !row.phone_mobile}
                color="info"
                onClick={() => handleContactAction("sms", row)}
                sx={{ border: "1px solid", borderColor: "divider" }}
              >
                <Message />
              </IconButton>
            </Stack>

            {/* Note: VoterNotes is kept separate to handle its own loading state only when opened */}
            <VoterNotes
              voterId={row.voter_id}
              fullName={row.full_name || ""}
              address={row.address || ""}
            />
          </Box>
        </Stack>
      </Paper>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
        Voter Contact List
      </Typography>

      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        demographicFilters={[
          "party",
          "turnout",
          "ageGroup",
          "mailBallot",
          "gender",
        ]}
      />

      {/* QUICK TARGETS / HORIZONTAL SCROLL CONTAINER */}
      <Box sx={{ mt: 2, mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <BoltIcon color="primary" fontSize="small" />
          <Typography
            variant="caption"
            fontWeight="bold"
            color="text.secondary"
            sx={{ textTransform: "uppercase" }}
          >
            Quick Targets
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            overflowX: "auto", // Enables horizontal scrolling
            pb: 1, // Space for the scrollbar so it doesn't cut off the chips
            gap: 1,
            // Hide scrollbar for Chrome, Safari and Opera
            "&::-webkit-scrollbar": { display: "none" },
            // Hide scrollbar for IE, Edge and Firefox
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          {PRESET_FILTERS.map((preset) => {
            const active = isPresetActive(preset.filters);
            const isDisabled = preset.disabled;

            return (
              <Chip
                key={preset.label}
                label={preset.label}
                onClick={
                  isDisabled
                    ? undefined
                    : () => applyQuickFilter(preset.filters)
                }
                onDelete={
                  active
                    ? () => setFilters({ precinct: filters?.precinct })
                    : undefined
                }
                color={active ? "primary" : "default"}
                variant={active ? "filled" : "outlined"}
                disabled={isDisabled}
                sx={{
                  borderRadius: "8px",
                  fontWeight: 600,
                  height: 32,
                  px: 0.5,
                  fontSize: "0.85rem",
                  // This is critical for horizontal scrolling to work
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />

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
              <strong>Carrier Suspension:</strong> Limit messaging to prevent
              spam flagging.
            </Typography>
          </Alert>

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
                Download (CSV)
              </Button>
            </Box>
          )}
          {isMobile ? (
            // --- MOBILE VIEW ---
            <Box sx={{ mt: 2 }}>
              {/* Sort Toggle Row */}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 2, px: 1 }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight="bold"
                >
                  {voters.length} Voters Found
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={
                    <SortIcon
                      sx={{
                        transform:
                          sortOrder === "desc" ? "rotate(180deg)" : "none",
                      }}
                    />
                  }
                  onClick={() =>
                    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                  }
                >
                  {sortOrder === "asc" ? "A-Z" : "Z-A"}
                </Button>
              </Stack>

              {/* The Card List */}
              {voters.map((voter) => (
                <VoterCard key={voter.voter_id} row={voter} />
              ))}
            </Box>
          ) : (
            <Box sx={{ height: 800, width: "100%", mt: 2 }}>
              <DataGrid
                rows={voters}
                getRowId={(row) =>
                  row.voter_id || `${row.address}-${row.full_name}`
                }
                columns={columns}
                rowHeight={70}
                slots={{ toolbar: CustomToolbar }}
                // This is what turns the row grey on desktop
                getRowClassName={(params) =>
                  params.row.isLocked ? "muted-row" : ""
                }
                sx={{
                  borderRadius: 3,
                  boxShadow: 2,
                  border: "none",
                  "& .muted-row": {
                    bgcolor: "grey.50",
                    opacity: 0.6,
                    pointerEvents: "none",
                  },
                }}
              />
            </Box>
          )}
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
