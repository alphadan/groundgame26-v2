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

export interface GeographicFiltersProps {
  control: Control<any>;
  setValue: UseFormSetValue<any>;
  selectedCounty: string;
  selectedSRD: string; // Add this
  selectedArea: string;
  onCountyChange: (value: string) => void;
  onSRDChange: (value: string) => void; // Add this
  onAreaChange: (value: string) => void;
  onPrecinctChange: (value: string) => void;
  onAreaDistrictChange: (district: string) => void;
  onCountyCodeChange: (code: string) => void;
}

/**
 * Normalization Helpers for BigQuery Matching
 */
const cleanAreaForBigQuery = (areaId: string): string => {
  if (!areaId) return "";
  return areaId.split("-").pop() || "";
};

const cleanPrecinctForBigQuery = (code: string): string => {
  if (!code) return "";
  const numeric = Number(code);
  return isNaN(numeric) ? code : String(numeric);
};

export const GeographicFilters: React.FC<GeographicFiltersProps> = ({
  control,
  setValue,
  selectedCounty,
  selectedSRD,
  selectedArea,
  onCountyChange,
  onSRDChange,
  onAreaChange,
  onPrecinctChange,
  onAreaDistrictChange,
  onCountyCodeChange,
}) => {
  const { isLoaded: authLoaded } = useAuth();

  // 1. Load Counties - Only show Active
  const counties =
    useLiveQuery(async () => {
      return await indexedDb.counties
        .filter((c) => c.active === true)
        .toArray();
    }, []) ?? [];

  // 2. Load State Rep Districts (SRDs)
  const srds =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];
      return await indexedDb.state_rep_districts
        .where("county_id")
        .equals(selectedCounty)
        .filter((d) => d.active === true)
        .toArray();
    }, [selectedCounty]) ?? [];

  // 3. Load Areas
  // If an SRD is selected, we only want to show Areas that contain
  // precincts belonging to that SRD.
  const areas =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];

      // If no SRD is selected, show all active areas in the county
      if (!selectedSRD) {
        return await indexedDb.areas
          .where("county_id")
          .equals(selectedCounty)
          .filter((a) => a.active)
          .toArray();
      }

      // If an SRD IS selected, we find which areas have precincts
      // pointing to this party_rep_district
      const associatedPrecincts = await indexedDb.precincts
        .where("party_rep_district")
        .equals(selectedSRD)
        .toArray();

      // Extract unique area_ids from those precincts
      const validAreaIds = [
        ...new Set(associatedPrecincts.map((p) => p.area_id)),
      ];

      return await indexedDb.areas
        .filter((a) => validAreaIds.includes(a.id) && a.active)
        .toArray();
    }, [selectedCounty, selectedSRD]) ?? [];

  // 4. Load Precincts
  const precincts =
    useLiveQuery(async () => {
      if (!selectedArea) return [];

      let query = indexedDb.precincts.where("area_id").equals(selectedArea);

      // CRITICAL FIX: Filter by the existing 'party_rep_district' field
      // This ensures that in Area 28, only the correct 2 precincts show up for District 2
      if (selectedSRD) {
        return await query
          .filter((p) => p.party_rep_district === selectedSRD && p.active)
          .toArray();
      }

      return await query.filter((p) => p.active).toArray();
    }, [selectedArea, selectedSRD]) ?? [];

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
      const cleanArea = cleanAreaForBigQuery(single.id);
      onAreaChange(single.id);
      onAreaDistrictChange(cleanArea);
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
      const cleanPrecinct = cleanPrecinctForBigQuery(single.precinct_code);
      setValue("precinct", cleanPrecinct);
      onPrecinctChange(cleanPrecinct);
    }
  }, [selectedArea, precincts, setValue, onPrecinctChange]);

  if (!authLoaded) return <CircularProgress size={20} />;

  return (
    <Grid container spacing={2}>
      {/* 1. County Filter */}
      <Grid size={{ xs: 12, md: 3 }}>
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

                  // Reset ALL descendants
                  onSRDChange("");
                  onAreaChange("");
                  onAreaDistrictChange("");
                  onPrecinctChange("");
                  setValue("srd", "");
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

      {/* 2. NEW: State Rep District Filter */}
      <Grid size={{ xs: 12, md: 3 }}>
        <Controller
          name="srd"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" disabled={!selectedCounty}>
              <InputLabel>State Rep District</InputLabel>
              <Select
                {...field}
                label="State Rep District"
                value={selectedSRD || ""}
                onChange={(e) => {
                  const val = e.target.value as string;
                  field.onChange(val);
                  onSRDChange(val);

                  // Reset descendants
                  onAreaChange("");
                  onAreaDistrictChange("");
                  onPrecinctChange("");
                  setValue("area", "");
                  setValue("precinct", "");
                }}
              >
                <MenuItem value="">
                  <em>All Districts</em>
                </MenuItem>
                {srds.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />
      </Grid>

      {/* 3. Area Filter */}
      <Grid size={{ xs: 12, md: 3 }}>
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
                  onAreaDistrictChange(cleanArea);

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

      {/* 4. Precinct Filter */}
      <Grid size={{ xs: 12, md: 3 }}>
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
                  onPrecinctChange(cleanPrecinct);
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
