import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { DncRecord } from "../../../types";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Stack,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddDisabledIcon from "@mui/icons-material/PersonAddDisabled";

export default function DncManagement() {
  const navigate = useNavigate();
  const { callFunction } = useCloudFunctions();

  // States for Search
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // States for Dialog/Confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<any | null>(null);
  const [dncReason, setDncReason] = useState("");

  // Feedback
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const {
    data: dncList,
    loading: listLoading,
    create,
    fetchAll,
  } = useAdminCRUD<DncRecord>({
    collectionName: "dnc",
    defaultOrderBy: "created_at",
    orderDirection: "desc",
  });

  const handleVoterSearch = async () => {
    if (searchPhone.length < 10) return;
    setIsSearching(true);
    setStatusMsg(null);
    try {
      const result = await callFunction<{ voters: any[] }>(
        "searchVotersByPhoneV2",
        { phone: searchPhone }
      );
      setSearchResults(result.voters);
      if (result.voters.length === 0)
        setStatusMsg({ type: "error", text: "No voter found." });
    } catch (err) {
      setStatusMsg({ type: "error", text: "Search failed." });
    } finally {
      setIsSearching(false);
    }
  };

  // Open dialog to confirm details
  const triggerConfirmation = (voter: any) => {
    setSelectedVoter(voter);
    setDncReason("");
    setConfirmOpen(true);
  };

  // Finalize the database write
  const handleConfirmDnc = async () => {
    if (!selectedVoter) return;
    try {
      await create({
        voter_id: selectedVoter.voter_id,
        phone: selectedVoter.phone_mobile,
        email: selectedVoter.email || "",
        full_name: selectedVoter.full_name,
        reason: dncReason, // Added reason field
        do_not_contact: true,
        created_at: Date.now(),
      });
      setStatusMsg({
        type: "success",
        text: `${selectedVoter.full_name} added to DNC list.`,
      });
      setSearchResults([]);
      setSearchPhone("");
      setConfirmOpen(false);
      fetchAll();
    } catch (err) {
      setStatusMsg({ type: "error", text: "Failed to update DNC list." });
    }
  };

  const columns: GridColDef<DncRecord>[] = useMemo(
    () => [
      { field: "full_name", headerName: "Voter Name", flex: 1 },
      { field: "phone", headerName: "Phone Number", width: 160 },
      { field: "email", headerName: "Email", width: 200 },
      { field: "reason", headerName: "Reason", width: 180 },
      {
        field: "created_at",
        headerName: "Date Blocked",
        width: 150,
        valueFormatter: (value: number) =>
          value ? new Date(value).toLocaleDateString() : "N/A",
      },
    ],
    []
  );

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Tooltip title="Back to Admin">
          <IconButton
            onClick={() => navigate("/admin")}
            color="primary"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Do Not Call Registry
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Database of voters requesting do not call with audit reason
          </Typography>
        </Box>
      </Box>

      {statusMsg && (
        <Alert severity={statusMsg.type} sx={{ mb: 3 }}>
          {statusMsg.text}
        </Alert>
      )}

      {/* Search Input Card */}
      <Paper
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 3,
          bgcolor: "#fcfcfc",
          border: "1px solid #eee",
        }}
      >
        <Typography variant="h6" gutterBottom>
          Find Voter to Block
        </Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Search Phone"
            fullWidth
            size="small"
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
          />
          <Button
            variant="contained"
            startIcon={
              isSearching ? <CircularProgress size={20} /> : <SearchIcon />
            }
            onClick={handleVoterSearch}
            disabled={isSearching || searchPhone.length < 10}
          >
            Find Voter
          </Button>
        </Stack>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <Box sx={{ mt: 3 }}>
            {searchResults.map((voter) => (
              <Card key={voter.voter_id} variant="outlined" sx={{ mb: 1 }}>
                <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        {voter.full_name}
                      </Typography>
                      <Typography variant="body2" color="primary">
                        {voter.phone_mobile}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {voter.voter_id}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      startIcon={<PersonAddDisabledIcon />}
                      onClick={() => triggerConfirmation(voter)}
                    >
                      Block
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Paper>

      {/* DNC List Grid */}
      <Paper elevation={2} sx={{ borderRadius: 3, overflow: "hidden" }}>
        <DataGrid
          rows={dncList}
          columns={columns}
          loading={listLoading}
          autoHeight
        />
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold", color: "error.main" }}>
          Confirm DNC Addition
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                NAME
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {selectedVoter?.full_name}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                PHONE / EMAIL
              </Typography>
              <Typography variant="body1">
                {selectedVoter?.phone_mobile || "N/A"} |{" "}
                {selectedVoter?.email || "No Email"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                VOTER ID
              </Typography>
              <Typography variant="body1">{selectedVoter?.voter_id}</Typography>
            </Box>
            <TextField
              label="Reason for DNC"
              placeholder="e.g. Requested via text, Opted-out via email"
              fullWidth
              multiline
              rows={2}
              value={dncReason}
              onChange={(e) => setDncReason(e.target.value)}
              sx={{ mt: 1 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDnc}
            variant="contained"
            color="error"
            disabled={!dncReason.trim()}
          >
            Confirm Block
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
