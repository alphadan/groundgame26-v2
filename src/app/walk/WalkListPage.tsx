// src/app/walk/WalkListPage.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { VoterNotesProps } from "../../types";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  Chip,
  Badge,
} from "@mui/material";

import {
  Phone,
  Home,
  ExpandMore,
  ExpandLess,
  Message,
} from "@mui/icons-material";

import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";

interface FilterValues {
  county: string;
  area: string;
  precinct: string;
  name?: string;
  street?: string;
  modeledParty?: string;
  turnout?: string;
  ageGroup?: string;
  mailBallot?: string;
  zipCode?: string;
}

function CustomToolbar() {
  return (
    <GridToolbarContainer sx={{ p: 2, justifyContent: "space-between" }}>
      <Typography variant="h6" fontWeight="bold">
        Canvassing Walk List
      </Typography>
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}

export default function WalkListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { user, isLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [selectedCountyCode, setSelectedCountyCode] = useState<string>("");
  const [selectedAreaDistrict, setSelectedAreaDistrict] = useState<string>("");

  const [expandedHouse, setExpandedHouse] = useState<string>("");

  // Notes state: { [address]: { [voter_id]: note[] } }
  const [householdNotes, setHouseholdNotes] = useState<
    Record<string, Record<string, any[]>>
  >({});
  const [loadingNotesFor, setLoadingNotesFor] = useState<string | null>(null);

  // Device capabilities
  const canCall =
    "tel:" in window.location || "tel:" in document.createElement("a");
  const canText =
    "sms:" in window.location || "sms:" in document.createElement("a");

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Query voters
  const queryVoters = httpsCallable(functions, "queryVotersDynamic");

  const {
    data: voters = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "walkListVoters",
      filters,
      selectedCountyCode,
      selectedAreaDistrict,
    ],
    queryFn: async () => {
      if (!filters) return [];

      const result = await queryVoters({
        county: selectedCountyCode || undefined,
        area: selectedAreaDistrict || undefined,
        precinct: filters.precinct || undefined,
        name: filters.name || undefined,
        street: filters.street || undefined,
        modeledParty: filters.modeledParty || undefined,
        turnout: filters.turnout || undefined,
        ageGroup: filters.ageGroup || undefined,
        mailBallot: filters.mailBallot || undefined,
        zipCode: filters.zipCode || undefined,
      });

      return (result.data as any)?.voters ?? [];
    },
    enabled: !!filters,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Household grouping
  const households = useMemo(() => {
    const groups: Record<string, any[]> = {};

    voters.forEach((voter: any) => {
      if (!voter || typeof voter !== "object") return;
      const addr = voter.address?.trim() || "Unknown Address";
      if (!groups[addr]) groups[addr] = [];
      groups[addr].push(voter);
    });

    return Object.entries(groups)
      .map(([address, voters]) => ({
        address,
        city: voters[0]?.city ?? "",
        zip_code: voters[0]?.zip_code ?? "",
        voters: voters
          .filter((v): v is any => !!v)
          .sort(
            (a, b) =>
              (b.turnout_score_general ?? 0) - (a.turnout_score_general ?? 0)
          ),
      }))
      .sort((a, b) => a.address.localeCompare(b.address));
  }, [voters]);

  // === Load notes when household expands ===
  useEffect(() => {
    if (!expandedHouse) {
      console.log("No household expanded");
      return;
    }

    console.log("🔍 Expanding household:", expandedHouse);

    const fetchNotesForHousehold = async () => {
      setLoadingNotesFor(expandedHouse);
      console.log("Loading notes for:", expandedHouse);

      try {
        const household = households.find((h) => h.address === expandedHouse);
        console.log("Found household:", household);

        const voterIds = household?.voters
          .map((v) => v.voter_id)
          .filter(Boolean);

        console.log("Voter IDs in household:", voterIds);

        if (!voterIds || voterIds.length === 0) {
          console.log("No voter IDs — skipping note fetch");
          setHouseholdNotes((prev) => ({ ...prev, [expandedHouse]: {} }));
          return;
        }

        console.log(
          "Calling getVoterNotes Cloud Function with voterIds:",
          voterIds
        );

        const getVoterNotes = httpsCallable<
          { voterIds: string[] },
          { notes: any[] }
        >(functions, "getVoterNotes");

        const result = await getVoterNotes({ voterIds });
        console.log("Raw result from getVoterNotes:", result);
        console.log("result.data:", result.data);

        const notes = result.data?.notes || [];
        console.log("Fetched notes:", notes);

        const grouped: Record<string, any[]> = {};
        notes.forEach((note: any) => {
          const vid = note.voter_id || "unknown";
          if (!grouped[vid]) grouped[vid] = [];
          grouped[vid].push(note);
        });

        console.log("Grouped notes:", grouped);

        setHouseholdNotes((prev) => ({ ...prev, [expandedHouse]: grouped }));
        console.log("✅ Notes loaded and set in state");
      } catch (err: any) {
        console.error("❌ Failed to load notes:", err);
        console.error("Error message:", err.message);
        console.error("Error details:", err.details);
        setHouseholdNotes((prev) => ({ ...prev, [expandedHouse]: {} }));
      } finally {
        setLoadingNotesFor(null);
      }
    };

    if (!householdNotes[expandedHouse]) {
      fetchNotesForHousehold();
    } else {
      console.log("Notes already loaded for this household");
    }
  }, [expandedHouse, households]);

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    setFilters(submittedFilters);
    setExpandedHouse("");
  }, []);

  const handleCall = useCallback(
    (phone?: string) => {
      if (!phone || !canCall) return;
      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;
      window.location.href = `tel:${normalized}`;
    },
    [canCall]
  );

  const handleText = useCallback(
    (phone?: string) => {
      if (!phone || !canText) return;
      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;
      window.location.href = `sms:${normalized}`;
    },
    [canText]
  );

  if (!isLoaded) {
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
        Canvassing Walk List
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom mb={4}>
        Optimized for door-to-door: households grouped, high-turnout voters
        first
      </Typography>

      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        unrestrictedFilters={[
          "zipCode",
          "street",
          "modeledParty",
          "turnout",
          "ageGroup",
          "mailBallot",
        ]}
        onCountyCodeChange={setSelectedCountyCode}
        onAreaDistrictChange={setSelectedAreaDistrict}
      />

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          Failed to load walk list. Please try again.
        </Alert>
      )}

      {filters && !isLoading && households.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No households found matching your filters.
        </Alert>
      )}

      {filters && households.length > 0 && (
        <Paper
          sx={{ borderRadius: 3, overflow: "hidden", boxShadow: 4, mt: 4 }}
        >
          <DataGrid
            rows={households}
            getRowId={(row) => row.address}
            columns={[
              {
                field: "address",
                headerName: "Household",
                flex: 2,
                minWidth: 240,
                renderCell: (params) => (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Home color="action" />
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {params.value}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {params.row.city} {params.row.zip_code}
                      </Typography>
                    </Box>
                  </Stack>
                ),
              },
              {
                field: "voters",
                headerName: "Voters",
                width: 120,
                align: "center",
                headerAlign: "center",
                renderCell: (params) => (
                  <Badge badgeContent={params.value.length} color="primary">
                    <Chip label="Registered" size="small" />
                  </Badge>
                ),
              },
              {
                field: "expand",
                headerName: "",
                width: 80,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                renderCell: (params) => (
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedHouse(
                        expandedHouse === params.row.address
                          ? ""
                          : params.row.address
                      );
                    }}
                    size="small"
                  >
                    {expandedHouse === params.row.address ? (
                      <ExpandLess />
                    ) : (
                      <ExpandMore />
                    )}
                  </IconButton>
                ),
              },
            ]}
            slots={{ toolbar: CustomToolbar }}
            hideFooter
            onRowClick={(params) => {
              setExpandedHouse(
                expandedHouse === params.row.address ? "" : params.row.address
              );
            }}
            sx={{
              cursor: "pointer",
              "& .MuiDataGrid-columnHeaders": {
                bgcolor: "secondary.main",
                color: "secondary.contrastText",
                fontWeight: "bold",
              },
              "& .MuiDataGrid-row:hover": {
                bgcolor: "action.hover",
              },
            }}
          />

          {/* Expanded Household Details */}
          {expandedHouse && (
            <Box
              sx={{
                p: 3,
                bgcolor: "grey.50",
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              {(() => {
                const house = households.find(
                  (h) => h.address === expandedHouse
                );
                if (!house) return null;

                return (
                  <Stack spacing={3}>
                    <Typography variant="h6" fontWeight="bold">
                      {house.address} — {house.voters.length} voter
                      {house.voters.length !== 1 ? "s" : ""}
                    </Typography>

                    {house.voters.map((voter: any) => (
                      <Paper
                        key={voter.voter_id}
                        variant="outlined"
                        sx={{ p: 3, borderRadius: 2 }}
                      >
                        <Stack
                          direction={isMobile ? "column" : "row"}
                          spacing={3}
                          alignItems={isMobile ? "flex-start" : "center"}
                          justifyContent="space-between"
                        >
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              {voter.full_name || "Unknown"} ({voter.age ?? "?"}
                              )
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={1}
                              mt={1}
                              flexWrap="wrap"
                              useFlexGap
                            >
                              <Chip
                                label={voter.party || "N/A"}
                                size="small"
                                sx={{
                                  bgcolor:
                                    voter.party === "R"
                                      ? theme.palette.voter.hardR
                                      : voter.party === "D"
                                      ? theme.palette.voter.hardD
                                      : undefined,
                                  color:
                                    voter.party === "R" || voter.party === "D"
                                      ? "#FFFFFF"
                                      : "text.primary",
                                  fontWeight: "bold",
                                }}
                              />
                              <Chip
                                label={`Score: ${
                                  voter.turnout_score_general ?? "?"
                                }`}
                                size="small"
                              />
                              {voter.date_registered &&
                                (() => {
                                  const regDate = new Date(
                                    voter.date_registered
                                  );
                                  const daysSince =
                                    (Date.now() - regDate.getTime()) /
                                    (1000 * 60 * 60 * 24);
                                  return daysSince < 180 ? (
                                    <Chip
                                      label="New Registrant"
                                      color="success"
                                      size="small"
                                    />
                                  ) : null;
                                })()}
                              {voter.likely_mover && (
                                <Chip
                                  label="Likely Mover"
                                  color="warning"
                                  size="small"
                                />
                              )}
                            </Stack>
                          </Box>

                          <Stack direction="row" spacing={1}>
                            {voter.phone_mobile && canCall && (
                              <Tooltip title="Call">
                                <IconButton
                                  color="success"
                                  onClick={() => handleCall(voter.phone_mobile)}
                                >
                                  <Phone />
                                </IconButton>
                              </Tooltip>
                            )}
                            {voter.phone_mobile && canText && (
                              <Tooltip title="Text">
                                <IconButton
                                  color="info"
                                  onClick={() => handleText(voter.phone_mobile)}
                                >
                                  <Message />
                                </IconButton>
                              </Tooltip>
                            )}
                            <VoterNotes
                              voterId={voter.voter_id}
                              fullName={voter.full_name || "Unknown"}
                              address={voter.address || "Unknown"}
                            />
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                );
              })()}
            </Box>
          )}
        </Paper>
      )}

      {/* Initial State */}
      {!filters && (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select a precinct to generate your walk list
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Lists are grouped by household and sorted by turnout score for
            maximum efficiency.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
