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
  Typography,
  Stack,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";
import { Control, Controller } from "react-hook-form";
import { Area, County } from "../types";

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { claims, isLoaded: authLoaded } = useAuth();

  // Load Counties
  const counties =
    useLiveQuery(async () => {
      if (!authLoaded || !claims || claims.role !== "state_admin") return [];

      const allCounties = await indexedDb.counties
        .filter((c: County) => c.active === true)
        .toArray();

      const allowedCounties = claims.counties || [];
      return allCounties
        .filter((c) => allowedCounties.includes(c.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }, [authLoaded, claims]) ?? [];

  // Load Areas (filtered by selected county and claims)
  const areas =
    useLiveQuery(async () => {
      if (
        !authLoaded ||
        !claims ||
        claims.role !== "state_admin" ||
        !selectedCounty
      )
        return [];

      const allAreas = await indexedDb.areas
        .filter((a: Area) => a.active === true)
        .toArray();

      const allowedAreas = claims.areas || [];
      return allAreas
        .filter((a) => allowedAreas.includes(a.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }, [authLoaded, claims, selectedCounty]) ?? [];

  // Load Precincts (by selected area and claims)
  const precincts =
    useLiveQuery(async () => {
      if (
        !authLoaded ||
        !claims ||
        claims.role !== "state_admin" ||
        !selectedArea
      )
        return [];

      const allowedPrecincts = claims.precincts || [];

      if (allowedPrecincts.length > 0) {
        return await indexedDb.precincts
          .filter((p) => p.active === true && allowedPrecincts.includes(p.id))
          .toArray()
          .then((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
      }

      return await indexedDb.precincts
        .filter((p) => p.active === true && p.area_district === selectedArea)
        .toArray()
        .then((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    }, [authLoaded, claims, selectedArea]) ?? [];

  // Auto-select single county
  useEffect(() => {
    if (!authLoaded || !claims || claims.role !== "state_admin") return;
    if (selectedCounty || counties.length !== 1) return;

    const singleCounty = counties[0];
    if (singleCounty) {
      onCountyChange(singleCounty.id);
      onCountyCodeChange(singleCounty.code || "");
    }
  }, [
    authLoaded,
    claims,
    counties,
    selectedCounty,
    onCountyChange,
    onCountyCodeChange,
  ]);

  // Auto-select single area
  useEffect(() => {
    if (!authLoaded || !claims || claims.role !== "state_admin") return;
    if (!selectedCounty || selectedArea || areas.length !== 1) return;

    const singleArea = areas[0];
    if (singleArea) {
      onAreaChange(singleArea.id);
      onAreaDistrictChange(singleArea.area_district || "");
    }
  }, [
    authLoaded,
    claims,
    selectedCounty,
    areas,
    selectedArea,
    onAreaChange,
    onAreaDistrictChange,
  ]);

  const isLoading = !authLoaded || counties.length === 0;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", my: 6 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!authLoaded || claims?.role !== "state_admin") {
    return null;
  }

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* County */}
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
                    const newCountyId = e.target.value as string;
                    field.onChange(newCountyId);
                    onCountyChange(newCountyId);

                    const selectedCountyObj = counties.find(
                      (c) => c.id === newCountyId
                    );
                    onCountyCodeChange(selectedCountyObj?.code || "");
                  }}
                >
                  <MenuItem value="">
                    <em>All Counties</em>
                  </MenuItem>
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

        {/* Area */}
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
                    const newAreaId = e.target.value as string;
                    field.onChange(newAreaId);
                    onAreaChange(newAreaId);

                    const selectedAreaObj = areas.find(
                      (a) => a.id === newAreaId
                    );
                    onAreaDistrictChange(selectedAreaObj?.area_district || "");
                  }}
                >
                  <MenuItem value="">
                    <em>All Areas</em>
                  </MenuItem>
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

        {/* Precinct */}
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
                  onChange={(e) => {
                    field.onChange(e);
                    onPrecinctChange(e.target.value as string);
                  }}
                >
                  <MenuItem value="">
                    <em>All Precincts</em>
                  </MenuItem>
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
