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
  onCountyCodeChange?: (code: string) => void;
  onAreaDistrictChange?: (district: string) => void;
}

export const FilterSelector: React.FC<FilterSelectorProps> = ({
  onSubmit,
  defaultValues = {},
  isLoading = false,
  disabled = false,
  unrestrictedFilters = [],
}) => {
  const theme = useTheme();

  const { control, handleSubmit, watch, reset } = useForm<FilterValues>({
    defaultValues,
  });

  const selectedCounty = watch("county", "");
  const selectedArea = watch("area", "");

  const [selectedAreaDistrict, setSelectedAreaDistrict] =
    React.useState<string>("");
  const [selectedCountyCode, setSelectedCountyCode] =
    React.useState<string>("");

  const onSubmitForm = (data: FilterValues) => {
    const filters: FilterValues = {
      ...data,
      county: selectedCountyCode || "",
      area: selectedAreaDistrict || "",
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
              selectedCounty={selectedCounty}
              selectedArea={selectedArea}
              onCountyChange={(value) =>
                reset({ county: value, area: "", precinct: "" })
              }
              onAreaChange={(value) =>
                reset({ ...watch(), area: value, precinct: "" })
              }
              onPrecinctChange={(value) =>
                reset({ ...watch(), precinct: value })
              }
              onAreaDistrictChange={setSelectedAreaDistrict}
              onCountyCodeChange={setSelectedCountyCode}
            />
          </Box>

          <Divider />

          {/* Unrestricted Additional Filters */}
          {unrestrictedFilters.length > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Additional Criteria
              </Typography>
              <UnrestrictedFilters
                control={control}
                filtersToShow={unrestrictedFilters}
              />
            </Box>
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
