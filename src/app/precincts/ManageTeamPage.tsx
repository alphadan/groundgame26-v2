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
  phone_mobile?: string;
  phone_home?: string;
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
            id: "user1",
            display_name: "John Doe",
            email: "john@example.com",
            phone_mobile: "5551234567",
            phone_home: "5559876543",
            precincts: ["PA15-P-225", "PA15-P-230"],
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
    <Box maxWidth={1200} mx="auto" p={4}>
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
