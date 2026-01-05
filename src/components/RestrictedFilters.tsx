// src/components/RestrictedFilters.tsx
import React, { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../lib/db";
import { useAuth } from "../context/AuthContext";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Box,
  Stack,
} from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";
import { Control, Controller } from "react-hook-form";
import { Area, County, Precinct } from "../types";

interface RestrictedFiltersProps {
  control: Control<any>;
  selectedCounty: string;
  selectedArea: string;
  onCountyChange: (value: string) => void;
  onAreaChange: (value: string) => void;
  onPrecinctChange: (value: string) => void;
  onAreaDistrictChange: (district: string) => void;
  onCountyCodeChange: (code: string) => void;
}

export const RestrictedFilters: React.FC<RestrictedFiltersProps> = ({
  control,
  selectedCounty,
  selectedArea,
  onCountyChange,
  onAreaChange,
  onPrecinctChange,
  onAreaDistrictChange,
  onCountyCodeChange,
}) => {
  const { claims, isLoaded: authLoaded, isAdmin } = useAuth();

  // 1. Load Counties: Filtered by Claims
  const counties =
    useLiveQuery(async () => {
      if (!authLoaded || !claims) return [];

      const allCounties = await indexedDb.counties
        .filter((c: County) => c.active === true)
        .toArray();

      if (isAdmin)
        return allCounties.sort((a, b) => a.name.localeCompare(b.name));

      const allowedCounties = claims.counties || [];
      return allCounties
        .filter((c) => allowedCounties.includes(c.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }, [authLoaded, claims, isAdmin]) ?? [];

  // 2. Load Areas
  const areas =
    useLiveQuery(async () => {
      if (!authLoaded || !claims || !selectedCounty) return [];

      // Use the index for performance
      const countyAreas = await indexedDb.areas
        .where("county_code")
        .equals(selectedCounty) // selectedCounty is "PA-C-15"
        .toArray();

      const activeAreas = countyAreas.filter((a) => a.active === true);

      if (isAdmin)
        return activeAreas.sort((a, b) => a.name.localeCompare(b.name));

      const allowedAreas = claims.areas || [];
      return activeAreas
        .filter((a) => allowedAreas.length === 0 || allowedAreas.includes(a.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }, [authLoaded, claims, isAdmin, selectedCounty]) ?? [];

  // 3. Load Precincts
  const precincts =
    useLiveQuery(async () => {
      if (!authLoaded || !claims || !selectedArea) return [];

      // selectedArea is "PA15-A-15"
      const areaPrecincts = await indexedDb.precincts
        .where("area_district")
        .equals(selectedArea)
        .toArray();

      const activePrecincts = areaPrecincts.filter((p) => p.active === true);

      if (isAdmin)
        return activePrecincts.sort((a, b) => a.name.localeCompare(b.name));

      const allowedPrecincts = claims.precincts || [];
      return activePrecincts
        .filter(
          (p) =>
            allowedPrecincts.length === 0 || allowedPrecincts.includes(p.id)
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    }, [authLoaded, claims, isAdmin, selectedArea]) ?? [];

  // --- AUTO-SELECTION LOGIC ---

  // Auto-select County if only one is allowed
  useEffect(() => {
    if (authLoaded && counties.length === 1 && !selectedCounty) {
      const single = counties[0];
      onCountyChange(single.id);
      onCountyCodeChange(single.code || "");
    }
  }, [authLoaded, counties, selectedCounty]);

  // Auto-select Area if only one is allowed within selected County
  useEffect(() => {
    if (authLoaded && selectedCounty && areas.length === 1 && !selectedArea) {
      const single = areas[0];
      onAreaChange(single.id);
      onAreaDistrictChange(single.area_district || "");
    }
  }, [authLoaded, selectedCounty, areas, selectedArea]);

  // Note: Precinct auto-selection is usually handled by the user selecting an Area,
  // but if there's only one precinct in an area, you could add a similar effect here.

  const isInitialLoading = !authLoaded || (isAdmin && counties.length === 0);

  if (isInitialLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", my: 6 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* County Selection */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="county"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel id="county-label">County</InputLabel>
                <Select
                  {...field}
                  labelId="county-label"
                  label="County"
                  value={selectedCounty || ""}
                  onChange={(e: SelectChangeEvent<string>) => {
                    const val = e.target.value;
                    field.onChange(val);
                    onCountyChange(val);
                    const obj = counties.find((c) => c.id === val);
                    onCountyCodeChange(obj?.code || "");
                    // Reset children
                    onAreaChange("");
                    onPrecinctChange("");
                  }}
                >
                  {/* Only show "All" for Admins or users with multiple counties */}
                  {(isAdmin || counties.length > 1) && (
                    <MenuItem value="">
                      <em>All Counties</em>
                    </MenuItem>
                  )}
                  {counties.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Grid>

        {/* Area Selection */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="area"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth disabled={!selectedCounty}>
                <InputLabel id="area-label">Area</InputLabel>
                <Select
                  {...field}
                  labelId="area-label"
                  label="Area"
                  value={selectedArea || ""}
                  onChange={(e: SelectChangeEvent<string>) => {
                    const val = e.target.value;
                    field.onChange(val);
                    onAreaChange(val);
                    const obj = areas.find((a) => a.id === val);
                    onAreaDistrictChange(obj?.area_district || "");
                    // Reset children
                    onPrecinctChange("");
                  }}
                >
                  {(isAdmin || areas.length > 1) && (
                    <MenuItem value="">
                      <em>All Areas</em>
                    </MenuItem>
                  )}
                  {areas.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Grid>

        {/* Precinct Selection */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="precinct"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth disabled={!selectedArea}>
                <InputLabel id="precinct-label">Precinct</InputLabel>
                <Select
                  {...field}
                  labelId="precinct-label"
                  label="Precinct"
                  value={field.value || ""}
                  onChange={(e) => {
                    field.onChange(e);
                    onPrecinctChange(e.target.value as string);
                  }}
                >
                  {(isAdmin || precincts.length > 1) && (
                    <MenuItem value="">
                      <em>All Precincts</em>
                    </MenuItem>
                  )}
                  {precincts.map((p) => (
                    <MenuItem key={p.id} value={p.precinct_code}>
                      {p.name} ({p.precinct_code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Grid>
      </Grid>
    </Stack>
  );
};
