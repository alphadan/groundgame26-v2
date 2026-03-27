// src/components/FilterSelector.tsx
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { GeographicFilters } from "./GeographicFilters";
import { DemographicFilters } from "./DemographicFilters";
import {
  Paper,
  Typography,
  Box,
  Button,
  Stack,
  Divider,
  useTheme,
} from "@mui/material";
import { FilterValues, GeoPayload, FilterKey } from "../types";

interface FilterSelectorProps {
  onSubmit: (filters: FilterValues) => void;
  defaultValues?: Partial<FilterValues>;
  isLoading?: boolean;
  disabled?: boolean;
  demographicFilters?: FilterKey[];
  showLocationFilters?: boolean;
  showAdditionalCriteria?: boolean;
  initialSrd?: string;
}

export const FilterSelector: React.FC<FilterSelectorProps> = ({
  onSubmit,
  defaultValues = {},
  isLoading = false,
  disabled = false,
  demographicFilters = [],
  showLocationFilters = true,
  showAdditionalCriteria = true,
  initialSrd = "",
}) => {
  const theme = useTheme();

  const { control, handleSubmit, watch, setValue } = useForm<FilterValues>({
    defaultValues: {
      ...defaultValues,
      srd: initialSrd || defaultValues.srd || "",
    },
  });

  // Dual-Value State Store for the Payloads
  const [geoStore, setGeoStore] = useState<{
    county: GeoPayload | null;
    srd: GeoPayload | null;
    area: GeoPayload | null;
    precinct: GeoPayload | null;
  }>({
    county: null,
    srd: null,
    area: null,
    precinct: null,
  });

  // Watch the form strings for UI reactivity
  const watchedCounty = watch("county") || "";
  const watchedArea = watch("area") || "";
  const watchedSRD = watch("srd") || "";

  const onSubmitForm = (data: any) => {
    // Merge demographic strings with the structured GeoPayloads
    const finalFilters: FilterValues = {
      ...data,
      ...geoStore,
    };
    onSubmit(finalFilters);
  };

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 4 },
        borderRadius: 3,
        bgcolor: "background.paper",
        boxShadow: theme.shadows[3],
      }}
    >
      <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom>
        Campaign Filters
      </Typography>

      <form onSubmit={handleSubmit(onSubmitForm)}>
        <Stack spacing={4}>
          {/* Section 1: Geography */}
          {showLocationFilters && (
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Location Scope
              </Typography>
              <GeographicFilters
                control={control}
                setValue={setValue as any}
                selectedCounty={watchedCounty as string}
                selectedSRD={watchedSRD as string}
                selectedArea={watchedArea as string}
                onCountyChange={(p) =>
                  setGeoStore((prev) => ({ ...prev, county: p }))
                }
                onSRDChange={(p) =>
                  setGeoStore((prev) => ({ ...prev, srd: p }))
                }
                onAreaChange={(p) =>
                  setGeoStore((prev) => ({ ...prev, area: p }))
                }
                onPrecinctChange={(p) =>
                  setGeoStore((prev) => ({ ...prev, precinct: p }))
                }
              />
            </Box>
          )}

          {/* Section 2: Demographics */}
          {showAdditionalCriteria && demographicFilters.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Voter Demographics
                </Typography>
                <DemographicFilters
                  control={control}
                  filtersToShow={demographicFilters}
                />
              </Box>
            </>
          )}

          {/* Section 3: Submit */}
          <Box sx={{ textAlign: "right", mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={disabled || isLoading}
              sx={{ px: 6, py: 1.5, fontWeight: "bold", borderRadius: 2 }}
            >
              {isLoading ? "Processing..." : "Apply Filters"}
            </Button>
          </Box>
        </Stack>
      </form>
    </Paper>
  );
};
