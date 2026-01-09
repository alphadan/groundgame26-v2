// src/app/precincts/ManageTeamPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";
import { useAuth } from "../../context/AuthContext";
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
} from "@mui/material";
import { Phone, Message, MailOutline } from "@mui/icons-material";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";

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

function CustomToolbar() {
  return (
    <GridToolbarContainer sx={{ p: 2, justifyContent: "space-between" }}>
      <Typography variant="h6" fontWeight="bold">
        Precinct Committeepersons
      </Typography>
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}

export default function ManageTeamPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { claims, isLoaded } = useAuth();

  const [committeemen, setCommitteemen] = useState<Committeeman[]>([]);
  const [loading, setLoading] = useState(true);

  const canView =
    claims?.role === "developer" ||
    claims?.role === "state_admin" ||
    claims?.role === "county_chair" ||
    claims?.role === "area_chair";

  const precincts =
    useLiveQuery(() =>
      indexedDb.precincts.where("active").equals(1).toArray()
    ) ?? [];

  const precinctLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    precincts.forEach((p) => {
      map.set(p.id, `${p.precinct_code} – ${p.name}`);
    });
    return map;
  }, [precincts]);

  useEffect(() => {
    if (!isLoaded || !canView) {
      setLoading(false);
      return;
    }

    const loadTeam = async () => {
      setLoading(true);
      try {
        const mockTeam: Committeeman[] = [
          {
            id: "user01",
            display_name: "VACANT",
            precinct_name: "Atglen",
            precincts: ["PA15-P-005"],
          },
          {
            id: "user02",
            display_name: "VACANT",
            precinct_name: "Atglen",
            precincts: ["PA15-P-005"],
          },
          {
            id: "user03",
            display_name: "Carol Kulp",
            email: "carol@example.com",
            phone_mobile: "+16105551234",
            precinct_name: "East Fallowfield E",
            precincts: ["PA15-P-225"],
          },
          {
            id: "user04",
            display_name: "Robert Kulp",
            email: "robert@example.com",
            phone_mobile: "+16105551235",
            precinct_name: "East Fallowfield E",
            precincts: ["PA15-P-225"],
          },
          {
            id: "user05",
            display_name: "Robert Knecht",
            phone_mobile: "+16105551236",
            precinct_name: "East Fallowfield W",
            precincts: ["PA15-P-230"],
          },
          {
            id: "user06",
            display_name: "Nina Petro",
            phone_mobile: "+16105551237",
            precinct_name: "East Fallowfield W",
            precincts: ["PA15-P-230"],
          },
          {
            id: "user07",
            display_name: "Dana Young",
            precinct_name: "Highland",
            precincts: ["PA15-P-290"],
          },
          {
            id: "user08",
            display_name: "Joshua Wall",
            precinct_name: "Highland",
            precincts: ["PA15-P-290"],
          },
          {
            id: "user10",
            display_name: "Sharon Wolf",
            precinct_name: "Parkesburg N",
            precincts: ["PA15-P-440"],
          },
          {
            id: "user11",
            display_name: "VACANT",
            precinct_name: "Parkesburg N",
            precincts: ["PA15-P-440"],
          },
          {
            id: "user12",
            display_name: "VACANT",
            precinct_name: "Parkesburg S",
            precincts: ["PA15-P-445"],
          },
          {
            id: "user13",
            display_name: "Nick Ohar",
            precinct_name: "Parkesburg S",
            precincts: ["PA15-P-445"],
          },
          {
            id: "user14",
            display_name: "Brendan Murphy",
            precinct_name: "Sadsbury N",
            precincts: ["PA15-P-535"],
          },
          {
            id: "user15",
            display_name: "Tricia Daller",
            precinct_name: "Sadsbury N",
            precincts: ["PA15-P-535"],
          },
          {
            id: "user16",
            display_name: "Richard Felice",
            precinct_name: "Sadsbury S",
            precincts: ["PA15-P-540"],
          },
          {
            id: "user17",
            display_name: "Joseph Felice",
            precinct_name: "Sadsbury S",
            precincts: ["PA15-P-540"],
          },
          {
            id: "user18",
            display_name: "Art Wright",
            precinct_name: "W Sadsbury",
            precincts: ["PA15-P-545"],
          },
          {
            id: "user19",
            display_name: "Herbert Myers",
            precinct_name: "W Sadsbury",
            precincts: ["PA15-P-545"],
          },
          {
            id: "user20",
            display_name: "Joseph Piazza",
            precinct_name: "W Fallowfield",
            precincts: ["PA15-P-235"],
          },
          {
            id: "user21",
            display_name: "Herb Phillips",
            precinct_name: "W Fallowfield",
            precincts: ["PA15-P-235"],
          },
        ];

        setCommitteemen(mockTeam);
      } catch (err) {
        console.error("Failed to load team:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [isLoaded, canView]);

  const handleCall = (phone?: string) => {
    if (!phone) return;
    const cleaned = phone.replace(/\D/g, "");
    const normalized =
      cleaned.length === 11 && cleaned.startsWith("1")
        ? cleaned
        : "1" + cleaned;
    window.location.href = `tel:${normalized}`;
  };

  const handleText = (phone?: string) => {
    if (!phone) return;
    const cleaned = phone.replace(/\D/g, "");
    const normalized =
      cleaned.length === 11 && cleaned.startsWith("1")
        ? cleaned
        : "1" + cleaned;
    window.location.href = `sms:${normalized}`;
  };

  const handleEmail = (email?: string) => {
    if (!email) return;
    window.location.href = `mailto:${email}`;
  };

  // Detect if device can make phone calls or send SMS
  const canCall =
    "tel:" in window.location || "tel:" in document.createElement("a");
  const canText =
    "sms:" in window.location || "sms:" in document.createElement("a");

  const columns: GridColDef<Committeeman>[] = [
    {
      field: "display_name",
      headerName: "Name",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Typography
          fontWeight={params.value === "VACANT" ? "normal" : "medium"}
        >
          {params.value || "VACANT"}
        </Typography>
      ),
    },
    {
      field: "precincts",
      headerName: "Precinct",
      flex: 1.5,
      minWidth: 240,
      valueGetter: (_value, row) => {
        const precinctName = row.precinct_name || "";
        const precincts = row.precincts || [];
        if (precincts.length === 0) return "—";

        const codeLabels = precincts
          .map((p) => precinctLabelMap.get(p) || p)
          .join(", ");

        return precinctName ? `${precinctName} – ${codeLabels}` : codeLabels;
      },
      renderCell: (params) => {
        const label = params.value || "—";
        if (label === "—")
          return <Typography color="text.secondary">—</Typography>;

        const displayLabel =
          isMobile && label.includes(",") ? label.split(", ")[0] + "…" : label;

        return (
          <Tooltip title={label}>
            <Typography variant="body2" noWrap>
              {displayLabel}
            </Typography>
          </Tooltip>
        );
      },
    },
    {
      field: "actions",
      headerName: "Contact",
      width: 160,
      align: "right",
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          {row.email && (
            <Tooltip title="Email">
              <IconButton size="small" onClick={() => handleEmail(row.email)}>
                <MailOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {(row.phone_mobile || row.phone_home) && canCall && (
            <Tooltip title="Call">
              <IconButton
                size="small"
                onClick={() => handleCall(row.phone_mobile || row.phone_home)}
              >
                <Phone fontSize="small" color="success" />
              </IconButton>
            </Tooltip>
          )}
          {row.phone_mobile && canText && (
            <Tooltip title="Text">
              <IconButton
                size="small"
                onClick={() => handleText(row.phone_mobile)}
              >
                <Message fontSize="small" color="info" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  if (!isLoaded) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", my: 8 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!canView) {
    return (
      <Alert severity="warning" sx={{ m: 4 }}>
        You do not have permission to view the team directory.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", my: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Team Directory
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Contact your precinct committeepersons directly.
      </Typography>

      {/* Auto-height DataGrid — fits content perfectly */}
      <DataGrid
        rows={committeemen}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 10 },
          },
        }}
        pageSizeOptions={[10, 25, 50]}
        autoHeight // ← This makes the grid height fit the rows exactly
        disableRowSelectionOnClick
        slots={{ toolbar: CustomToolbar }}
        sx={{
          "& .MuiDataGrid-columnHeaders": {
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontWeight: "bold",
          },
          "& .MuiDataGrid-row:hover": {
            bgcolor: "action.hover",
          },
          borderRadius: 3,
          boxShadow: 3,
          // Remove fixed height, let autoHeight handle it
        }}
      />
    </Box>
  );
}
