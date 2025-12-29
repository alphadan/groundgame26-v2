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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  TablePagination,
  CircularProgress,
  IconButton,
  Collapse,
  Badge,
  Snackbar,
} from "@mui/material";
import { Phone, Home, ExpandMore, ExpandLess } from "@mui/icons-material";

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

export default function WalkListPage() {
  const { user, isLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [selectedCountyCode, setSelectedCountyCode] = useState<string>("");
  const [selectedAreaDistrict, setSelectedAreaDistrict] = useState<string>("");

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [expandedHouse, setExpandedHouse] = useState<string>("");

  // Notes state: { [address]: { [voter_id]: note[] } }
  const [householdNotes, setHouseholdNotes] = useState<
    Record<string, Record<string, any[]>>
  >({});
  const [loadingNotesFor, setLoadingNotesFor] = useState<string | null>(null);

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Query voters from BigQuery via Cloud Function ===
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

  // === Household grouping ===
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
        city: voters[0]?.city ?? "Unknown",
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

  // === Submit handler ===
  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    setFilters(submittedFilters);
    setPage(0);
  }, []);

  // === Safe phone call ===
  const safeCall = useCallback((phone: string | null | undefined) => {
    if (!phone || typeof phone !== "string") return;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;
      window.location.href = `tel:${normalized}`;
    }
  }, []);

  if (!isLoaded) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="70vh"
      >
        <CircularProgress sx={{ color: "#B22234" }} />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Canvassing Walk List
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Grouped by address for efficient door-knocking.
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
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load walk list. Please try again.
        </Alert>
      )}

      {filters && !isLoading && households.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No voters found matching your filters.
        </Alert>
      )}

      {filters && households.length > 0 && (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ bgcolor: "#0A3161" }}>
              <TableRow>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                  Address
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                  Voters
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ color: "white", fontWeight: "bold" }}
                ></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {households
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((house) => (
                  <React.Fragment key={house.address}>
                    <TableRow
                      hover
                      onClick={() =>
                        setExpandedHouse(
                          expandedHouse === house.address ? "" : house.address
                        )
                      }
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Home color="action" />
                          <Box>
                            <Typography fontWeight="medium">
                              {house.address}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {house.city} {house.zip_code}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Badge badgeContent={house.voters.length} color="error">
                          <Chip label="Registered" size="small" />
                        </Badge>
                      </TableCell>
                      <TableCell align="right">
                        {expandedHouse === house.address ? (
                          <ExpandLess />
                        ) : (
                          <ExpandMore />
                        )}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell colSpan={3} sx={{ py: 0 }}>
                        <Collapse
                          in={expandedHouse === house.address}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box sx={{ p: 3, bgcolor: "#f8f9fa" }}>
                            {house.voters.map((voter: any) => {
                              const voterNotes =
                                householdNotes[house.address]?.[
                                  voter.voter_id
                                ] || [];

                              return (
                                <Box
                                  key={voter.voter_id}
                                  sx={{
                                    py: 2,
                                    borderBottom: 1,
                                    borderColor: "divider",
                                  }}
                                >
                                  <Box
                                    display="flex"
                                    justifyContent="space-between"
                                    alignItems="start"
                                  >
                                    <Box>
                                      <Typography
                                        variant="body1"
                                        fontWeight="medium"
                                      >
                                        {voter.full_name || "Unknown"} (
                                        {voter.age ?? "?"})
                                      </Typography>
                                      <Box display="flex" gap={1} mt={0.5}>
                                        <Chip
                                          label={voter.party || "N/A"}
                                          size="small"
                                          color={
                                            voter.party === "R"
                                              ? "error"
                                              : "primary"
                                          }
                                        />
                                        <Chip
                                          label={`Score: ${
                                            voter.turnout_score_general ?? "?"
                                          }`}
                                          size="small"
                                        />
                                      </Box>
                                    </Box>
                                    {/* New registrant highlight */}
                                    {voter.date_registered &&
                                      (() => {
                                        const regDate = new Date(
                                          voter.date_registered
                                        );
                                        const daysSince =
                                          (Date.now() - regDate.getTime()) /
                                          (1000 * 60 * 60 * 24);
                                        if (daysSince < 180) {
                                          // Registered in last 6 months
                                          return (
                                            <Chip
                                              label="New Registrant"
                                              color="success"
                                              size="small"
                                            />
                                          );
                                        }
                                      })()}

                                    {/* Likely mover */}
                                    {voter.likely_mover && (
                                      <Chip
                                        label="Likely Mover"
                                        color="warning"
                                        size="small"
                                      />
                                    )}

                                    <Box
                                      display="flex"
                                      alignItems="center"
                                      gap={1}
                                    >
                                      {voter.phone_mobile && (
                                        <IconButton
                                          color="success"
                                          onClick={() =>
                                            safeCall(voter.phone_mobile)
                                          }
                                        >
                                          <Phone />
                                        </IconButton>
                                      )}
                                      <VoterNotes
                                        voterId={voter.voter_id}
                                        fullName={voter.full_name || "Unknown"}
                                        address={voter.address || "Unknown"}
                                      />
                                    </Box>
                                  </Box>

                                  {/* Display existing notes */}
                                  {loadingNotesFor === house.address ? (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ ml: 2, mt: 1 }}
                                    >
                                      Loading notes...
                                    </Typography>
                                  ) : voterNotes.length > 0 ? (
                                    <Box mt={2} ml={2}>
                                      <Typography
                                        variant="subtitle2"
                                        color="text.secondary"
                                      >
                                        Notes:
                                      </Typography>
                                      {voterNotes.map((note: any) => (
                                        <Box
                                          key={note.id}
                                          mt={1}
                                          sx={{
                                            bgcolor: "#f5f5f5",
                                            p: 1.5,
                                            borderRadius: 1,
                                          }}
                                        >
                                          <Typography variant="body2">
                                            {note.note}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                          >
                                            — {note.created_by_name} •{" "}
                                            {note.created_at
                                              ? (
                                                  note.created_at.toDate?.() ||
                                                  new Date(note.created_at)
                                                ).toLocaleDateString("en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                                  year: "numeric",
                                                })
                                              : "Unknown date"}
                                          </Typography>
                                        </Box>
                                      ))}
                                    </Box>
                                  ) : null}
                                </Box>
                              );
                            })}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
            </TableBody>
          </Table>

          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={households.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="info">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
