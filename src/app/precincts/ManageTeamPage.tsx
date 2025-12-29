// src/app/admin/ManageTeamPage.tsx
import React, { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";
import { useAuth } from "../../context/AuthContext";
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
  IconButton,
  TablePagination,
  CircularProgress,
  Alert,
  Snackbar,
} from "@mui/material";
import { Phone, Message, MailOutline } from "@mui/icons-material";

interface Committeeman {
  id: string;
  display_name?: string;
  email?: string;
  role?: string;
  area_district?: string;
  phone_mobile?: string;
  phone_home?: string;
  precinct_name?: string;
  precincts?: string[];
}

export default function ManageTeamPage() {
  const { user, claims, isLoaded } = useAuth();

  const [committeemen, setCommitteemen] = React.useState<Committeeman[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState("");

  // === Permissions ===
  const userRole = claims?.role;
  const canView = userRole === "state_admin"; // Only state admins can view

  // === Load precincts dynamically for display labels ===
  const precincts =
    useLiveQuery(() =>
      indexedDb.precincts.where("active").equals(1).toArray()
    ) ?? [];

  const precinctLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    precincts.forEach((p) => {
      map.set(p.id, `${p.precinct_code} - ${p.name}`);
    });
    return map;
  }, [precincts]);

  // === Load team members ===
  useEffect(() => {
    if (!isLoaded || !canView) {
      setLoading(false);
      return;
    }

    const loadTeam = async () => {
      setLoading(true);
      try {
        // Replace with your actual Firestore query
        const mockTeam: Committeeman[] = [
          // Example data – replace with real query
          {
            id: "user01",
            display_name: "VACANT",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Atglen",
            precincts: ["PA15-P-005"],
          },
          {
            id: "user02",
            display_name: "VACANT",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Atglen",
            precincts: ["PA15-P-005"],
          },
          {
            id: "user03",
            display_name: "Carol Kulp",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "East Fallowfield E",
            precincts: ["PA15-P-225"],
          },
          {
            id: "user04",
            display_name: "Robert Kulp",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "East Fallowfield E",
            precincts: ["PA15-P-225"],
          },
          {
            id: "user05",
            display_name: "Robert Knecht",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "East Fallowfield W",
            precincts: ["PA15-P-230"],
          },
          {
            id: "user06",
            display_name: "Nina Petro",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "East Fallowfield W",
            precincts: ["PA15-P-230"],
          },
          {
            id: "user07",
            display_name: "Dana Young",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Highland",
            precincts: ["PA15-P-290"],
          },
          {
            id: "user08",
            display_name: "Joshua Wall",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Highland",
            precincts: ["PA15-P-290"],
          },
          {
            id: "user10",
            display_name: "Sharon Wolf",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Parkesburg N",
            precincts: ["PA15-P-440"],
          },
          {
            id: "user11",
            display_name: "VACANT",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Parkesburg N",
            precincts: ["PA15-P-440"],
          },
          {
            id: "user12",
            display_name: "VACANT",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Parkesburg S",
            precincts: ["PA15-P-445"],
          },
          {
            id: "user13",
            display_name: "Nick Ohar",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Parkesburg S",
            precincts: ["PA15-P-445"],
          },
          {
            id: "user14",
            display_name: "Brendan Murphy",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Sadsbury N",
            precincts: ["PA15-P-535"],
          },
          {
            id: "user15",
            display_name: "Tricia Daller",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Sadsbury N",
            precincts: ["PA15-P-535"],
          },
          {
            id: "user16",
            display_name: "Richard Felice",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Sadsbury S",
            precincts: ["PA15-P-540"],
          },
          {
            id: "user17",
            display_name: "Joseph Felice",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "Sadsbury S",
            precincts: ["PA15-P-540"],
          },
          {
            id: "user18",
            display_name: "Art Wright",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "W Sadsbury",
            precincts: ["PA15-P-545"],
          },
          {
            id: "user19",
            display_name: "Herbert Myers",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "W Sadsbury",
            precincts: ["PA15-P-545"],
          },
          {
            id: "user20",
            display_name: "Joseph Piazza",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "W Fallowfield",
            precincts: ["PA15-P-235"],
          },
          {
            id: "user20",
            display_name: "Herb Phillips",
            email: "john@example.com",
            phone_mobile: "+16108066875",
            role: "committeeperson",
            area_district: "15",
            precinct_name: "W Fallowfield",
            precincts: ["PA15-P-235"],
          },
          // ... more members
        ];

        setCommitteemen(mockTeam);
      } catch (err: any) {
        console.error("Failed to load team:", err);
        setSnackbarMessage("Failed to load team members");
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [isLoaded, canView]);

  // === Safe contact actions ===
  const safeCall = React.useCallback((phone?: string) => {
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

  const safeText = React.useCallback((phone?: string) => {
    if (!phone || typeof phone !== "string") return;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;
      window.location.href = `sms:${normalized}`;
    }
  }, []);

  const safeEmail = React.useCallback((email?: string) => {
    if (!email || typeof email !== "string") return;
    window.location.href = `mailto:${email}`;
  }, []);

  // === Pagination ===
  const paginatedCommitteemen = useMemo(
    () =>
      committeemen.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [committeemen, page, rowsPerPage]
  );

  // === Loading / Access Guard ===
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

  if (!canView) {
    return (
      <Box p={4}>
        <Alert severity="error">
          Access Denied: State administrator permissions required.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth={1400} mx="auto" p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Team Directory
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Contact your precinct committeepersons directly.
      </Typography>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: "#0A3161" }}>
            <TableRow>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Name
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Email
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Phone
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Precinct Name
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Precincts
              </TableCell>
              <TableCell
                align="right"
                sx={{ color: "white", fontWeight: "bold" }}
              >
                Contact
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedCommitteemen.map((member) => (
              <TableRow key={member.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {member.display_name || "Unknown"}
                  </Typography>
                </TableCell>
                <TableCell>
                  {member.email ? (
                    <Typography variant="body2">{member.email}</Typography>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {member.phone_mobile || member.phone_home || "-"}
                </TableCell>
                <TableCell>{member.precinct_name || "-"}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(member.precincts || []).map((p: string) => (
                      <Chip
                        key={p}
                        label={precinctLabelMap.get(p) || p}
                        size="small"
                      />
                    ))}
                    {(!member.precincts || member.precincts.length === 0) &&
                      "-"}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  {member.email && (
                    <IconButton
                      color="primary"
                      onClick={() => safeEmail(member.email)}
                    >
                      <MailOutline fontSize="small" />
                    </IconButton>
                  )}
                  {(member.phone_mobile || member.phone_home) && (
                    <>
                      <IconButton
                        color="success"
                        onClick={() =>
                          safeCall(member.phone_mobile || member.phone_home)
                        }
                      >
                        <Phone fontSize="small" />
                      </IconButton>
                      {member.phone_mobile && (
                        <IconButton
                          color="info"
                          onClick={() => safeText(member.phone_mobile)}
                        >
                          <Message fontSize="small" />
                        </IconButton>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={committeemen.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

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
