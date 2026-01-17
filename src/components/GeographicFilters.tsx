// src/components/GeographicFilters.tsx
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
} from "@mui/material";
import { Control, Controller, UseFormSetValue } from "react-hook-form";

interface GeographicFiltersProps {
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

/**
 * Normalization Helpers for BigQuery Matching
 */
// Converts "PA15-A-15" -> "15"
const cleanAreaForBigQuery = (areaId: string): string => {
  if (!areaId) return "";
  return areaId.split("-").pop() || "";
};

// Converts "0240" -> "240" or "005" -> "5"
const cleanPrecinctForBigQuery = (code: string): string => {
  if (!code) return "";
  const numeric = Number(code);
  return isNaN(numeric) ? code : String(numeric);
};

export const GeographicFilters: React.FC<GeographicFiltersProps> = ({
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
  const { isLoaded: authLoaded } = useAuth();

  // 1. Load Counties from IndexedDB
  const counties =
    useLiveQuery(async () => {
      return await indexedDb.counties.toArray();
    }, []) ?? [];

  // 2. Load Areas filtered by the selected County ID
  const areas =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];
      // Use the full ID and the new field name
      return await indexedDb.areas
        .where("county_id")
        .equals(selectedCounty)
        .toArray();
    }, [selectedCounty]) ?? [];

  // 3. Load Precincts filtered by the selected Area ID
  const precincts =
    useLiveQuery(async () => {
      if (!selectedArea) return [];
      return await indexedDb.precincts
        .where("area_id") // New field name from syncReferenceData
        .equals(selectedArea)
        .toArray();
    }, [selectedArea]) ?? [];

  // --- AUTO-SELECTION & NORMALIZATION LOGIC ---

  // Auto-select County if only one exists
  useEffect(() => {
    if (counties.length === 1 && !selectedCounty) {
      const single = counties[0];
      onCountyChange(single.id);
      onCountyCodeChange(single.code || "");
      setValue("county", single.id);
    }
  }, [counties, selectedCounty, onCountyChange, onCountyCodeChange, setValue]);

  // Auto-select Area if only one exists and clean it for BigQuery
  useEffect(() => {
    if (selectedCounty && areas.length === 1 && !selectedArea) {
      const single = areas[0];
      const cleanArea = cleanAreaForBigQuery(single.id);

      onAreaChange(single.id);
      onAreaDistrictChange(cleanArea); // Sends "15" to BigQuery
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

  // Auto-select Precinct if only one exists and clean it for BigQuery
  useEffect(() => {
    if (selectedArea && precincts.length === 1) {
      const single = precincts[0];
      const cleanPrecinct = cleanPrecinctForBigQuery(single.precinct_code);

      setValue("precinct", cleanPrecinct);
      onPrecinctChange(cleanPrecinct); // Sends "235" to BigQuery
    }
  }, [selectedArea, precincts, setValue, onPrecinctChange]);

  if (!authLoaded) return <CircularProgress size={20} />;

  return (
    <Grid container spacing={2}>
      {/* County Filter */}
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
                  const val = e.target.value as string;
                  field.onChange(val);
                  onCountyChange(val);
                  const obj = counties.find((c) => c.id === val);
                  onCountyCodeChange(obj?.code || "");

                  // Reset descendants
                  onAreaChange("");
                  onAreaDistrictChange("");
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

      {/* Area Filter */}
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
                  const val = e.target.value as string;
                  const cleanArea = cleanAreaForBigQuery(val);

                  field.onChange(val);
                  onAreaChange(val);
                  onAreaDistrictChange(cleanArea); // Sends clean code to parent

                  // Reset precinct
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

      {/* Precinct Filter */}
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
                  const val = e.target.value as string;
                  const cleanPrecinct = cleanPrecinctForBigQuery(val);

                  field.onChange(cleanPrecinct);
                  onPrecinctChange(cleanPrecinct); // Sends clean code (no leading zeros)
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
