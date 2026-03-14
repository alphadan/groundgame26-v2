import React, { useState, useMemo } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { useAuth } from "../../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { OrgRole, UserProfile } from "../../../types";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";

import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
} from "@mui/material";

import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";

import RoleForm from "./RoleForm";
import AssignUserDialog from "./AssignUserDialog";

export default function ManageRoles() {
  const navigate = useNavigate();
  const { callFunction } = useCloudFunctions();
  const { user, isLoaded: authLoaded } = useAuth();

  // --- 1. STATES ---
  const [open, setOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [unassignConfirmOpen, setUnassignConfirmOpen] = useState(false);
  const [roleToVacate, setRoleToVacate] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isVacating, setIsVacating] = useState(false);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [roleToToggle, setRoleToToggle] = useState<{
    id: string;
    active: boolean;
    role: string;
  } | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // --- 2. DATA HOOKS ---
  const localUser = useLiveQuery(
    async () => (user?.uid ? await indexedDb.users.get(user.uid) : null),
    [user?.uid],
  );
  const isDeveloper = localUser?.role === "developer";

  const {
    data: roles,
    loading: rolesLoading,
    error: crudError,
    fetchAll,
  } = useAdminCRUD<OrgRole>({
    collectionName: "org_roles",
    defaultOrderBy: "role",
  });

  const { data: fullUserMap } = useQuery({
    queryKey: ["userLookupFull"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "users"));
      const mapping: Record<string, UserProfile> = {};
      snap.forEach((doc) => {
        const u = doc.data() as UserProfile;
        mapping[u.uid] = u;
      });
      return mapping;
    },
  });

  // --- 3. COLUMN DEFINITIONS ---
  // --- 3. COLUMN DEFINITIONS ---
  const columns: GridColDef<OrgRole>[] = useMemo(() => {
    const baseColumns: GridColDef<OrgRole>[] = [
      {
        field: "role",
        headerName: "Position Title",
        flex: 1,
        minWidth: 150,
        display: "flex", // Ensures vertical centering in the cell
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 400, textTransform: "uppercase" }}
            >
              {params.value}
            </Typography>
          </Box>
        ),
      },
      {
        field: "uid",
        headerName: "Assigned Personnel",
        flex: 1.5,
        minWidth: 220,
        renderCell: (params) => {
          const uid = params.row.uid;
          // Centers the VACANT chip vertically
          if (params.row.is_vacant || !uid) {
            return (
              <Box
                sx={{ display: "flex", alignItems: "center", height: "100%" }}
              >
                <Chip
                  label="VACANT"
                  size="small"
                  variant="outlined"
                  color="error"
                  sx={{ fontWeight: "bold" }}
                />
              </Box>
            );
          }

          const userObj = fullUserMap?.[uid];
          const isActive = userObj?.active ?? false;

          return (
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ height: "100%", py: 0.5 }} // py: 0.5 adds that small internal padding you mentioned
            >
              {/* Status Indicator */}
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  flexShrink: 0, // Prevents the dot from squishing
                  bgcolor: isActive ? "success.main" : "error.main",
                  boxShadow: isActive
                    ? "0 0 8px rgba(76, 175, 80, 0.4)"
                    : "none",
                }}
              />
              {/* Text Group - Vertically centered as a block */}
              <Stack spacing={0} justifyContent="center">
                <Typography
                  variant="body2"
                  sx={{
                    lineHeight: 1.3,
                    fontWeight: 500,
                    color: "text.primary",
                  }}
                >
                  {userObj?.display_name || "Unknown User"}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    lineHeight: 1.1,
                    color: "text.secondary",
                    display: "block",
                  }}
                >
                  {userObj?.email}
                </Typography>
              </Stack>
            </Stack>
          );
        },
      },
      {
        field: "authority",
        headerName: "Geographic Authority",
        flex: 1.5,
        minWidth: 250,
        renderCell: (params) => {
          const c = params.row.county_id || "--";
          const a = params.row.area_id || "--";
          const p = params.row.precinct_id || "--";
          return (
            <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 500 }}
              >
                C: {c} • A: {a} • P: {p}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: "assignment",
        headerName: "Management",
        width: 150,
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Button
              size="small"
              variant={params.row.is_vacant ? "contained" : "outlined"}
              startIcon={<PersonAddIcon />}
              onClick={() => {
                setSelectedRoleId(params.row.id);
                setAssignDialogOpen(true);
              }}
              sx={{ borderRadius: 2, textTransform: "none", py: 0.5 }}
            >
              {params.row.is_vacant ? "Fill Seat" : "Change"}
            </Button>
          </Box>
        ),
      },
    ];

    // ... (Developer columns logic) ...
    if (isDeveloper) {
      baseColumns.push(
        {
          field: "unassign",
          headerName: "Vacate",
          width: 100,
          sortable: false,
          renderCell: (params) => {
            if (params.row.is_vacant) return null;
            return (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "center",
                }}
              >
                <Tooltip title="Remove user from this position">
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => {
                      const userObj = fullUserMap?.[params.row.uid];
                      setRoleToVacate({
                        id: params.row.id,
                        name: userObj?.display_name || "this user",
                      });
                      setUnassignConfirmOpen(true);
                    }}
                  >
                    <PersonRemoveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            );
          },
        },
        {
          field: "active",
          headerName: "Status",
          width: 130,
          renderCell: (params) => {
            const isActive = params.value;
            return (
              <Box
                sx={{ display: "flex", alignItems: "center", height: "100%" }}
              >
                <Button
                  size="small"
                  variant="text"
                  color={isActive ? "success" : "inherit"}
                  startIcon={isActive ? <ToggleOnIcon /> : <ToggleOffIcon />}
                  onClick={() => {
                    setRoleToToggle({
                      id: params.row.id,
                      active: isActive,
                      role: params.row.role,
                    });
                    setToggleConfirmOpen(true);
                  }}
                  sx={{ fontWeight: "bold" }}
                >
                  {isActive ? "Enabled" : "Disabled"}
                </Button>
              </Box>
            );
          },
        },
      );
    }

    return baseColumns;
  }, [fullUserMap, isDeveloper]);

  if (!authLoaded)
    return <CircularProgress sx={{ m: "20% auto", display: "block" }} />;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, margin: "auto" }}>
      {/* HEADER */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton onClick={() => navigate("/admin")} color="primary">
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Role Administration
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Managing organizational hierarchy and geographic authorities
            </Typography>
          </Box>
        </Stack>

        {isDeveloper && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
            sx={{ borderRadius: 2, px: 3, py: 1.2, fontWeight: "bold" }}
          >
            Define New Position
          </Button>
        )}
      </Box>

      {crudError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {String(crudError)}
        </Alert>
      )}

      <Paper
        elevation={4}
        sx={{
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <DataGrid
          rows={roles}
          columns={columns}
          loading={rolesLoading}
          autoHeight
          disableRowSelectionOnClick
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          pageSizeOptions={[25, 50, 100]}
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 500 },
            },
          }}
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              bgcolor: "grey.50",
              borderBottom: "2px solid",
              borderColor: "divider",
            },
            "& .MuiDataGrid-cell": {
              borderBottom: "1px solid",
              borderColor: "grey.100",
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: "bold",
              color: "text.primary",
            },
          }}
        />
      </Paper>

      {/* DIALOGS (Define, Fill, Vacate, Toggle) */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          Define New Position
        </DialogTitle>
        <DialogContent dividers>
          <RoleForm
            onSuccess={() => {
              setOpen(false);
              fetchAll();
            }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {selectedRoleId && (
        <AssignUserDialog
          open={assignDialogOpen}
          onClose={() => {
            setAssignDialogOpen(false);
            setSelectedRoleId(null);
          }}
          roleId={selectedRoleId}
          onSuccess={() => {
            setAssignDialogOpen(false);
            setSelectedRoleId(null);
            fetchAll();
          }}
        />
      )}

      {/* Vacate Confirmation */}
      <Dialog
        open={unassignConfirmOpen}
        onClose={() => setUnassignConfirmOpen(false)}
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>Vacate Position?</DialogTitle>
        <DialogContent>
          <Typography>
            Remove <strong>{roleToVacate?.name}</strong> from this seat? This
            will immediately revoke their mobile access for this specific
            authority.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setUnassignConfirmOpen(false)}
            disabled={isVacating}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={isVacating}
            onClick={async () => {
              if (!roleToVacate) return;
              setIsVacating(true);
              try {
                await callFunction("adminVacateOrgRole", {
                  roleDocId: roleToVacate.id,
                });
                setUnassignConfirmOpen(false);
                fetchAll();
              } catch (err) {
                console.error(err);
              } finally {
                setIsVacating(false);
                setRoleToVacate(null);
              }
            }}
          >
            {isVacating ? <CircularProgress size={24} /> : "Confirm Vacate"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Toggle Confirmation */}
      <Dialog
        open={toggleConfirmOpen}
        onClose={() => !isToggling && setToggleConfirmOpen(false)}
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          {roleToToggle?.active ? "Disable Position?" : "Enable Position?"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {roleToToggle?.active
              ? "Disabling this seat prevents any user from being assigned to it and pauses active field access."
              : "Enabling this seat makes it available to be filled by personnel."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setToggleConfirmOpen(false)}
            disabled={isToggling}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={roleToToggle?.active ? "error" : "primary"}
            disabled={isToggling}
            onClick={async () => {
              if (!roleToToggle) return;
              setIsToggling(true);
              try {
                await callFunction("adminToggleRoleActive", {
                  roleDocId: roleToToggle.id,
                  active: !roleToToggle.active,
                });
                setToggleConfirmOpen(false);
                fetchAll();
              } catch (err) {
                console.error(err);
              } finally {
                setIsToggling(false);
                setRoleToToggle(null);
              }
            }}
          >
            {isToggling ? (
              <CircularProgress size={24} />
            ) : (
              "Update Availability"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
