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

  // 1. Load Data from IndexedDB (Hierarchy + Active Filter)

  // Filter for Active Counties
  const counties =
    useLiveQuery(async () => {
      return await indexedDb.counties
        .filter((c) => c.active === true)
        .toArray();
    }, []) ?? [];

  // Filter for Active Areas within Selected County
  const areas =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];
      return await indexedDb.areas
        .where("county_id")
        .equals(selectedCounty)
        .filter((a) => a.active === true)
        .toArray();
    }, [selectedCounty]) ?? [];

  // Filter for Active Precincts within Selected Area
  const precincts =
    useLiveQuery(async () => {
      if (!selectedArea) return [];

      // LOG 1: Check what we are searching for
      console.log(
        "DEBUG: Querying Precincts where area_id ===",
        `"${selectedArea}"`,
      );

      const results = await indexedDb.precincts
        .where("area_id")
        .equals(selectedArea)
        .toArray();

      // LOG 2: Check raw results before the 'active' filter
      console.log(
        `DEBUG: Found ${results.length} TOTAL precincts for area ${selectedArea}`,
      );

      const activeResults = results.filter((p) => p.active === true);

      // LOG 3: Check after 'active' filter
      console.log(`DEBUG: Found ${activeResults.length} ACTIVE precincts`);

      if (results.length > 0 && activeResults.length === 0) {
        console.warn(
          "DEBUG WARNING: All precincts in this area are marked active: false",
        );
      }

      return activeResults;
    }, [selectedArea]) ?? [];

  // 2. Auto-selection logic

  // Auto-select County if only one exists
  useEffect(() => {
    if (counties.length === 1 && !selectedCounty) {
      setSelectedCounty(counties[0].id);
    }
  }, [counties, selectedCounty]);

  // Auto-select Area if only one exists
  useEffect(() => {
    if (selectedCounty && areas.length === 1 && !selectedArea) {
      setSelectedArea(areas[0].id);
    }
  }, [selectedCounty, areas, selectedArea]);

  // Auto-select Precinct if only one exists AND trigger the parent hook
  useEffect(() => {
    if (selectedArea && precincts.length === 1 && selectedPrecinct === "all") {
      const singlePrecinctId = precincts[0].id;
      setSelectedPrecinct(singlePrecinctId);
      onPrecinctSelect(singlePrecinctId);
    }
  }, [selectedArea, precincts, selectedPrecinct, onPrecinctSelect]);

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      alignItems={{ xs: "stretch", md: "center" }}
      sx={{
        width: "100%",
        px: { xs: 0, md: 0 },
        maxWidth: "100%",
      }}
    >
      <Typography variant="subtitle2" fontWeight="bold">
        Focus View:
      </Typography>

      {/* County Dropdown */}
      <FormControl
        size="small"
        fullWidth
        sx={{
          minWidth: { md: 160 },
          width: { xs: "100%", md: "auto" },
        }}
      >
        <InputLabel>County</InputLabel>
        <Select
          label="County"
          value={selectedCounty}
          onChange={(e) => {
            const val = e.target.value as string;
            setSelectedCounty(val);
            setSelectedArea("");
            setSelectedPrecinct("all");
            onPrecinctSelect(val);
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
        fullWidth
        sx={{
          minWidth: { md: 140 },
          width: { xs: "100%", md: "auto" },
        }}
        disabled={!selectedCounty}
      >
        <InputLabel>Area</InputLabel>
        <Select
          label="Area"
          value={selectedArea}
          onChange={(e) => {
            const val = e.target.value as string;
            console.log("🔍 [FilterBar] Area Selected:", val);
            setSelectedArea(val);
            setSelectedPrecinct("all");

            console.log("📡 [FilterBar] Emitting to Dashboard (Aggregate):", val || "all");
            onPrecinctSelect(val || "all");
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

      {/* Precinct Dropdown */}
      <FormControl
        size="small"
        fullWidth
        sx={{
          minWidth: { md: 200 },
          width: { xs: "100%", md: "auto" },
        }}
        disabled={!selectedArea}
      >
        <InputLabel>Precinct</InputLabel>
        <Select
          label="Precinct"
          value={selectedPrecinct}
          onChange={(e) => {
            const val = e.target.value as string;
            console.log("🔍 [FilterBar] Precinct Menu Clicked:", val);
            setSelectedPrecinct(val);

            const targetId = val === "all" ? selectedArea : val;

            console.log("📡 [FilterBar] Emitting to Dashboard:", targetId);
            onPrecinctSelect(targetId);
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
