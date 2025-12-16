// src/app/admin/ManageTeamPage.tsx — FINAL WITH PAGINATION + INLINE EDITING
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import {
  doc,
  getDoc,
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

const PRECINCTS = [
  { "Precinct Name": "Atglen", "Precinct Id": "005", "Rep Area": "15" },
  {
    "Precinct Name": "East Fallowfield-E",
    "Precinct Id": "225",
    "Rep Area": "15",
  },
  {
    "Precinct Name": "East Fallowfield-W",
    "Precinct Id": "230",
    "Rep Area": "15",
  },
  {
    "Precinct Name": "Highland Township",
    "Precinct Id": "290",
    "Rep Area": "15",
  },
  {
    "Precinct Name": "Parkesburg North",
    "Precinct Id": "440",
    "Rep Area": "15",
  },
  {
    "Precinct Name": "Parkesburg South",
    "Precinct Id": "445",
    "Rep Area": "15",
  },
  { "Precinct Name": "Sadsbury-North", "Precinct Id": "535", "Rep Area": "15" },
  { "Precinct Name": "Sadsbury-South", "Precinct Id": "540", "Rep Area": "15" },
  { "Precinct Name": "West Sadsbury", "Precinct Id": "545", "Rep Area": "15" },
  {
    "Precinct Name": "West Fallowfield",
    "Precinct Id": "235",
    "Rep Area": "15",
  },
];

export default function ManageTeamPage() {
  const [committeemen, setCommitteemen] = useState<any[]>([]);
  const [userMeta, setUserMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const loadUserMeta = async () => {
      try {
        const docSnap = await getDoc(doc(db, "users_meta", currentUser.uid));
        if (docSnap.exists()) {
          setUserMeta(docSnap.data());
        } else {
          setError("User profile not found");
        }
      } catch (err: any) {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    loadUserMeta();
  }, [currentUser]);

  useEffect(() => {
    if (!userMeta || userMeta.role !== "chairman" || userMeta.scope !== "area")
      return;

    const loadCommitteemen = async () => {
      try {
        const q = query(
          collection(db, "users_meta"),
          where("role", "==", "committeeman"),
          where("area_district", "==", userMeta.area_district)
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCommitteemen(list);
      } catch (err: any) {
        setError("Failed to load team: " + err.message);
      }
    };
    loadCommitteemen();
  }, [userMeta]);

  if (!currentUser) return <Typography>Please log in</Typography>;
  if (loading) return <CircularProgress />;
  if (!userMeta || userMeta.role !== "chairman" || userMeta.scope !== "area") {
    return (
      <Alert severity="error">
        Only Area Chairmen can manage team members.
      </Alert>
    );
  }

  const areaDistrict = userMeta.area_district;

  const startEdit = (member: any) => {
    setEditingId(member.id);
    setEditForm({
      display_name: member.display_name || "",
      email: member.email || "",
      precincts: member.precincts || [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (uid: string) => {
    try {
      await updateDoc(doc(db, "users_meta", uid), {
        display_name: editForm.display_name,
        email: editForm.email,
        precincts: editForm.precincts,
      });
      setMessage("Saved!");
      setCommitteemen((prev) =>
        prev.map((m) =>
          m.id === uid
            ? {
                ...m,
                display_name: editForm.display_name,
                email: editForm.email,
                precincts: editForm.precincts,
              }
            : m
        )
      );
      cancelEdit();
    } catch (err: any) {
      setError("Save failed: " + err.message);
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const paginated = committeemen.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box maxWidth={1200} mx="auto" p={4}>
      <Typography variant="h4" gutterBottom color="#d32f2f" fontWeight="bold">
        Manage Committeemen — Area {areaDistrict} ({committeemen.length} total)
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}

      <Paper sx={{ mt: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Precincts</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    {editingId === member.id ? (
                      <TextField
                        value={editForm.display_name}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            display_name: e.target.value,
                          })
                        }
                        size="small"
                        fullWidth
                      />
                    ) : (
                      member.display_name || "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === member.id ? (
                      <TextField
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm({ ...editForm, email: e.target.value })
                        }
                        size="small"
                        fullWidth
                      />
                    ) : (
                      member.email || "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === member.id ? (
                      <FormControl fullWidth size="small">
                        <InputLabel>Precincts</InputLabel>
                        <Select
                          multiple
                          value={editForm.precincts}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              precincts: e.target.value as string[],
                            })
                          }
                        >
                          {PRECINCTS.filter(
                            (p) => p["Rep Area"] === areaDistrict
                          ).map((p) => (
                            <MenuItem
                              key={p["Precinct Id"]}
                              value={p["Precinct Id"]}
                            >
                              {p["Precinct Name"]} ({p["Precinct Id"]})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      member.precincts?.map((p: string) => {
                        const precinct = PRECINCTS.find(
                          (x) => x["Precinct Id"] === p
                        );
                        return (
                          <Chip
                            key={p}
                            label={precinct?.["Precinct Name"] || p}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        );
                      }) || "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === member.id ? (
                      <>
                        <IconButton
                          color="primary"
                          onClick={() => saveEdit(member.id)}
                        >
                          <Save />
                        </IconButton>
                        <IconButton color="inherit" onClick={cancelEdit}>
                          <Cancel />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton
                        color="primary"
                        onClick={() => startEdit(member)}
                      >
                        <Edit />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={committeemen.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>
    </Box>
  );
}
