import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { useDncMap } from "../../hooks/useDncMap";
import { awardPoints } from "../../services/rewardsService";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Alert,
  Snackbar,
  Chip,
  useTheme,
  Divider,
  useMediaQuery,
} from "@mui/material";
import { Phone, Message, MailOutline, Block } from "@mui/icons-material";
import { FilterValues } from "../../types";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";

interface Voter {
  voter_id: string;
  full_name?: string;
  age?: number | string;
  party?: string;
  address?: string;
  precinct?: string;
  phone_mobile?: string;
  phone_home?: string;
  email?: string;
}

// Points color constant
const REWARD_PURPLE = "#673ab7";

export default function VoterListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user, isLoaded: authLoaded } = useAuth();
  const dncMap = useDncMap();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [isRewardToast, setIsRewardToast] = useState(false);

  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  // --- REWARDED ACTION HANDLER ---
  const handleContactAction = async (
    type: "sms" | "email" | "phone",
    voterName: string,
    protocolUrl: string,
  ) => {
    if (!user?.uid) return;

    try {
      // Award 1 point for digital outreach
      await awardPoints(user.uid, type === "phone" ? "sms" : type, 1);

      setIsRewardToast(true);
      setSnackbarMessage(`+1 point earned for contacting ${voterName}!`);
      setSnackbarOpen(true);

      // Brief delay so they see the purple toast before the app switches context
      setTimeout(() => {
        window.location.href = protocolUrl;
      }, 1000);
    } catch (err) {
      window.location.href = protocolUrl;
    }
  };

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.precinct) {
      setIsRewardToast(false);
      setSnackbarMessage("Please select a precinct to generate a voter list");
      setSnackbarOpen(true);
      return;
    }
    setFilters(submittedFilters);
  }, []);

  const CustomToolbar = useCallback(
    () => (
      <GridToolbarContainer
        sx={{ p: 2, justifyContent: "space-between", bgcolor: "grey.50" }}
      >
        <Typography variant="h6" fontWeight="bold">
          Voter Contact List
        </Typography>
        <GridToolbarQuickFilter />
      </GridToolbarContainer>
    ),
    [],
  );

  const columns: GridColDef<Voter>[] = useMemo(
    () => [
      {
        field: "full_name",
        headerName: "Voter",
        flex: 1.2,
        minWidth: 180,
        renderCell: ({ row }) => {
          const isDnc = dncMap.has(row.voter_id);
          return (
            <Stack sx={{ py: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography
                  variant="body1"
                  fontWeight="medium"
                  color={isDnc ? "error" : "textPrimary"}
                >
                  {row.full_name || "Unknown"}
                </Typography>
                {isDnc && (
                  <Chip
                    label="DNC"
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ height: 20 }}
                  />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {row.address || "No address on file"}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "party",
        headerName: "Party",
        width: 90,
        renderCell: ({ value }) => (
          <Chip
            label={value || "?"}
            size="small"
            sx={{
              fontWeight: "bold",
              // Original red/blue scheme
              bgcolor:
                value === "R"
                  ? theme.palette.error.main
                  : value === "D"
                    ? theme.palette.info.main
                    : "grey.400",
              color: "white",
            }}
          />
        ),
      },
      {
        field: "contact",
        headerName: "Contact & Rewards",
        width: 220,
        sortable: false,
        renderCell: ({ row }) => {
          const phone = row.phone_mobile || row.phone_home;
          const normalizedPhone = phone?.replace(/\D/g, "");
          const isDnc = dncMap.has(row.voter_id);

          if (isDnc) return <Block color="error" sx={{ mr: 2 }} />;

          return (
            <Stack
              direction="row"
              spacing={1}
              justifyContent="flex-end"
              alignItems="center"
            >
              {(row.phone_mobile || row.phone_home) && !isMobile && (
                <Typography variant="body2">
                  {row.phone_mobile || row.phone_home}
                </Typography>
              )}
              {phone && isMobile && (
                <Tooltip title="Call Voter (+1 pt)">
                  <IconButton
                    size="small"
                    color="success"
                    onClick={() =>
                      handleContactAction(
                        "phone",
                        row.full_name || "Voter",
                        `tel:${normalizedPhone}`,
                      )
                    }
                  >
                    <Phone fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {row.phone_mobile && isMobile && (
                <Tooltip title="Text Voter (+1 pt)">
                  <IconButton
                    size="small"
                    color="info"
                    onClick={() =>
                      handleContactAction(
                        "sms",
                        row.full_name || "Voter",
                        `sms:${normalizedPhone}`,
                      )
                    }
                  >
                    <Message fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {row.email && (
                <Tooltip title="Email Voter (+1 pt)">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() =>
                      handleContactAction(
                        "email",
                        row.full_name || "Voter",
                        `mailto:${row.email}`,
                      )
                    }
                  >
                    <MailOutline fontSize="small" />
                  </IconButton>
                </Tooltip>
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
    [dncMap, theme.palette, handleContactAction],
  );

  if (!authLoaded)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
        Voter Contact List
      </Typography>

      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        demographicFilters={["party", "turnout", "ageGroup", "mailBallot"]}
      />

      {voters.length > 0 && (
        <Box sx={{ height: 800, width: "100%", mt: 4 }}>
          <DataGrid
            rows={voters}
            getRowId={(row) => row.voter_id}
            columns={columns}
            rowHeight={70}
            slots={{ toolbar: CustomToolbar }}
            sx={{ borderRadius: 3, boxShadow: 2, border: "none" }}
          />
        </Box>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          severity={isRewardToast ? "success" : "info"}
          variant="filled"
          sx={{ bgcolor: isRewardToast ? REWARD_PURPLE : undefined }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
