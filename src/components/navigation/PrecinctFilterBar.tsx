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
  Box,
} from "@mui/material";
import { VoterStatsParams } from "../../types";

interface PrecinctFilterBarProps {
  onFilterChange: (params: {
    type: "county" | "srd" | "area" | "precinct" | "all";
    id: string;
  }) => void;
  isLoading?: boolean;
}

export const PrecinctFilterBar: React.FC<PrecinctFilterBarProps> = ({
  onFilterChange,
  isLoading,
}) => {
  const [selectedCounty, setSelectedCounty] = useState<string>("");
  const [selectedSRD, setSelectedSRD] = useState<string>(""); // NEW
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [selectedPrecinct, setSelectedPrecinct] = useState<string>("all");

  // 1. Load Counties
  const counties =
    useLiveQuery(async () => {
      return await indexedDb.counties
        .filter((c) => c.active === true)
        .toArray();
    }, []) ?? [];

  // 2. Load State Rep Districts (SRDs) based on County
  const srds =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];
      return await indexedDb.state_rep_districts
        .where("county_id")
        .equals(selectedCounty)
        .filter((d) => d.active === true)
        .toArray();
    }, [selectedCounty]) ?? [];

  // 3. Load Areas based on SRD
  const areas =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];

      // If no SRD selected, show all areas in county
      if (!selectedSRD) {
        return await indexedDb.areas
          .where("county_id")
          .equals(selectedCounty)
          .filter((a) => a.active === true)
          .toArray();
      }

      // SRD is selected: Find areas containing precincts belonging to this SRD
      const associatedPrecincts = await indexedDb.precincts
        .where("party_rep_district")
        .equals(selectedSRD)
        .toArray();

      const validAreaIds = [
        ...new Set(associatedPrecincts.map((p) => p.area_id)),
      ];

      return await indexedDb.areas
        .filter((a) => validAreaIds.includes(a.id) && a.active)
        .toArray();
    }, [selectedCounty, selectedSRD]) ?? [];

  // 4. Load Precincts based on Area + SRD (Handles the "Split Area" logic)
  const precincts =
    useLiveQuery(async () => {
      if (!selectedArea) return [];

      let query = indexedDb.precincts.where("area_id").equals(selectedArea);

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
      setSelectedCounty(counties[0].id);
    }
  }, [counties, selectedCounty]);

  useEffect(() => {
    if (selectedCounty && srds.length === 1 && !selectedSRD) {
      setSelectedSRD(srds[0].id);
    }
  }, [selectedCounty, srds, selectedSRD]);

  useEffect(() => {
    if (selectedSRD && areas.length === 1 && !selectedArea) {
      setSelectedArea(areas[0].id);
    }
  }, [selectedSRD, areas, selectedArea]);

  useEffect(() => {
    if (selectedArea && selectedPrecinct !== "all") {
      const isStillValid = precincts.some((p) => p.id === selectedPrecinct);
      if (!isStillValid && precincts.length > 0) {
        setSelectedPrecinct("all");
      }
    }
  }, [selectedArea, precincts]);

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1.5}
      alignItems={{ xs: "stretch", md: "center" }}
      sx={{ width: "100%" }}
    >
      <Typography
        variant="caption"
        fontWeight="bold"
        color="text.secondary"
        sx={{ textTransform: "uppercase", mr: 1 }}
      >
        Focus:
      </Typography>

      {/* County */}
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>County</InputLabel>
        <Select
          label="County"
          value={selectedCounty}
          onChange={(e) => {
            const val = e.target.value as string;
            setSelectedCounty(val);
            setSelectedSRD("");
            setSelectedArea("");
            setSelectedPrecinct("all");
            onFilterChange({ type: "county", id: val });
          }}
        >
          {counties.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* NEW: District (SRD) */}
      <FormControl
        size="small"
        sx={{ minWidth: 140 }}
        disabled={!selectedCounty}
      >
        <InputLabel>District</InputLabel>
        <Select
          label="District"
          value={selectedSRD}
          onChange={(e) => {
            const val = e.target.value as string;
            setSelectedSRD(val);
            setSelectedArea("");
            setSelectedPrecinct("all");
            const filter: VoterStatsParams = {
              type: val ? "srd" : "county",
              id: val || selectedCounty,
            };
            onFilterChange(filter);
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

      {/* Area */}
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
            const val = e.target.value as string;
            setSelectedArea(val);
            setSelectedPrecinct("all");
            const filter: VoterStatsParams = {
              type: val ? "area" : selectedSRD ? "srd" : "county",
              id: val || selectedSRD || selectedCounty,
            };
            onFilterChange(filter);
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

      {/* Precinct */}
      <FormControl size="small" sx={{ minWidth: 180 }} disabled={!selectedArea}>
        <InputLabel>Precinct</InputLabel>
        <Select
          label="Precinct"
          value={selectedPrecinct}
          onChange={(e) => {
            const val = e.target.value as string;
            setSelectedPrecinct(val);
            const filter: VoterStatsParams = {
              type: val === "all" ? "area" : "precinct",
              id: val === "all" ? selectedArea : val,
            };
            onFilterChange(filter);
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

      {isLoading && <CircularProgress size={20} thickness={5} />}
    </Stack>
  );
};
