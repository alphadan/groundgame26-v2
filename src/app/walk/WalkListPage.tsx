// src/app/walk/WalkListPage.tsx
import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
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
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";

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
  const [showReturnHint, setShowReturnHint] = useState<boolean>(false);

  const [expandedHouse, setExpandedHouse] = useState<string>("");

  // Device capabilities
  const canCall = isMobile;
  const canText = isMobile;

  const handleCall = useCallback(
    (phone?: string) => {
      setShowReturnHint(true);
      if (!phone || !canCall) return;
      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;
      setTimeout(() => {
        window.location.href = `tel:${normalized}`;
      }, 1500);
      setShowReturnHint(false);
    },
    [canCall]
  );

  const handleText = useCallback(
    async (phone?: string) => {
      if (!phone || !canText) return;

      setShowReturnHint(true);

      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;

      let messageBody = "";

      try {
        // Try to read from clipboard
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText.trim()) {
          messageBody = clipboardText.trim();
        }
      } catch (err) {
        console.log("Clipboard access denied or empty — using default message");
      }

      // Open SMS with the message
      setTimeout(() => {
        window.location.href = `sms:${normalized}?body=${encodeURIComponent(
          messageBody
        )}`;
      }, 1500);

      setShowReturnHint(false);
    },
    [canText]
  );

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

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    setFilters(submittedFilters);
    setExpandedHouse("");
  }, []);

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

      {showReturnHint && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bgcolor: "primary.main",
            color: "white",
            p: 2,
            textAlign: "center",
            zIndex: 9999,
          }}
        >
          Opening Messages... Tap back when finished!
        </Box>
      )}

      {filters && households.length > 0 && (
        <Paper sx={{ borderRadius: 3, overflow: "hidden", boxShadow: 4 }}>
          <DataGrid
            rows={households}
            getRowId={(row) => row.address}
            columns={[
              {
                field: "address",
                headerName: "Household",
                flex: 2,
                minWidth: 280,
                renderCell: (params) => (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Home color="action" />
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {params.value}
                      </Typography>
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
                      const newExpanded =
                        expandedHouse === params.row.address
                          ? ""
                          : params.row.address;
                      setExpandedHouse(newExpanded);
                      if (newExpanded) {
                        setTimeout(() => {
                          document
                            .getElementById(`household-${newExpanded}`)
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                        }, 100);
                      }
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
              const newExpanded =
                expandedHouse === params.row.address ? "" : params.row.address;
              setExpandedHouse(newExpanded);
              if (newExpanded) {
                setTimeout(() => {
                  document
                    .getElementById(`household-${newExpanded}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }
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
              id={`household-${expandedHouse}`}
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
                            {/* Show phone number on desktop */}
                            {!isMobile &&
                              (voter.phone_mobile || voter.phone_home) && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {voter.phone_mobile ||
                                    voter.phone_home ||
                                    "-"}
                                </Typography>
                              )}
                            {/* Show icons only on mobile */}
                            {isMobile && voter.phone_mobile && (
                              <Tooltip title="Opens Phone app — tap back arrow in top-left to return">
                                <IconButton
                                  color="success"
                                  onClick={() => handleCall(voter.phone_mobile)}
                                >
                                  <Phone />
                                </IconButton>
                              </Tooltip>
                            )}
                            {isMobile && voter.phone_mobile && (
                              <Tooltip title="Opens Messages app — tap back arrow in top-left to return">
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
