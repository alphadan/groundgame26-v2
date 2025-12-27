// src/components/FilterSelector.tsx
import React from "react";
import { useForm } from "react-hook-form";
import { RestrictedFilters } from "./RestrictedFilters";
import { UnrestrictedFilters } from "./UnrestrictedFilters";
import { Button, Paper, Typography, Box } from "@mui/material";

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
}

// === NEW: Define the allowed unrestricted filter keys ===
type FilterKey =
  | "name"
  | "street"
  | "modeledParty"
  | "turnout"
  | "ageGroup"
  | "mailBallot"
  | "zipCode";

interface FilterSelectorProps {
  onSubmit: (filters: FilterValues) => void;
  defaultValues?: Partial<FilterValues>;
  isLoading?: boolean;
  disabled?: boolean;
  // Which unrestricted filters to show on this page
  unrestrictedFilters?: FilterKey[];
}

export const FilterSelector: React.FC<FilterSelectorProps> = ({
  onSubmit,
  defaultValues = {},
  isLoading = false,
  disabled = false,
  unrestrictedFilters = [], // default: show none
}) => {
  const { control, handleSubmit, watch, reset } = useForm<FilterValues>({
    defaultValues,
  });

  const selectedCounty = watch("county", "");
  const selectedArea = watch("area", "");

  return (
    <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>
        Filters
      </Typography>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Restricted: County / Area / Precinct */}
        <Box sx={{ mb: 4 }}>
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
            onPrecinctChange={(value) => reset({ ...watch(), precinct: value })}
          />
        </Box>

        {/* Unrestricted: Only show the ones requested by the page */}
        {unrestrictedFilters.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" gutterBottom>
              Additional Filters
            </Typography>
            <UnrestrictedFilters
              control={control}
              filtersToShow={unrestrictedFilters}
            />
          </Box>
        )}

        {/* Submit Button */}
        <Box sx={{ textAlign: "right" }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={disabled || isLoading}
            sx={{ bgcolor: "#B22234" }}
          >
            {isLoading ? "Loading..." : "Submit Query"}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};
