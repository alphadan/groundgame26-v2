// src/components/navigaton/PrecinctFilterBar.tsx
import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";
import {
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
} from "@mui/material";

interface PrecinctFilterBarProps {
  onPrecinctSelect: (id: string) => void;
  isLoading?: boolean;
}

export const PrecinctFilterBar: React.FC<PrecinctFilterBarProps> = ({
  onPrecinctSelect,
  isLoading,
}) => {
  const [selectedCounty, setSelectedCounty] = useState<string>("");
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [selectedPrecinct, setSelectedPrecinct] = useState<string>("all");

  // 1. Load Data from IndexedDB (Hierarchy)
  const counties = useLiveQuery(() => indexedDb.counties.toArray()) ?? [];

  const areas =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];
      return await indexedDb.areas
        .where("county_id")
        .equals(selectedCounty)
        .toArray();
    }, [selectedCounty]) ?? [];

  const precincts =
    useLiveQuery(async () => {
      if (!selectedArea) return [];
      return await indexedDb.precincts
        .where("area_id")
        .equals(selectedArea)
        .toArray();
    }, [selectedArea]) ?? [];

  // 2. Auto-selection logic (Sync from your RestrictedFilters logic)
  useEffect(() => {
    if (counties.length === 1 && !selectedCounty) {
      setSelectedCounty(counties[0].id);
    }
  }, [counties, selectedCounty]);

  // 1. Auto-select County if only one exists (Already in your code)
  useEffect(() => {
    if (counties.length === 1 && !selectedCounty) {
      setSelectedCounty(counties[0].id);
    }
  }, [counties, selectedCounty]);

  // 2. Auto-select Area if only one exists
  useEffect(() => {
    if (selectedCounty && areas.length === 1 && !selectedArea) {
      setSelectedArea(areas[0].id);
    }
  }, [selectedCounty, areas, selectedArea]);

  // 3. Auto-select Precinct if only one exists AND trigger the parent hook
  useEffect(() => {
    // Only auto-select if we have an area, exactly one precinct,
    // and we haven't already selected a specific precinct.
    if (selectedArea && precincts.length === 1 && selectedPrecinct === "all") {
      const singlePrecinctId = precincts[0].id;
      setSelectedPrecinct(singlePrecinctId);
      onPrecinctSelect(singlePrecinctId); // Triggers usePrecinctAnalysis
    }
  }, [selectedArea, precincts, selectedPrecinct, onPrecinctSelect]);

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      alignItems="center"
      sx={{ mb: 4 }}
    >
      <Typography variant="subtitle2" fontWeight="bold">
        Focus View:
      </Typography>

      {/* County Dropdown */}
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>County</InputLabel>
        <Select
          label="County"
          value={selectedCounty}
          onChange={(e) => {
            setSelectedCounty(e.target.value);
            setSelectedArea("");
            setSelectedPrecinct("all");
            onPrecinctSelect("all");
          }}
        >
          {counties.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Area Dropdown */}
      <FormControl
        size="small"
        sx={{ minWidth: 140 }}
        disabled={!selectedCounty}
      >
        <InputLabel>Area</InputLabel>
        <Select
          label="Area"
          value={selectedArea}
          onChange={(e) => {
            setSelectedArea(e.target.value);
            setSelectedPrecinct("all");
            onPrecinctSelect("all");
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

      {/* Precinct Dropdown - This triggers the hook */}
      <FormControl size="small" sx={{ minWidth: 200 }} disabled={!selectedArea}>
        <InputLabel>Precinct</InputLabel>
        <Select
          label="Precinct"
          value={selectedPrecinct}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedPrecinct(val);
            onPrecinctSelect(val); // This updates AnalysisPage's state
          }}
        >
          <MenuItem value="all">
            <em>Aggregate View</em>
          </MenuItem>
          {precincts.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {isLoading && <CircularProgress size={24} />}
    </Stack>
  );
};
