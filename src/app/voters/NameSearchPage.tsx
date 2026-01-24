import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import { useQuery } from "@tanstack/react-query";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { useDncMap } from "../../hooks/useDncMap";
import { awardPoints } from "../../services/rewardsService";
import {
  Box,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Stack,
  useTheme,
  useMediaQuery,
  Snackbar,
  Divider,
} from "@mui/material";
import {
  Phone,
  Message,
  Block,
  MailOutline,
  SearchOff,
} from "@mui/icons-material";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";

const REWARD_PURPLE = "#673ab7";

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
  gender?: string; // Added Gender to interface
}

interface Voter {
  voter_id: string;
  full_name?: string;
  address?: string;
  party?: string;
  gender?: string;
  phone_mobile?: string;
  phone_home?: string;
  email?: string;
}

const useDynamicVoters = (filters: FilterValues | null) => {
  const { callFunction } = useCloudFunctions();

  return useQuery({
    queryKey: ["nameSearchVoters", filters],
    queryFn: async (): Promise<Voter[]> => {
      if (!filters || !filters.name || filters.name.trim().length < 3)
        return [];

      try {
        const result = await callFunction<{ voters: Voter[] }>(
          "queryVotersDynamic",
          filters,
        );
        return result.voters ?? [];
      } catch (err) {
        console.error("Name search query failed:", err);
        throw err;
      }
    },
    enabled: !!filters && !!filters.name && filters.name.trim().length >= 3,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export default function NameSearchPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user, isLoaded: authLoaded } = useAuth();
  const dncMap = useDncMap();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [isRewardToast, setIsRewardToast] = useState(false);

  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  const handleContactAction = async (
    type: "sms" | "email" | "phone",
    voterName: string,
    protocolUrl: string,
  ) => {
    if (!user?.uid) return;
    try {
      await awardPoints(user.uid, type === "phone" ? "sms" : type, 1);
      setIsRewardToast(true);
      setSnackbarMessage(`+1 point earned for contacting ${voterName}!`);
      setSnackbarOpen(true);
      setTimeout(() => {
        window.location.href = protocolUrl;
      }, 800);
    } catch (err) {
      window.location.href = protocolUrl;
    }
  };

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.name || submittedFilters.name.trim().length < 3) {
      setIsRewardToast(false);
      setSnackbarMessage("Please enter at least 3 characters to search");
      setSnackbarOpen(true);
      return;
    }
    setFilters(submittedFilters);
  }, []);

  const columns: GridColDef<Voter>[] = useMemo(
    () => [
      {
        field: "full_name",
        headerName: "Voter / Address",
        flex: 1.5,
        minWidth: 200,
        renderCell: (params) => (
          <Stack sx={{ py: 1 }}>
            <Typography variant="body2" fontWeight="bold">
              {params.row.full_name || "Unknown"}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {params.row.address || "No address"}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "gender",
        headerName: "Sex",
        width: 70,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => (
          <Typography variant="body2" fontWeight="bold">
            {params.value || "—"}
          </Typography>
        ),
      },
      {
        field: "party",
        headerName: "Party",
        width: 80,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => (
          <Chip
            label={params.value || "U"}
            size="small"
            sx={{
              fontWeight: "bold",
              bgcolor:
                params.value === "R"
                  ? "#B22234"
                  : params.value === "D"
                    ? "#3C3B6E"
                    : "grey.400",
              color: "white",
              width: 35,
            }}
          />
        ),
      },
      {
        field: "actions",
        headerName: "Contact & Rewards",
        flex: 1,
        minWidth: 180,
        sortable: false,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => {
          const row = params.row;
          const phone = row.phone_mobile || row.phone_home;
          const normalizedPhone = phone?.replace(/\D/g, "") || "";
          const isDnc =
            dncMap.has(row.voter_id) ||
            (normalizedPhone && dncMap.has(normalizedPhone));

          if (isDnc) {
            return (
              <Tooltip title="Do Not Contact">
                <Chip
                  icon={<Block sx={{ fontSize: "14px !important" }} />}
                  label="DNC"
                  color="error"
                  variant="outlined"
                  size="small"
                />
              </Tooltip>
            );
          }

          return (
            <Stack direction="row" spacing={1} alignItems="center">
              {!isMobile && phone && (
                <Typography variant="caption" sx={{ mr: 1 }}>
                  {phone}
                </Typography>
              )}
              {phone && (
                <IconButton
                  size="small"
                  color="success"
                  onClick={() =>
                    handleContactAction(
                      "phone",
                      row.full_name!,
                      `tel:${normalizedPhone}`,
                    )
                  }
                >
                  <Phone fontSize="small" />
                </IconButton>
              )}
              {row.phone_mobile && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() =>
                    handleContactAction(
                      "sms",
                      row.full_name!,
                      `sms:${normalizedPhone}`,
                    )
                  }
                >
                  <Message fontSize="small" />
                </IconButton>
              )}
              {row.email && (
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() =>
                    handleContactAction(
                      "email",
                      row.full_name!,
                      `mailto:${row.email}`,
                    )
                  }
                >
                  <MailOutline fontSize="small" />
                </IconButton>
              )}
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <VoterNotes
                voterId={row.voter_id}
                fullName={row.full_name}
                address={row.address}
              />
            </Stack>
          );
        },
      },
    ],
    [dncMap, isMobile, handleContactAction],
  );

  const CustomToolbar = () => (
    <GridToolbarContainer sx={{ p: 1, justifyContent: "space-between" }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ ml: 1 }}>
        Search Results ({voters.length})
      </Typography>
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );

  if (!authLoaded) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" gutterBottom fontWeight="900" color="primary">
        Name Search
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Search the county database by voter name or address
      </Typography>

      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        demographicFilters={["name", "street", "gender"]} // Added Gender to filters
      />

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          Search failed. Please check your connection and try again.
        </Alert>
      )}

      <Box sx={{ mt: 4, height: 650, width: "100%" }}>
        <DataGrid
          rows={voters}
          columns={columns}
          getRowId={(row) => row.voter_id}
          loading={isLoading}
          slots={{
            toolbar: CustomToolbar,
            noRowsOverlay: () => (
              <Stack
                height="100%"
                alignItems="center"
                justifyContent="center"
                spacing={1}
              >
                <SearchOff sx={{ fontSize: 48, color: "text.disabled" }} />
                <Typography color="text.secondary">
                  {filters
                    ? "No voters found matching those criteria"
                    : "Enter a name above to begin"}
                </Typography>
              </Stack>
            ),
          }}
          getRowHeight={() => "auto"}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          sx={{
            borderRadius: 3,
            boxShadow: 4,
            bgcolor: "background.paper",
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              bgcolor: "grey.100",
              fontWeight: "bold",
            },
            "& .MuiDataGrid-cell": {
              borderBottom: "1px solid",
              borderColor: "grey.200",
              py: 1,
            },
          }}
          slotProps={{
            noRowsOverlay: {
              sx: { height: "100%" },
            },
          }}
        />
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={isRewardToast ? "success" : "info"}
          variant="filled"
          sx={{
            bgcolor: isRewardToast ? REWARD_PURPLE : undefined,
            fontWeight: "bold",
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
