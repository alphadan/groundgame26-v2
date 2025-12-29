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

  // Load Areas (by county + claims)
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

  // Load Precincts (by area + claims)
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

  // === AUTO-PRESELECT COUNTY IF ONLY ONE ===
  useEffect(() => {
    if (!authLoaded || !claims || claims.role !== "state_admin") return;
    if (selectedCounty || counties.length !== 1) return; // Already selected or multiple choices

    const singleCounty = counties[0];
    if (singleCounty) {
      // Simulate selection
      onCountyChange(singleCounty.id);
      onCountyCodeChange(singleCounty.code);
      console.log("Auto-selected county:", singleCounty.name);
    }
  }, [
    authLoaded,
    claims,
    counties,
    selectedCounty,
    onCountyChange,
    onCountyCodeChange,
  ]);

  // === AUTO-PRESELECT AREA IF ONLY ONE (after county selected) ===
  useEffect(() => {
    if (!authLoaded || !claims || claims.role !== "state_admin") return;
    if (!selectedCounty || selectedArea || areas.length !== 1) return;

    const singleArea = areas[0];
    if (singleArea) {
      onAreaChange(singleArea.id);
      onAreaDistrictChange(singleArea.area_district);
      console.log("Auto-selected area:", singleArea.name);
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

  const isLoading =
    !authLoaded ||
    counties.length === 0 ||
    (selectedCounty && areas.length === 0) ||
    (selectedArea && precincts.length === 0);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!authLoaded || claims?.role !== "state_admin") {
    return null;
  }

  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="county"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>County</InputLabel>
                <Select
                  {...field}
                  value={selectedCounty || ""}
                  onChange={(e: SelectChangeEvent<string>) => {
                    const newCountyId = e.target.value as string;
                    field.onChange(newCountyId);
                    onCountyChange(newCountyId);
                    const selectedCountyObj = counties.find(
                      (c) => c.id === newCountyId
                    );
                    const countyCodeForQuery = selectedCountyObj?.code || "";

                    onCountyCodeChange(countyCodeForQuery);
                  }}
                >
                  <MenuItem value="">All Counties</MenuItem>
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

        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="area"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth disabled={!selectedCounty}>
                <InputLabel>Area</InputLabel>
                <Select
                  {...field}
                  value={selectedArea || ""}
                  onChange={(e: SelectChangeEvent<string>) => {
                    const newAreaId = e.target.value as string;
                    field.onChange(newAreaId);
                    onAreaChange(newAreaId); // Passes Area ID ("PA15-A-15") → fixes precinct filtering

                    // Find the short district code needed for SQL query
                    const selectedAreaObj = areas.find(
                      (a) => a.id === newAreaId
                    );
                    const areaDistrictCode =
                      selectedAreaObj?.area_district || "";

                    onAreaDistrictChange(areaDistrictCode); // Sends "15" → correct for Firebase Function
                  }}
                >
                  <MenuItem value="">All Areas</MenuItem>
                  {areas.map((a) => (
                    // ← CRITICAL: value must be the full Area ID
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="precinct"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth disabled={!selectedArea}>
                <InputLabel>Precinct</InputLabel>
                <Select
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    onPrecinctChange(e.target.value as string);
                  }}
                >
                  <MenuItem value="">All Precincts</MenuItem>
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
    </>
  );
};
