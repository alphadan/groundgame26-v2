// src/app /voters /WalkListPage.tsx;
import React, { useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  useTheme,
  useMediaQuery,
  Snackbar,
  Chip,
} from "@mui/material";
import {
  Phone,
  Message,
  AddComment,
  Download as DownloadIcon,
  MailOutline,
} from "@mui/icons-material";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../lib/firebase";
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
function CustomToolbar() {
  return (
    <GridToolbarContainer sx={{ p: 2, justifyContent: "space-between" }}>
      <Typography variant="h6" fontWeight="bold">
        Walk List
      </Typography>
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}
export default function WalkListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user, isLoaded: authLoaded } = useAuth();
  const [filters, setFilters] = useState<FilterValues | null>(null); // Note dialog
  const [openNote, setOpenNote] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false); // Snackbar for feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);
  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.precinct) {
      setSnackbarMessage("Please select a precinct to generate a walk list");
      setSnackbarOpen(true);
      return;
    }
    setFilters(submittedFilters);
  }, []);
  const canCall = isMobile;
  const canText = isMobile; // handleCall with Snackbar
  const handleCall = useCallback(
    (phone?: string) => {
      if (!phone || !canCall) return;
      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;

      setSnackbarMessage("Opening Phone app — tap back when finished!");
      setSnackbarOpen(true);

      setTimeout(() => {
        window.location.href = `tel:${normalized}`;
      }, 2000);
    },
    [canCall]
  ); // handleText with Snackbar
  const handleText = useCallback(
    async (phone?: string) => {
      if (!phone || !canText) return;
      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;

      let messageBody = "";

      try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText.trim()) {
          messageBody = clipboardText.trim();
        }
      } catch (err) {
        console.log("Clipboard access denied or empty");
      }

      setSnackbarMessage("Opening Messages app — swipe right to return!");
      setSnackbarOpen(true);

      setTimeout(() => {
        window.location.href = `sms:${normalized}?body=${encodeURIComponent(
          messageBody
        )}`;
      }, 2000);
    },
    [canText]
  );
  const handleAddNote = useCallback(async () => {
    if (!user || !selectedVoter || !noteText.trim() || !filters?.precinct)
      return;
    setNoteSaving(true);
    try {
      await addDoc(collection(db, "voter_notes"), {
        voter_id: selectedVoter.voter_id ?? null,
        precinct: filters.precinct,
        full_name: selectedVoter.full_name ?? "Unknown",
        address: selectedVoter.address ?? "Unknown",
        note: noteText.trim(),
        created_by_uid: user.uid,
        created_by_name:
          user.displayName || user.email?.split("@")[0] || "User",
        created_at: Date.now(),
      });

      setSnackbarMessage("Note saved successfully");
      setSnackbarOpen(true);
      setNoteText("");
      setOpenNote(false);
      setSelectedVoter(null);
    } catch (err) {
      console.error("Note save failed:", err);
      setSnackbarMessage("Failed to save note");
      setSnackbarOpen(true);
    } finally {
      setNoteSaving(false);
    }
  }, [user, selectedVoter, noteText, filters?.precinct]);
  const handleDownloadCSV = useCallback(() => {
    if (!voters || voters.length === 0) return;
    const headers = [
      "Full Name",
      "Age",
      "Party",
      "Address",
      "City",
      "Zip Code",
      "Phone Mobile",
      "Phone Home",
      "Email",
      "Precinct",
      "Modeled Party",
      "Turnout Score",
      "Has Mail Ballot",
    ];

    const rows = voters.map((voter: any) => [
      voter.full_name || "",
      voter.age || "",
      voter.party || "",
      voter.address || "",
      voter.city || "",
      voter.zip_code || "",
      voter.phone_mobile || "",
      voter.phone_home || "",
      voter.email || "",
      voter.precinct || "",
      voter.modeled_party || "",
      voter.turnout_score_general || "",
      voter.has_mail_ballot ? "Yes" : "No",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `walk_list_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSnackbarMessage(`Downloaded ${voters.length} voters as CSV`);
    setSnackbarOpen(true);
  }, [voters]);
  const columns: GridColDef<Voter>[] = [
    {
      field: "full_name",
      headerName: "Voter",
      flex: 1.2,
      minWidth: 180,
      renderCell: ({ row }) => (
        <Stack>
          <Typography variant="body1" fontWeight="medium">
            {row.full_name || "Unknown"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {row.address || "No address on file"}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "age",
      headerName: "Age",
      width: 80,
      align: "center",
      headerAlign: "center",
      valueGetter: (_value, row) => row.age ?? "?",
    },
    {
      field: "party",
      headerName: "Party",
      width: 100,
      align: "center",
      headerAlign: "center",
      renderCell: ({ value }) => (
        <Chip
          label={value || "N/A"}
          size="small"
          sx={{
            minWidth: 60,
            bgcolor:
              value === "R"
                ? theme.palette.voter.hardR
                : value === "D"
                ? theme.palette.voter.hardD
                : undefined,
            color: value === "R" || value === "D" ? "#FFFFFF" : "text.primary",
            fontWeight: "bold",
          }}
        />
      ),
    },
    {
      field: "precinct",
      headerName: "Precinct",
      flex: 1,
      minWidth: 140,
      valueGetter: (_value, row) => row.precinct || "—",
    },
    {
      field: "contact",
      headerName: "Contact",
      width: 220,
      align: "right",
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          {/* Phone Call */}
          {(row.phone_mobile || row.phone_home) && isMobile && (
            <Tooltip title="Call">
              <IconButton
                size="small"
                color="success"
                onClick={() => handleCall(row.phone_mobile || row.phone_home)}
              >
                <Phone fontSize="small" />
              </IconButton>
            </Tooltip>
          )}{" "}
          {/* Text Message */}
          {row.phone_mobile && isMobile && (
            <Tooltip title="Text">
              <IconButton
                size="small"
                color="info"
                onClick={() => handleText(row.phone_mobile)}
              >
                <Message fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {/* Email Icon */}
          {row.email && (
            <Tooltip title={`Email: ${row.email}`}>
              <IconButton
                size="small"
                color="info"
                component="a"
                href={`mailto:${row.email}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MailOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
    {
      field: "note",
      headerName: "Note",
      width: 100,
      align: "center",
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => (
        <VoterNotes
          voterId={row.voter_id}
          fullName={row.full_name}
          address={row.address}
        />
      ),
    },
  ];
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
      {/* Header */}
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Walk Lists
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Generate targeted walk lists for door-to-door canvassing
      </Typography>{" "}
      {/* Filter Selector */}
      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        unrestrictedFilters={["zipCode", "street", "party", "turnout", "ageGroup", "mailBallot"]}
      />
      {/* Results */}
      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          Failed to load voters. Please try again.
        </Alert>
      )}
      {filters && !isLoading && voters.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No voters found matching your filters. Try adjusting your criteria.
        </Alert>
      )}
      {filters && voters.length > 0 && (
        <>
          {/* Download Button */}
          <Box sx={{ textAlign: "right", mt: 5, mb: 4 }}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadCSV}
              size="large"
              sx={{ fontWeight: "bold", px: 4 }}
            >
              Download CSV ({voters.length} voters)
            </Button>
          </Box>

          {/* DataGrid */}
          <Box sx={{ height: { xs: 700, md: 800 }, width: "100%" }}>
            <DataGrid
              rows={voters}
              getRowId={(row) => row.voter_id}
              columns={columns}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              disableRowSelectionOnClick
              slots={{ toolbar: CustomToolbar }}
              sx={{
                "& .MuiDataGrid-columnHeaders": {
                  bgcolor: "secondary.main",
                  color: "secondary.contrastText",
                  fontWeight: "bold",
                },
                "& .MuiDataGrid-row:hover": {
                  bgcolor: "action.hover",
                },
                borderRadius: 3,
                boxShadow: 4,
              }}
            />
          </Box>
        </>
      )}
      {/* Initial State */}
      {!filters && (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select filters to generate a walk list
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Choose a precinct and any additional targeting criteria above.
          </Typography>
        </Box>
      )}
      {/* Snackbar for call/text hints and notes */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="info"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
