import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";
import { useAuth } from "../../context/AuthContext";
import { db as firestore } from "../../lib/firebase"; // Ensure your firebase config is exported
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Alert,
  useMediaQuery,
  useTheme,
  Chip,
} from "@mui/material";
import { Phone, MailOutline } from "@mui/icons-material";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";

export interface Committeeman {
  id: string;
  display_name?: string;
  email?: string;
  role?: string;
  area_district?: string;
  phone_mobile?: string;
  precinct_name?: string;
  precincts?: string[];
}

interface ManageTeamPageProps {
  isDashboard?: boolean;
}

// Helper to format role names for display badges
const getRoleLabel = (role?: string) => {
  switch (role) {
    case "county_chair":
      return { label: "County Chair", color: "secondary" };
    case "state_rep_district":
      return { label: "District Rep", color: "info" };
    case "area_chair":
      return { label: "Area Chair", color: "primary" };
    case "precinct_committeeperson":
      return { label: "Precinct CP", color: "default" };
    default:
      return { label: role || "Member", color: "default" };
  }
};

function CustomToolbar({ isDashboard }: { isDashboard: boolean }) {
  if (isDashboard) return null;
  return (
    <GridToolbarContainer sx={{ p: 2, justifyContent: "space-between" }}>
      <Typography variant="h6" fontWeight="bold">
        Team Directory
      </Typography>
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}

export default function ManageTeamPage({
  isDashboard = false,
}: ManageTeamPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { claims, isLoaded } = useAuth();

  const [committeemen, setCommitteemen] = useState<Committeeman[]>([]);
  const [loading, setLoading] = useState(true);

  const canView = [
    "developer",
    "state_admin",
    "county_chair",
    "state_rep_district",
    "area_chair",
  ].includes(claims?.role || "");

  const precincts =
    useLiveQuery(async () => {
      try {
        if (!indexedDb.precincts) return [];
        return await indexedDb.precincts.where("active").equals(1).toArray();
      } catch (e) {
        return [];
      }
    }, []) ?? [];

  const precinctLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    precincts.forEach((p) => map.set(p.id, `${p.precinct_code} – ${p.name}`));
    return map;
  }, [precincts]);

  useEffect(() => {
    if (!isLoaded || !canView || !claims) {
      setLoading(false);
      return;
    }

    const loadTeam = async () => {
      setLoading(true);
      try {
        const usersRef = collection(firestore, "users");
        let targetRoles: string[] = [];
        let filterField: "counties" | "areas" | null = null;
        let filterValues: string[] = [];

        const userRole = claims.role;

        // 1. Define Hierarchy Logic
        switch (userRole) {
          case "developer":
            // Developers can see EVERYONE, regardless of role
            targetRoles = [
              "county_chair",
              "state_rep_district",
              "area_chair",
              "committeeperson",
            ];
            break;
          case "state_admin":
            targetRoles = ["county_chair"];
            break;
          case "county_chair":
            targetRoles = ["state_rep_district", "area_chair"];
            filterField = "counties";
            filterValues = claims.counties || [];
            break;
          case "state_rep_district":
            targetRoles = ["area_chair", "committeeperson"];
            filterField = "areas";
            filterValues = claims.areas || [];
            break;
          case "area_chair":
            targetRoles = ["committeeperson"];
            filterField = "areas";
            filterValues = claims.areas || [];
            break;
        }

        if (targetRoles.length === 0) {
          setCommitteemen([]);
          return;
        }

        // 2. Fetch Users by Role
        const q = query(
          usersRef,
          where("role", "in", targetRoles),
          where("active", "==", true),
        );
        const querySnapshot = await getDocs(q);
        const fetchedTeam: Committeeman[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const userAccess = data.access || { counties: [], areas: [] };

          // 3. Geographic Filter Check
          let isMatch = false;

          // DEVELOPER BYPASS: If developer, skip geographic checks
          if (
            userRole === "developer" ||
            !filterField ||
            filterValues.includes("ALL")
          ) {
            isMatch = true;
          } else {
            const userScope =
              filterField === "counties"
                ? userAccess.counties
                : userAccess.areas;
            isMatch = (userScope || []).some((id: string) =>
              filterValues.includes(id),
            );
          }

          if (isMatch) {
            fetchedTeam.push({
              id: doc.id,
              display_name: data.display_name || "Unknown Member",
              email: data.email,
              phone_mobile: data.phone_mobile,
              role: data.role,
              area_district: data.area_district || "",
              precinct_name: data.precinct_name,
              precincts: userAccess.precincts || [],
            });
          }
        });

        setCommitteemen(isDashboard ? fetchedTeam.slice(0, 6) : fetchedTeam);
      } catch (err) {
        console.error("Firestore error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [isLoaded, canView, claims, isDashboard]);

  const columns: GridColDef<Committeeman>[] = [
    {
      field: "display_name",
      headerName: "Member",
      flex: 1,
      minWidth: 180,
      renderCell: (params) => {
        const roleInfo = getRoleLabel(params.row.role);
        return (
          <Stack spacing={0.5} py={1}>
            <Typography variant="body2" fontWeight="bold">
              {params.value}
            </Typography>
            <Chip
              label={roleInfo.label}
              size="small"
              color={roleInfo.color as any}
              variant="outlined"
              sx={{ height: 16, fontSize: "0.65rem", alignSelf: "flex-start" }}
            />
          </Stack>
        );
      },
    },
    {
      field: "area_district",
      headerName: "Area",
      width: 120,
      hideable: true,
      valueGetter: (_value, row: Committeeman) => {
        // Priority 1: Use the explicit area_district field
        if (row.area_district) return row.area_district;

        // Priority 2: Fallback to parsing from the first precinct ID (e.g., "PA15-A-01")
        if (row.precincts && row.precincts.length > 0) {
          const parts = row.precincts[0].split("-");
          if (parts.length >= 3) return parts[parts.length - 1]; // Grabs the "01"
        }

        return "—";
      },
      renderCell: (params) => (
        <Typography variant="caption" color="text.secondary" noWrap>
          {params.value !== "—" ? `Area ${params.value}` : "—"}
        </Typography>
      ),
    },
    {
      field: "precincts",
      headerName: "Precinct",
      flex: 1.2,
      minWidth: isDashboard ? 140 : 200,
      valueGetter: (_, row) => {
        const codes = (row.precincts || [])
          .map((p) => precinctLabelMap.get(p) || p)
          .join(", ");
        return row.precinct_name ? `${row.precinct_name} – ${codes}` : codes;
      },
      renderCell: (params) => (
        <Tooltip title={params.value || ""}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {params.value || "—"}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: "actions",
      headerName: "Contact",
      width: 100,
      sortable: false,
      align: "right",
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          {row.email && (
            <IconButton
              size="small"
              onClick={() => (window.location.href = `mailto:${row.email}`)}
            >
              <MailOutline fontSize="small" />
            </IconButton>
          )}
          {row.phone_mobile && (
            <IconButton
              size="small"
              color="success"
              onClick={() => (window.location.href = `tel:${row.phone_mobile}`)}
            >
              <Phone fontSize="small" />
            </IconButton>
          )}
        </Stack>
      ),
    },
  ];

  if (!isLoaded || loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress size={isDashboard ? 30 : 50} />
      </Box>
    );
  }

  if (!canView)
    return (
      <Alert severity="warning" sx={{ m: isDashboard ? 0 : 4 }}>
        Access Restricted.
      </Alert>
    );

  return (
    <Box sx={{ width: "100%", p: isDashboard ? 0 : { xs: 2, sm: 3 } }}>
      {!isDashboard && (
        <Box mb={4}>
          <Typography
            variant="h4"
            fontWeight="bold"
            color="primary"
            gutterBottom
          >
            Team Directory
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Hierarchical View: {getRoleLabel(claims?.role).label} Scope
          </Typography>
        </Box>
      )}

      <DataGrid
        rows={committeemen}
        columns={columns}
        autoHeight
        getRowHeight={() => "auto"}
        density={isDashboard ? "compact" : "standard"}
        disableRowSelectionOnClick
        hideFooter={isDashboard}
        slots={{ toolbar: () => <CustomToolbar isDashboard={isDashboard} /> }}
        sx={{
          border: isDashboard ? "none" : undefined,
          borderRadius: 3,
          "& .MuiDataGrid-columnHeaders": isDashboard
            ? { display: "none" }
            : { bgcolor: "grey.50" },
          "& .MuiDataGrid-row": { minHeight: "60px !important" },
        }}
      />
    </Box>
  );
}
