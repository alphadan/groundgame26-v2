import React, { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../lib/firebase";
import { FilterSelector } from "../../../components/FilterSelector";
import {
  Box,
  Typography,
  Grid,
  TablePagination,
  Button,
  CircularProgress,
  Chip,
  Stack,
  Paper,
  Divider,
} from "@mui/material";
import {
  Download as DownloadIcon,
  Verified as VerifiedIcon,
} from "@mui/icons-material";
import { CampaignResource } from "../../../types";

// Note: Ensure CampaignResource type includes: verified_by_role?: string;
interface DownloadCenterProps {
  resources?: CampaignResource[];
  onNotify: (message: string) => void;
}

/**
 * DownloadCenter Component
 * Handles geographic-based resource filtering with independent category pagination.
 */
export const DownloadCenter: React.FC<DownloadCenterProps> = ({ onNotify }) => {
  const [loading, setLoading] = useState(false);

  // States typed with Index Signatures to prevent "No index signature" errors
  const [categorized, setCategorized] = useState<Record<
    string,
    CampaignResource[]
  > | null>(null);
  const [pageSettings, setPageSettings] = useState<
    Record<string, { page: number; size: number }>
  >({});

  const handleDownload = (title: string, url: string) => {
    window.open(url, "_blank");
    onNotify(`Opening ${title}...`);
  };

  const handleFetch = async (filters: any) => {
    setLoading(true);
    try {
      const getResources = httpsCallable(functions, "getResourcesByLocation");
      const result: any = await getResources(filters);

      const data = result.data.categorized;
      setCategorized(data);

      // Initialize unique pagination state for every category found
      const initialPages: Record<string, { page: number; size: number }> = {};
      Object.keys(data).forEach((cat) => {
        initialPages[cat] = { page: 0, size: 8 };
      });
      setPageSettings(initialPages);
    } catch (err) {
      console.error("Fetch error:", err);
      onNotify("Error loading resources. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderCategorySection = (
    categoryName: string,
    items: CampaignResource[]
  ) => {
    if (items.length === 0) return null;

    // Retrieve settings for this specific category, fallback to defaults if not yet set
    const { page, size } = pageSettings[categoryName] || { page: 0, size: 8 };
    const pagedItems = items.slice(page * size, page * size + size);

    return (
      <Box sx={{ mb: 6 }} key={categoryName}>
        <Typography
          variant="h6"
          fontWeight="bold"
          color="primary"
          gutterBottom
          sx={{ borderLeft: 4, pl: 2, borderColor: "primary.main" }}
        >
          {categoryName}
        </Typography>

        <Grid container spacing={3} sx={{ mt: 1 }}>
          {pagedItems.map((item) => (
            <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  height: 280, // Set a fixed height
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: 3 },
                }}
              >
                <Box sx={{ flexGrow: 1, overflowY: "auto", pr: 1 }}>
                  {" "}
                  {/* Internal Scroll */}
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {item.title}
                    </Typography>
                    {/* Your Verified Badge Chip */}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleDownload(item.title, item.url)}
                  sx={{ mt: 2 }}
                >
                  Download
                </Button>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <TablePagination
          component="div"
          count={items.length}
          page={page}
          onPageChange={(_, newPage) => {
            setPageSettings((prev) => ({
              ...prev,
              [categoryName]: { ...prev[categoryName], page: newPage },
            }));
          }}
          rowsPerPage={size}
          rowsPerPageOptions={[8, 16, 24]}
          onRowsPerPageChange={(e) => {
            const newSize = parseInt(e.target.value, 10);
            setPageSettings((prev) => ({
              ...prev,
              [categoryName]: { page: 0, size: newSize },
            }));
          }}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ pb: 4 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Download Materials
      </Typography>
      <FilterSelector
        onSubmit={handleFetch}
        showAdditionalCriteria={false}
        isLoading={loading}
      />

      {loading ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            py: 10,
          }}
        >
          <CircularProgress size={50} />
          <Typography sx={{ mt: 2, color: "text.secondary" }}>
            Searching for localized materials...
          </Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 4 }}>
          {categorized ? (
            Object.entries(categorized).map(([name, items]) =>
              renderCategorySection(name, items)
            )
          ) : (
            <Paper
              variant="outlined"
              sx={{
                p: 6,
                textAlign: "center",
                bgcolor: "grey.50",
                borderRadius: 4,
              }}
            >
              <Typography variant="h6" color="text.secondary">
                No results to show.
              </Typography>
              <Typography color="text.secondary">
                Please select a County and Area above to view localized campaign
                resources.
              </Typography>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
};
