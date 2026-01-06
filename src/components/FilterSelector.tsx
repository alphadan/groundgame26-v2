// src/components/FilterSelector.tsx
import React from "react";
import { useForm } from "react-hook-form";
import { RestrictedFilters } from "./RestrictedFilters";
import { UnrestrictedFilters } from "./UnrestrictedFilters";
import {
  Paper,
  Typography,
  Box,
  Button,
  Stack,
  Divider,
  useTheme,
} from "@mui/material";

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
  zipCode?: string;
}

type FilterKey =
  | "name"
  | "street"
  | "modeledParty"
  | "party"
  | "turnout"
  | "ageGroup"
  | "mailBallot"
  | "zipCode";

interface FilterSelectorProps {
  onSubmit: (filters: FilterValues) => void;
  defaultValues?: Partial<FilterValues>;
  isLoading?: boolean;
  disabled?: boolean;
  unrestrictedFilters?: FilterKey[];
}

export const FilterSelector: React.FC<FilterSelectorProps> = ({
  onSubmit,
  defaultValues = {},
  isLoading = false,
  disabled = false,
  unrestrictedFilters = [],
}) => {
  const theme = useTheme();

  // FIX: Added setValue to the destructured useForm hook
  const { control, handleSubmit, watch, setValue } = useForm<FilterValues>({
    defaultValues,
  });

  const selectedCounty = watch("county", "");
  const selectedArea = watch("area", "");

  // These store the 'friendly' codes (like "15" or "01") used for BigQuery/API calls
  const [selectedAreaDistrict, setSelectedAreaDistrict] =
    React.useState<string>("");
  const [selectedCountyCode, setSelectedCountyCode] =
    React.useState<string>("");

  const onSubmitForm = (data: FilterValues) => {
    const filters: FilterValues = {
      ...data,
      // Map the IDs back to the codes expected by the backend
      county: selectedCountyCode || data.county,
      area: selectedAreaDistrict || data.area,
    };

    onSubmit(filters);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 3, sm: 4 },
        borderRadius: 3,
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom>
        Voter Filters
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Narrow down voters by location and attributes for targeted analysis.
      </Typography>

      <form onSubmit={handleSubmit(onSubmitForm)}>
        <Stack spacing={4}>
          {/* Restricted Location Filters */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Location
            </Typography>
            <RestrictedFilters
              control={control}
              setValue={setValue as any}
              selectedCounty={selectedCounty}
              selectedArea={selectedArea}
              onCountyChange={(value) => {
                setValue("county", value);
              }}
              onAreaChange={(value) => {
                setValue("area", value);
              }}
              onPrecinctChange={(value) => {
                setValue("precinct", value);
              }}
              onAreaDistrictChange={setSelectedAreaDistrict}
              onCountyCodeChange={setSelectedCountyCode}
            />
          </Box>

          {unrestrictedFilters.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Additional Criteria
                </Typography>
                <UnrestrictedFilters
                  control={control}
                  filtersToShow={unrestrictedFilters}
                />
              </Box>
            </>
          )}

          {/* Submit */}
          <Box sx={{ textAlign: "right" }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={disabled || isLoading}
              sx={{
                px: 6,
                py: 1.5,
                fontWeight: "bold",
                fontSize: "1.1rem",
              }}
            >
              {isLoading ? "Loading..." : "Apply Filters"}
            </Button>
          </Box>
        </Stack>
      </form>
    </Paper>
  );
};
