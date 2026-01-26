import React, { useState, useMemo, useEffect } from "react";
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import SecurityIcon from "@mui/icons-material/Security";
import RoleForm from "./RoleForm";
import AssignUserDialog from "./AssignUserDialog";

export default function ManageRoles() {
  const [open, setOpen] = useState(false);
  const { callFunction } = useCloudFunctions();
  const navigate = useNavigate();

  const { user, isLoaded: authLoaded } = useAuth();

  // 1. Reactive Developer Check from IndexedDB
  const localUser = useLiveQuery(
    async () => (user?.uid ? await indexedDb.users.get(user.uid) : null),
    [user?.uid],
  );
  const isDeveloper = localUser?.role === "developer";

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

  // 2. Memoized and Guarded Columns
  const columns: GridColDef<OrgRole>[] = useMemo(() => {
    const baseColumns: GridColDef<OrgRole>[] = [
      {
        field: "userStatus",
        headerName: "Status",
        width: 110,
        renderCell: (params) => {
          const uid = params.row.uid;
          if (params.row.is_vacant || !uid) {
            return (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: "grey.400",
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  Vacant
                </Typography>
              </Box>
            );
          }
          const userObj = fullUserMap?.[uid];
          const isActive = userObj?.active ?? false;
          return (
            <Tooltip title={isActive ? "Account Active" : "Account Disabled"}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: isActive ? "success.main" : "error.main",
                    boxShadow: isActive ? "0 0 6px #4caf50" : "none",
                  }}
                />
                <Typography variant="caption">
                  {isActive ? "Active" : "Disabled"}
                </Typography>
              </Box>
            </Tooltip>
          );
        },
      },
      { field: "role", headerName: "Role Type", width: 160 },
      {
        field: "uid",
        headerName: "Assigned To",
        width: 200,
        renderCell: (params) => {
          const uid = params.value;
          if (params.row.is_vacant || !uid)
            return (
              <Chip
                label="VACANT"
                color="error"
                size="small"
                variant="outlined"
              />
            );
          const userObj = fullUserMap?.[uid];
          return userObj?.display_name || userObj?.email || "Unknown User";
        },
      },
      { field: "county_id", headerName: "County", width: 110 },
      { field: "area_id", headerName: "Area", width: 110 },
      { field: "precinct_id", headerName: "Precinct", width: 120 },
      {
        field: "actions",
        headerName: "Assignment",
        width: 140,
        renderCell: (params) => (
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSelectedRoleId(params.row.id);
              setAssignDialogOpen(true);
            }}
          >
            {params.row.is_vacant ? "Assign" : "Reassign"}
          </Button>
        ),
      },
    ];

    // 3. Developer-Only Columns
    if (isDeveloper) {
      baseColumns.push(
        {
          field: "unassign",
          headerName: "Revoke Access",
          width: 130,
          renderCell: (params) => {
            const uid = params.row.uid;
            if (params.row.is_vacant || !uid) return null;
            const userObj = fullUserMap?.[uid];
            const assignedUser =
              userObj?.display_name || userObj?.email || "this user";
            return (
              <Button
                size="small"
                color="error"
                variant="text"
                onClick={() => {
                  setRoleToVacate({ id: params.row.id, name: assignedUser });
                  setUnassignConfirmOpen(true);
                }}
              >
                Unassign
              </Button>
            );
          },
        },
        {
          field: "active",
          headerName: "Global Status",
          width: 140,
          renderCell: (params) => {
            const isActive = params.value;
            return (
              <Chip
                label={isActive ? "ENABLED" : "DISABLED"}
                color={isActive ? "success" : "default"}
                size="small"
                onClick={() => {
                  setRoleToToggle({
                    id: params.row.id,
                    active: isActive,
                    role: params.row.role,
                  });
                  setToggleConfirmOpen(true);
                }}
                sx={{ fontWeight: "bold", width: 100 }}
              />
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
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 4,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            onClick={() => navigate("/admin")}
            color="primary"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Manage Roles
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Assign field permissions and geographic authorities
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={2}>
          {isDeveloper && (
            <Chip
              icon={<SecurityIcon />}
              label="Developer Mode"
              color="secondary"
              variant="filled"
            />
          )}
          {isDeveloper && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpen(true)}
              sx={{ borderRadius: 2 }}
            >
              Create Position
            </Button>
          )}
        </Stack>
      </Box>

      {crudError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof crudError === "string"
            ? crudError
            : (crudError as any).message}
        </Alert>
      )}

      <Paper elevation={3} sx={{ borderRadius: 3, overflow: "hidden" }}>
        <DataGrid
          rows={roles}
          columns={columns}
          loading={rolesLoading}
          autoHeight
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          sx={{ border: "none" }}
        />
      </Paper>

      {/* DIALOGS */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Define New Position</DialogTitle>
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

      {/* Unassign Confirmation */}
      <Dialog
        open={unassignConfirmOpen}
        onClose={() => setUnassignConfirmOpen(false)}
      >
        <DialogTitle>Revoke Position?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove{" "}
            <strong>{roleToVacate?.name}</strong> from this position?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This will immediately disconnect their mobile app from the cloud
            database.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
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
            {isVacating ? <CircularProgress size={24} /> : "Confirm Revoke"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toggle Confirmation */}
      <Dialog
        open={toggleConfirmOpen}
        onClose={() => !isToggling && setToggleConfirmOpen(false)}
      >
        <DialogTitle>
          {roleToToggle?.active ? "Deactivate Position?" : "Activate Position?"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            Confirm {roleToToggle?.active ? "deactivation" : "activation"} of
            the {roleToToggle?.role.toUpperCase()} seat.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
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
            {isToggling ? <CircularProgress size={24} /> : "Update Status"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
