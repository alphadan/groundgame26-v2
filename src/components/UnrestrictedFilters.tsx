// src/components/UnrestrictedFilters.tsx
import React from "react";
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { Control, Controller } from "react-hook-form";

type FilterKey =
  | "name"
  | "street"
  | "modeledParty"
  | "party"
  | "turnout"
  | "ageGroup"
  | "mailBallot"
  | "zipCode";

interface UnrestrictedFiltersProps {
  control: Control<any>;
  filtersToShow: FilterKey[];
}

export const UnrestrictedFilters: React.FC<UnrestrictedFiltersProps> = ({
  control,
  filtersToShow,
}) => {
  const shouldShow = (key: FilterKey) => filtersToShow.includes(key);

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* Name Search */}
        {shouldShow("name") && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name (partial match)"
                  placeholder="e.g. Smith"
                  fullWidth
                  variant="outlined"
                />
              )}
            />
          </Grid>
        )}

        {/* Zip Code */}
        {shouldShow("zipCode") && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="zipCode"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Zip Code"
                  placeholder="19380"
                  fullWidth
                  variant="outlined"
                  inputProps={{ maxLength: 5 }}
                  helperText="5 digits only"
                  onChange={(e) =>
                    field.onChange(
                      e.target.value.replace(/\D/g, "").slice(0, 5)
                    )
                  }
                />
              )}
            />
          </Grid>
        )}

        {/* Street Address */}
        {shouldShow("street") && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="street"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Street Address (partial)"
                  placeholder="e.g. Main St"
                  fullWidth
                  variant="outlined"
                />
              )}
            />
          </Grid>
        )}

        {/* Modeled Party */}
        {shouldShow("modeledParty") && (
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <Controller
              name="modeledParty"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Modeled Party</InputLabel>
                  <Select
                    {...field}
                    value={field.value || ""}
                    label="Modeled Party"
                  >
                    <MenuItem value="">
                      <em>All Parties</em>
                    </MenuItem>
                    <MenuItem value="1 - Hard Republican">
                      Hard Republican
                    </MenuItem>
                    <MenuItem value="2 - Weak Republican">
                      Weak Republican
                    </MenuItem>
                    <MenuItem value="3 - Swing">Swing Voter</MenuItem>
                    <MenuItem value="4 - Weak Democrat">Weak Democrat</MenuItem>
                    <MenuItem value="5 - Hard Democrat">Hard Democrat</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>
        )}

        {/* Modeled Party */}
        {shouldShow("party") && (
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <Controller
              name="party"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Party Affilliation</InputLabel>
                  <Select
                    {...field}
                    value={field.value || ""}
                    label="Modeled Party"
                  >
                    <MenuItem value="">
                      <em>All Parties</em>
                    </MenuItem>
                    <MenuItem value="R">Republican</MenuItem>
                    <MenuItem value="D">Democrat</MenuItem>
                    <MenuItem value="NF">Independant</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>
        )}

        {/* Turnout Score */}
        {shouldShow("turnout") && (
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <Controller
              name="turnout"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Turnout Score</InputLabel>
                  <Select
                    {...field}
                    value={field.value || ""}
                    label="Turnout Score"
                  >
                    <MenuItem value="">
                      <em>All Levels</em>
                    </MenuItem>
                    <MenuItem value="4">4 - Very High (Most Active)</MenuItem>
                    <MenuItem value="3">3 - Frequent Voter</MenuItem>
                    <MenuItem value="2">2 - Moderate Voter</MenuItem>
                    <MenuItem value="1">1 - Low Turnout</MenuItem>
                    <MenuItem value="0">0 - Inactive</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>
        )}

        {/* Age Group */}
        {shouldShow("ageGroup") && (
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <Controller
              name="ageGroup"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Age Group</InputLabel>
                  <Select
                    {...field}
                    value={field.value || ""}
                    label="Age Group"
                  >
                    <MenuItem value="">
                      <em>All Ages</em>
                    </MenuItem>
                    <MenuItem value="18-25">18-25</MenuItem>
                    <MenuItem value="26-40">26-40</MenuItem>
                    <MenuItem value="41-70">41-70</MenuItem>
                    <MenuItem value="71+">71+</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>
        )}

        {/* Mail Ballot Status */}
        {shouldShow("mailBallot") && (
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <Controller
              name="mailBallot"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Mail Ballot Status</InputLabel>
                  <Select
                    {...field}
                    value={field.value || ""}
                    label="Mail Ballot Status"
                  >
                    <MenuItem value="">
                      <em>All</em>
                    </MenuItem>
                    <MenuItem value="true">Has Mail Ballot</MenuItem>
                    <MenuItem value="false">Does Not Have Mail Ballot</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>
        )}
      </Grid>
    </Stack>
  );
};
