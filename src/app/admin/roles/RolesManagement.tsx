// src/app/admin/roles/ManageRoles.tsx
import React, { useState, useMemo } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { useAuth } from "../../../context/AuthContext";
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
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import RoleForm from "./RoleForm";
import AssignUserDialog from "./AssignUserDialog";

export default function ManageRoles() {
  const [open, setOpen] = useState(false);
  const { callFunction } = useCloudFunctions();
  const navigate = useNavigate();

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

  const columns: GridColDef<OrgRole>[] = useMemo(
    () => [
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
          const user = fullUserMap?.[uid];
          const isActive = user?.active ?? false;
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

          const user = fullUserMap?.[uid];
          return user?.display_name || user?.email || "Unknown User";
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
      {
        field: "unassign",
        headerName: "Remove",
        width: 110,
        renderCell: (params) => {
          const uid = params.row.uid;
          if (params.row.is_vacant || !uid) return null;

          const user = fullUserMap?.[uid];
          const assignedUser = user?.display_name || user?.email || "this user";

          return (
            <Button
              size="small"
              color="error"
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
        headerName: "Role Status",
        width: 120,
        renderCell: (params: any) => {
          const isActive = params.value;
          return (
            <Chip
              label={isActive ? "ACTIVE" : "INACTIVE"}
              color={isActive ? "success" : "default"}
              variant={isActive ? "filled" : "outlined"}
              onClick={() => {
                setRoleToToggle({
                  id: params.row.id,
                  active: isActive,
                  role: params.row.role,
                });
                setToggleConfirmOpen(true);
              }}
              sx={{ cursor: "pointer", fontWeight: "bold", width: 90 }}
            />
          );
        },
      },
    ],
    [fullUserMap]
  );

  return (
    <Box sx={{ p: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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
              Define roles for users and manage their geographic permissions
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
          sx={{ borderRadius: 2, px: 3 }}
        >
          Create Position
        </Button>
      </Box>

      <Paper elevation={3} sx={{ borderRadius: 3, overflow: "hidden" }}>
        <DataGrid
          rows={roles}
          columns={columns}
          loading={rolesLoading}
          autoHeight
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          sx={{ border: "none" }}
        />
      </Paper>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Role Position</DialogTitle>
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

      <Dialog
        open={unassignConfirmOpen}
        onClose={() => setUnassignConfirmOpen(false)}
      >
        <DialogTitle>Confirm Removal</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove{" "}
            <strong>{roleToVacate?.name}</strong> from this position?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will immediately revoke their administrative access to this
            precinct/area.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setUnassignConfirmOpen(false)}
            color="inherit"
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
              } catch (err: any) {
                console.error(err);
              } finally {
                setIsVacating(false);
                setRoleToVacate(null);
              }
            }}
          >
            {isVacating ? <CircularProgress size={24} /> : "Confirm Unassign"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={toggleConfirmOpen}
        onClose={() => !isToggling && setToggleConfirmOpen(false)}
      >
        <DialogTitle>
          {roleToToggle?.active ? "Deactivate Position?" : "Activate Position?"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to{" "}
            <strong>{roleToToggle?.active ? "deactivate" : "activate"}</strong>{" "}
            the {roleToToggle?.role.toUpperCase()} position?
          </Typography>
          {roleToToggle?.active && (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              Warning: This will immediately revoke all geographic data access
              for any user currently assigned to this seat.
            </Typography>
          )}
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
                fetchAll(); // Refresh the grid
              } catch (err: any) {
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
              `Confirm ${roleToToggle?.active ? "Deactivation" : "Activation"}`
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
