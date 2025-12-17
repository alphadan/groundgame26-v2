// src/app/admin/ManageTeamPage.tsx
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext"; // Integrated Gatekeeper
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
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
  TextField,
  Button,
  Alert,
  Chip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TablePagination,
  CircularProgress,
} from "@mui/material";
import { Edit, Save, Cancel } from "@mui/icons-material";

// Placeholder: In production, fetch these from a 'precincts' collection
const PRECINCTS_FALLBACK = [
  { name: "Atglen", id: "005", area: "15" },
  { name: "East Fallowfield-E", id: "225", area: "15" },
  // ... rest of your list
];

export default function ManageTeamPage() {
  const { user, claims, isLoaded } = useAuth(); // Source of Truth
  const [committeemen, setCommitteemen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Derive permissions from the Gatekeeper
  const userRole = claims?.role;
  const userArea = claims?.area_district || claims?.org_id;
  const canManage =
    userRole === "chairman" ||
    userRole === "admin" ||
    userRole === "state_admin";

  useEffect(() => {
    // 🛑 CRITICAL GATE: Only fetch if the identity is verified and the user has permission
    if (!isLoaded || !canManage) {
      if (isLoaded && !canManage) setLoading(false);
      return;
    }

    const loadTeam = async () => {
      console.log("🚀 Firestore: Fetching team for area:", userArea);
      try {
        const q = query(
          collection(db, "users"),
          where("area_district", "==", userArea),
          where("role", "==", "committeeman")
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCommitteemen(list);
      } catch (err: any) {
        console.error("❌ Team Load Error:", err);
        setError("Failed to load team: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [isLoaded, canManage, userArea]);

  const saveEdit = async (uid: string) => {
    setMessage("");
    setError("");
    try {
      await updateDoc(doc(db, "users", uid), {
        display_name: editForm.display_name,
        email: editForm.email,
        precincts: editForm.precincts,
        updated_at: new Date().toISOString(), // Audit trail
      });

      setCommitteemen((prev) =>
        prev.map((m) => (m.id === uid ? { ...m, ...editForm } : m))
      );
      setMessage("Member updated successfully!");
      setEditingId(null);
    } catch (err: any) {
      setError("Save failed: " + err.message);
    }
  };

  // Rendering Gatekeeper logic
  if (!isLoaded)
    return (
      <Box p={4} textAlign="center">
        <CircularProgress />
      </Box>
    );
  if (!canManage)
    return (
      <Alert severity="error">
        Access Denied: Administrative permissions required.
      </Alert>
    );

  return (
    <Box maxWidth={1200} mx="auto" p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Team Management — Area {userArea}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: "#f5f5f5" }}>
            <TableRow>
              <TableCell>
                <strong>Name</strong>
              </TableCell>
              <TableCell>
                <strong>Email</strong>
              </TableCell>
              <TableCell>
                <strong>Assigned Precincts</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Actions</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {committeemen
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((member) => (
                <TableRow key={member.id} hover>
                  <TableCell>
                    {editingId === member.id ? (
                      <TextField
                        size="small"
                        value={editForm.display_name}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            display_name: e.target.value,
                          })
                        }
                      />
                    ) : (
                      member.display_name || "Unknown"
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === member.id ? (
                      <TextField
                        size="small"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm({ ...editForm, email: e.target.value })
                        }
                      />
                    ) : (
                      member.email
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === member.id ? (
                      <FormControl fullWidth size="small">
                        <Select
                          multiple
                          value={editForm.precincts || []}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              precincts: e.target.value,
                            })
                          }
                          renderValue={(selected) => (
                            <Box
                              sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 0.5,
                              }}
                            >
                              {(selected as string[]).map((value) => (
                                <Chip key={value} label={value} size="small" />
                              ))}
                            </Box>
                          )}
                        >
                          {PRECINCTS_FALLBACK.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                              {p.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      member.precincts?.map((p: string) => (
                        <Chip key={p} label={p} size="small" sx={{ mr: 0.5 }} />
                      )) || "None"
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editingId === member.id ? (
                      <>
                        <IconButton
                          color="primary"
                          onClick={() => saveEdit(member.id)}
                        >
                          <Save />
                        </IconButton>
                        <IconButton onClick={() => setEditingId(null)}>
                          <Cancel />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton
                        color="primary"
                        onClick={() => {
                          setEditingId(member.id);
                          setEditForm(member);
                        }}
                      >
                        <Edit />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25]}
          component="div"
          count={committeemen.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) =>
            setRowsPerPage(parseInt(e.target.value, 10))
          }
        />
      </TableContainer>
    </Box>
  );
}
