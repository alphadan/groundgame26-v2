// src/components/UnrestrictedFilters.tsx
import React from "react";
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { Control, Controller } from "react-hook-form";

type FilterKey =
  | "name"
  | "street"
  | "modeledParty"
  | "turnout"
  | "ageGroup"
  | "mailBallot"
  | "zipCode";

interface UnrestrictedFiltersProps {
  control: Control<any>;
  filtersToShow: FilterKey[]; // ← NEW: which filters to render
}

export const UnrestrictedFilters: React.FC<UnrestrictedFiltersProps> = ({
  control,
  filtersToShow,
}) => {
  const shouldShow = (key: FilterKey) => filtersToShow.includes(key);

  return (
    <Grid container spacing={2}>
      {shouldShow("name") && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Name (partial)" fullWidth />
            )}
          />
        </Grid>
      )}

      {shouldShow("zipCode") && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Controller
            name="zipCode"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Zip Code"
                fullWidth
                placeholder="19380"
                inputProps={{ maxLength: 5 }}
                helperText="5 digits"
                onChange={(e) =>
                  field.onChange(e.target.value.replace(/\D/g, "").slice(0, 5))
                }
              />
            )}
          />
        </Grid>
      )}

      {shouldShow("street") && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Controller
            name="street"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Street Address (partial)"
                fullWidth
              />
            )}
          />
        </Grid>
      )}

      {shouldShow("modeledParty") && (
        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="modeledParty"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Modeled Party</InputLabel>
                <Select {...field} label="Modeled Party">
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="1 - Hard Republican">Hard R</MenuItem>
                  <MenuItem value="2 - Weak Republican">Weak R</MenuItem>
                  <MenuItem value="3 - Swing">Swing</MenuItem>
                  <MenuItem value="4 - Weak Democrat">Weak D</MenuItem>
                  <MenuItem value="5 - Hard Democrat">Hard D</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </Grid>
      )}

      {shouldShow("turnout") && (
        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="turnout"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Turnout Score</InputLabel>
                <Select {...field} label="Turnout Score">
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="4">4 - Very High (Most Active)</MenuItem>
                  <MenuItem value="3">3 - Frequent</MenuItem>
                  <MenuItem value="2">2 - Moderate</MenuItem>
                  <MenuItem value="1">1 - Low</MenuItem>
                  <MenuItem value="0">0 - Inactive</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </Grid>
      )}

      {shouldShow("ageGroup") && (
        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="ageGroup"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Age Group</InputLabel>
                <Select {...field} label="Age Group">
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="18-29">18-29</MenuItem>
                  <MenuItem value="30-44">30-44</MenuItem>
                  <MenuItem value="45-64">45-64</MenuItem>
                  <MenuItem value="65+">65+</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </Grid>
      )}

      {shouldShow("mailBallot") && (
        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="mailBallot"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Mail Ballot Status</InputLabel>
                <Select {...field} label="Mail Ballot Status">
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Requested Mail Ballot</MenuItem>
                  <MenuItem value="false">No Mail Ballot Requested</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </Grid>
      )}
    </Grid>
  );
};
