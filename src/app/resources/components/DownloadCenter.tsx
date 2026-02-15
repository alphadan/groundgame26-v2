// src/app/resources/components/DownloadCenter.tsx
import React, { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../lib/firebase";
import { logEvent } from "../../../lib/analytics";
import { useAuth } from "../../../context/AuthContext";
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

interface DownloadCenterProps {
  resources?: CampaignResource[];
  onNotify: (message: string) => void;
}

/**
 * DownloadCenter Component
 * Handles geographic-based resource filtering with independent category pagination.
 * Tracks downloads via Firebase Analytics for Campaign Intelligence.
 */
export const DownloadCenter: React.FC<DownloadCenterProps> = ({ onNotify }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // States for categorized data and pagination
  const [categorized, setCategorized] = useState<Record<
    string,
    CampaignResource[]
  > | null>(null);
  const [pageSettings, setPageSettings] = useState<
    Record<string, { page: number; size: number }>
  >({});

  // --- ANALYTICS & DOWNLOAD HANDLER ---
  const handleDownload = (resource: CampaignResource) => {
    if (!resource.url) return;

    // 1. Log the event for Looker Studio
    logEvent("resource_downloaded", {
      resource_id: resource.id,
      title: resource.title,
      category: resource.category,
      scope: resource.scope,
      volunteer_uid: user?.uid || "anonymous",
      timestamp: Date.now(),
    });

    // 2. Open the file
    window.open(resource.url, "_blank");
    onNotify(`Opening ${resource.title}...`);
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
    items: CampaignResource[],
  ) => {
    if (items.length === 0) return null;

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
            <Grid key={item.id} size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  height: 280,
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: 3 },
                }}
              >
                <Box sx={{ flexGrow: 1, overflowY: "auto", pr: 1 }}>
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {item.title}
                    </Typography>
                    {item.scope && (
                      <Chip
                        label={item.scope}
                        size="small"
                        variant="outlined"
                        sx={{
                          textTransform: "capitalize",
                          fontSize: "0.65rem",
                        }}
                      />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleDownload(item)}
                  sx={{ mt: 2 }}
                >
                  Download / View
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
              renderCategorySection(name, items),
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
