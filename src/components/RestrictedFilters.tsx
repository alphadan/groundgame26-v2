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
import { Control, Controller, UseFormSetValue } from "react-hook-form";

interface RestrictedFiltersProps {
  control: Control<any>;
  setValue: UseFormSetValue<any>;
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
  setValue,
  selectedCounty,
  selectedArea,
  onCountyChange,
  onAreaChange,
  onPrecinctChange,
  onAreaDistrictChange,
  onCountyCodeChange,
}) => {
  const { isLoaded: authLoaded, isAdmin } = useAuth();

  // 1. Load Counties - Simply get all from our filtered IndexedDB
  const counties =
    useLiveQuery(async () => {
      // If the sync worked, the table only contains allowed counties
      return await indexedDb.counties.toArray();
    }, []) ?? [];

  // 2. Load Areas - Filtered by the selected County ID
  const areas =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];

      // We match the county_code (e.g. "15") extracted from the ID (e.g. "PA-C-15")
      const shortCode = selectedCounty.split("-").pop() || "";

      return await indexedDb.areas
        .where("county_code")
        .equals(shortCode)
        .toArray();
    }, [selectedCounty]) ?? [];

  // 3. Load Precincts - Filtered by the selected Area District ID
  const precincts =
    useLiveQuery(async () => {
      if (!selectedArea) return [];

      return await indexedDb.precincts
        .where("area_district")
        .equals(selectedArea)
        .toArray();
    }, [selectedArea]) ?? [];

  // --- AUTO-SELECTION LOGIC ---

  useEffect(() => {
    if (counties.length === 1 && !selectedCounty) {
      const single = counties[0];
      onCountyChange(single.id);
      onCountyCodeChange(single.code || "");
      setValue("county", single.id);
    }
  }, [counties, selectedCounty, onCountyChange, onCountyCodeChange, setValue]);

  useEffect(() => {
    if (selectedCounty && areas.length === 1 && !selectedArea) {
      const single = areas[0];
      onAreaChange(single.id);
      onAreaDistrictChange(single.id); // The precinct table matches on the full Area ID
      setValue("area", single.id);
    }
  }, [
    selectedCounty,
    areas,
    selectedArea,
    onAreaChange,
    onAreaDistrictChange,
    setValue,
  ]);

  useEffect(() => {
    if (selectedArea && precincts.length === 1) {
      const single = precincts[0];
      setValue("precinct", single.precinct_code);
      onPrecinctChange(single.precinct_code);
    }
  }, [selectedArea, precincts, setValue, onPrecinctChange]);

  if (!authLoaded) return <CircularProgress size={20} />;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Controller
          name="county"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small">
              <InputLabel>County</InputLabel>
              <Select
                {...field}
                label="County"
                value={selectedCounty || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  field.onChange(val);
                  onCountyChange(val);
                  const obj = counties.find((c) => c.id === val);
                  onCountyCodeChange(obj?.code || "");
                  onAreaChange("");
                  onPrecinctChange("");
                  setValue("area", "");
                  setValue("precinct", "");
                }}
              >
                {counties.length > 1 && (
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

      <Grid size={{ xs: 12, md: 4 }}>
        <Controller
          name="area"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" disabled={!selectedCounty}>
              <InputLabel>Area</InputLabel>
              <Select
                {...field}
                label="Area"
                value={selectedArea || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  field.onChange(val);
                  onAreaChange(val);
                  onAreaDistrictChange(val);
                  onPrecinctChange("");
                  setValue("precinct", "");
                }}
              >
                {areas.length > 1 && (
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

      <Grid size={{ xs: 12, md: 4 }}>
        <Controller
          name="precinct"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" disabled={!selectedArea}>
              <InputLabel>Precinct</InputLabel>
              <Select
                {...field}
                label="Precinct"
                value={field.value || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  field.onChange(val);
                  onPrecinctChange(val);
                }}
              >
                {precincts.length > 1 && (
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
  );
};
