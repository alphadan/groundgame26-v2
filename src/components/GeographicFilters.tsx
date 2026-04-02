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
import { Control, Controller, UseFormSetValue } from "react-hook-form";
import { FilterValues, GeoPayload } from "../types";

export interface GeographicFiltersProps {
  control: Control<FilterValues>;
  setValue: UseFormSetValue<FilterValues>;
  selectedCounty: string;
  selectedSRD: string;
  selectedArea: string;
  onCountyChange: (payload: GeoPayload | null) => void;
  onSRDChange: (payload: GeoPayload | null) => void;
  onAreaChange: (payload: GeoPayload | null) => void;
  onPrecinctChange: (payload: GeoPayload | null) => void;
}

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
}) => {
  const { isLoaded: authLoaded } = useAuth();

  const emptyPayload = { sql: "", full: "", name: "" };

  // --- 1. Payload Helper (Centralized Logic) ---
  const createPayload = (
    obj: any,
    type: "county" | "area" | "precinct" | "srd",
  ): GeoPayload => {
    if (!obj) return { sql: "", full: "", name: "" };
    let sqlVal = "";

    if (type === "precinct") {
      sqlVal = String(Number(obj.precinct_code || 0));
    } else if (type === "area") {
      // e.g., "PA15-A-12" -> "12"
      sqlVal = obj.id.split("-").pop() || "";
    } else {
      // Counties/SRDs usually use their code directly
      sqlVal = obj.code || obj.id;
    }

    return {
      sql: sqlVal,
      full: obj.id,
      name: obj.name,
    };
  };

  // --- 2. Data Queries (Reactive Dexie hooks) ---

  const counties =
    useLiveQuery(async () => {
      const all = await indexedDb.counties.toArray();
      return all.filter((c) => c.active === true || (c.active as any) === 1);
    }) ?? [];

  const srds =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];
      const all = await indexedDb.state_rep_districts
        .where("county_id")
        .equals(selectedCounty)
        .toArray();
      return all.filter((d) => d.active === true || (d.active as any) === 1);
    }, [selectedCounty]) ?? [];

  const areas =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];
      if (!selectedSRD) {
        const all = await indexedDb.areas
          .where("county_id")
          .equals(selectedCounty)
          .toArray();
        return all.filter((a) => a.active === true || (a.active as any) === 1);
      }
      // SRD Logic: Find areas containing precincts for this specific SRD
      const associated = await indexedDb.precincts
        .where("party_rep_district")
        .equals(selectedSRD)
        .toArray();
      const validIds = [...new Set(associated.map((p) => p.area_id))];
      const allAreas = await indexedDb.areas
        .filter((a) => validIds.includes(a.id))
        .toArray();
      return allAreas.filter(
        (a) => a.active === true || (a.active as any) === 1,
      );
    }, [selectedCounty, selectedSRD]) ?? [];

  const precincts =
    useLiveQuery(async () => {
      if (!selectedArea) return [];
      let query = indexedDb.precincts.where("area_id").equals(selectedArea);
      let results = await query.toArray();
      if (selectedSRD) {
        results = results.filter((p) => p.party_rep_district === selectedSRD);
      }
      return results.filter(
        (p) => p.active === true || (p.active as any) === 1,
      );
    }, [selectedArea, selectedSRD]) ?? [];

  // --- 3. Auto-Selection Logic (Cascading Effects) ---

  // Auto-Select County if only one exists
  useEffect(() => {
    if (counties.length === 1 && !selectedCounty) {
      const single = counties[0];
      setValue("county", single.id as any);
      onCountyChange(createPayload(single, "county"));
    }
  }, [counties, selectedCounty, setValue, onCountyChange]);

  // Auto-Select Area if only one exists
  useEffect(() => {
    if (selectedCounty && areas.length === 1 && !selectedArea) {
      const single = areas[0];
      setValue("area", single.id as any);
      onAreaChange(createPayload(single, "area"));
    }
  }, [selectedCounty, areas, selectedArea, setValue, onAreaChange]);

  // Auto-Select Precinct if only one exists
  useEffect(() => {
    if (selectedArea && precincts.length === 1) {
      const single = precincts[0];
      // We don't check for !selectedPrecinct because we want to force the payload update
      setValue("precinct", single.id as any);
      onPrecinctChange(createPayload(single, "precinct"));
    }
  }, [selectedArea, precincts, setValue, onPrecinctChange]);

  if (!authLoaded)
    return (
      <Box sx={{ py: 2, textAlign: "center" }}>
        <CircularProgress size={24} />
      </Box>
    );

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
                  const obj = counties.find((c) => c.id === val);
                  field.onChange(val);
                  onCountyChange(val ? createPayload(obj, "county") : null);
                  // Resets
                  setValue("srd", emptyPayload);
                  setValue("area", emptyPayload);
                  setValue("precinct", emptyPayload);
                  onSRDChange(null);
                  onAreaChange(null);
                  onPrecinctChange(null);
                }}
              >
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

      {/* 2. SRD Filter */}
      <Grid size={{ xs: 12, md: 3 }}>
        <Controller
          name="srd"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" disabled={!selectedCounty}>
              <InputLabel>District</InputLabel>
              <Select
                {...field}
                label="District"
                value={selectedSRD || ""}
                onChange={(e) => {
                  const val = e.target.value as string;
                  const obj = srds.find((s) => s.id === val);
                  field.onChange(val);
                  onSRDChange(val ? createPayload(obj, "srd") : null);
                  // Resets
                  setValue("area", "" as any);
                  setValue("precinct", "" as any);
                  onAreaChange(null);
                  onPrecinctChange(null);
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
                  const obj = areas.find((a) => a.id === val);
                  field.onChange(val);
                  onAreaChange(val ? createPayload(obj, "area") : null);
                  // Resets
                  setValue("precinct", "" as any);
                  onPrecinctChange(null);
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
                  const obj = precincts.find((p) => p.id === val);
                  field.onChange(val);
                  onPrecinctChange(val ? createPayload(obj, "precinct") : null);
                }}
              >
                <MenuItem value="">
                  <em>All Precincts</em>
                </MenuItem>
                {precincts.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
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
