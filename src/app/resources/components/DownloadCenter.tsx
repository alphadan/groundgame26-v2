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
  Paper,
  Divider,
  Stack,
} from "@mui/material";
import {
  Download as DownloadIcon,
  Map as MapIcon,
  Description as FileIcon,
} from "@mui/icons-material";
import { CampaignResource, FilterValues } from "../../../types";

interface DownloadCenterProps {
  onNotify: (message: string) => void;
}

export const DownloadCenter: React.FC<DownloadCenterProps> = ({ onNotify }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categorized, setCategorized] = useState<Record<
    string,
    CampaignResource[]
  > | null>(null);
  const [pageSettings, setPageSettings] = useState<
    Record<string, { page: number; size: number }>
  >({});

  const handleDownload = (resource: CampaignResource) => {
    if (!resource.url) return;
    window.open(resource.url, "_blank");
    onNotify(`Opening ${resource.title}...`);
  };

  const handleFetch = async (filters: FilterValues) => {
    console.log("DEBUG: 1. FilterSelector Submitted:", filters);

    // Check for the Dual-Value Payload specifically
    if (filters.precinct) {
      console.log("DEBUG: 2. Precinct Payload Found:", {
        sql_code: filters.precinct.sql,
        firestore_id: filters.precinct.full,
      });
    }

    setLoading(true);
    try {
      const getResources = httpsCallable(functions, "getResourcesByLocation");

      console.log("DEBUG: 3. Calling Cloud Function with:", {
        county: filters.county?.full,
        area: filters.area?.full,
        precinct: filters.precinct?.full,
      });

      const result: any = await getResources({
        county: filters.county,
        area: filters.area,
        precinct: filters.precinct,
      });

      console.log("DEBUG: 4. Cloud Function Raw Response:", result);

      const data = result.data?.categorized || {};

      if (Object.keys(data).length === 0) {
        console.warn(
          "DEBUG: 5. Search returned 0 results. Check Firestore 'location.precinct.id' values.",
        );
      } else {
        console.log(
          "DEBUG: 5. Results categorized successfully:",
          Object.keys(data),
        );
      }

      setCategorized(data);

      const initialPages: Record<string, { page: number; size: number }> = {};
      Object.keys(data).forEach((cat) => {
        initialPages[cat] = { page: 0, size: 8 };
      });
      setPageSettings(initialPages);
    } catch (err) {
      console.error("DEBUG: ERROR in handleFetch:", err);
      onNotify("Error loading resources.");
    } finally {
      setLoading(false);
    }
  };

  const renderCategorySection = (
    categoryName: string,
    items: CampaignResource[],
  ) => {
    const isMap = categoryName.toLowerCase().includes("map");
    const { page, size } = pageSettings[categoryName] || { page: 0, size: 8 };
    const pagedItems = items.slice(page * size, page * size + size);

    return (
      <Box sx={{ mb: 6 }} key={categoryName}>
        <Divider sx={{ mb: 3 }}>
          <Chip
            label={categoryName.toUpperCase()}
            color={isMap ? "secondary" : "primary"}
            sx={{ fontWeight: "bold" }}
          />
        </Divider>

        <Grid container spacing={3}>
          {pagedItems.map((item) => (
            <Grid item key={item.id} xs={12} sm={6} md={3}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 4,
                  height: 260,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    {isMap ? (
                      <MapIcon color="secondary" />
                    ) : (
                      <FileIcon color="primary" />
                    )}
                    <Typography variant="caption" color="text.disabled">
                      {item.scope}
                    </Typography>
                  </Stack>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </Box>
                <Button
                  fullWidth
                  variant="contained"
                  color={isMap ? "secondary" : "primary"}
                  onClick={() => handleDownload(item)}
                >
                  {isMap ? "View Map" : "Download"}
                </Button>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Download Center
      </Typography>

      <FilterSelector
        onSubmit={handleFetch}
        showAdditionalCriteria={false}
        isLoading={loading}
      />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ mt: 4 }}>
          {categorized && Object.keys(categorized).length > 0 ? (
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
                borderStyle: "dashed",
              }}
            >
              <Typography color="text.secondary">
                No materials found. Select a location to search.
              </Typography>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
};
