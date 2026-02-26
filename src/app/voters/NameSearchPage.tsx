import React, { useState } from "react";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import { useQuery } from "@tanstack/react-query";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  useTheme,
  useMediaQuery,
  Paper,
  TextField,
  InputAdornment,
  Divider,
} from "@mui/material";
import {
  Phone,
  Message,
  SearchOff,
  Search as SearchIcon,
  Home as HomeIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

export default function NameSearchPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { callFunction } = useCloudFunctions();

  const [geoFilters, setGeoFilters] = useState<any>(null);
  const [searchInput, setSearchInput] = useState("");
  const [triggerSearch, setTriggerSearch] = useState("");

  // --- DATA FETCHING ---
  const { data: voters = [], isLoading } = useQuery({
    queryKey: ["voterSearch", geoFilters, triggerSearch],
    queryFn: async () => {
      if (!triggerSearch || triggerSearch.length < 3) return [];
      const result = await callFunction<{ voters: any[] }>(
        "searchVotersUniversal",
        {
          term: triggerSearch,
          ...geoFilters,
        },
      );
      console.log("🔍 Search Results Raw Data:", result.voters);
      return result.voters ?? [];
    },
    enabled: !!triggerSearch && triggerSearch.length >= 3,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setTriggerSearch(searchInput);
  };

  // --- MOBILE CARD COMPONENT ---
  const VoterCard = ({ row }: { row: any }) => {
    const phone = row.phone_mobile || row.phone_home;
    return (
      <Paper elevation={2} sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Stack spacing={1}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="start"
          >
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                {row.full_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {row.address}
              </Typography>
            </Box>
            <Chip
              label={row.political_party || "U"}
              size="small"
              sx={{
                bgcolor:
                  row.political_party === "R"
                    ? "error.main"
                    : row.party === "D"
                      ? "info.main"
                      : "grey.400",
                color: "white",
                fontWeight: "bold",
              }}
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              variant="caption"
              sx={{ fontWeight: "bold", color: "text.secondary" }}
            >
              Age: {row.age || "?"} • {row.sex || "Unknown"}
            </Typography>
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Stack direction="row" spacing={1}>
              {phone && (
                <IconButton
                  color="success"
                  size="small"
                  onClick={() => (window.location.href = `tel:${phone}`)}
                >
                  <Phone />
                </IconButton>
              )}
              {phone && (
                <IconButton
                  color="info"
                  size="small"
                  onClick={() => (window.location.href = `sms:${phone}`)}
                >
                  <Message />
                </IconButton>
              )}
            </Stack>
            <VoterNotes
              voterId={row.voter_id}
              fullName={row.full_name}
              address={row.address}
            />
          </Stack>
        </Stack>
      </Paper>
    );
  };

  // --- DATAGRID COLUMNS (DESKTOP) ---
  const columns: GridColDef[] = [
    {
      field: "full_name",
      headerName: "Voter",
      flex: 1,
      renderCell: ({ row }) => (
        <Stack sx={{ py: 1 }}>
          <Typography variant="body2" fontWeight="bold">
            {row.full_name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.address}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "age",
      headerName: "Age",
      width: 70,
      align: "center",
      headerAlign: "center",
      renderCell: ({ row }) => (
        <Chip
          label={row.age || "?"}
          size="small"
          variant="outlined"
          sx={{ fontWeight: "bold" }}
        />
      ),
    },
    {
      field: "sex",
      headerName: "Sex",
      width: 70,
      align: "center",
      renderCell: ({ value }) => (
        <Typography
          variant="caption"
          sx={{
            fontWeight: "bold",
            fontSize: "1rem",
            color:
              value === "F"
                ? "primary.light"
                : value === "M"
                  ? "secondary.dark"
                  : "grey.400",
          }}
        >
          {value || ""}
        </Typography>
      ),
    },
    {
      field: "political_party",
      headerName: "Party",
      width: 80,
      renderCell: ({ value }) => (
        <Chip
          label={value || "U"}
          size="small"
          sx={{
            bgcolor:
              value === "R"
                ? "error.main"
                : value === "D"
                  ? "info.main"
                  : "grey.400",
            color: "white",
            fontWeight: "bold",
          }}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Contact",
      width: 150,
      sortable: false,
      renderCell: ({ row }) => {
        const phone = row.phone_mobile || row.phone_home;
        return (
          <Stack direction="row" spacing={1}>
            {phone && (
              <IconButton
                size="small"
                color="success"
                onClick={() => (window.location.href = `tel:${phone}`)}
              >
                <Phone />
              </IconButton>
            )}
            {phone && (
              <IconButton
                size="small"
                color="info"
                onClick={() => (window.location.href = `sms:${phone}`)}
              >
                <Message />
              </IconButton>
            )}
            <VoterNotes
              voterId={row.voter_id}
              fullName={row.full_name}
              address={row.address}
            />
          </Stack>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, margin: "auto" }}>
      <Typography variant="h4" fontWeight="900" color="primary" gutterBottom>
        Voter Search
      </Typography>

      <Box sx={{ mb: 3 }}>
        <FilterSelector
          onSubmit={setGeoFilters}
          isLoading={isLoading}
          demographicFilters={[]}
        />
      </Box>

      <Paper
        component="form"
        onSubmit={handleSearch}
        sx={{
          p: 1,
          display: "flex",
          alignItems: "center",
          mb: 4,
          borderRadius: 3,
          opacity: geoFilters ? 1 : 0.5,
          pointerEvents: geoFilters ? "auto" : "none",
        }}
      >
        <TextField
          fullWidth
          placeholder={
            geoFilters
              ? "Search by Name or Address..."
              : "Select geographic filters first..."
          }
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          variant="standard"
          sx={{ ml: 1, flex: 1 }}
          InputProps={{
            disableUnderline: true,
            startAdornment: (
              <InputAdornment position="start">
                {/^\d/.test(searchInput) ? <HomeIcon /> : <PersonIcon />}
              </InputAdornment>
            ),
          }}
        />
        <IconButton
          type="submit"
          color="primary"
          disabled={searchInput.length < 3}
        >
          <SearchIcon />
        </IconButton>
      </Paper>

      <Box sx={{ minHeight: 400 }}>
        {isLoading ? (
          <Stack alignItems="center" mt={5}>
            <CircularProgress />
          </Stack>
        ) : voters.length > 0 ? (
          // --- RESPONSIVE RENDER ---
          isMobile ? (
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 2, display: "block" }}
              >
                Showing {voters.length} results
              </Typography>
              {voters.map((voter: any) => (
                <VoterCard key={voter.voter_id} row={voter} />
              ))}
            </Box>
          ) : (
            <Paper
              elevation={3}
              sx={{
                height: 600,
                width: "100%",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <DataGrid
                rows={voters}
                columns={columns}
                getRowId={(r) => r.voter_id}
                disableRowSelectionOnClick
              />
            </Paper>
          )
        ) : (
          <Stack alignItems="center" mt={5} sx={{ opacity: 0.5 }}>
            <SearchOff sx={{ fontSize: 64 }} />
            <Typography>
              {triggerSearch
                ? "No matches in this area."
                : "Enter 3+ characters to begin."}
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
