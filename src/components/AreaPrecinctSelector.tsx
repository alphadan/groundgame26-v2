// src/components/AreaPrecinctSelector.tsx
import React, { useCallback } from "react";
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
import { Area } from "../types";

interface AreaPrecinctSelectorProps {
  selectedArea: string;
  selectedPrecinct: string;
  onAreaChange: (areaId: string) => void;
  onPrecinctChange: (precinctCode: string) => void;
  disabled?: boolean;
  showLabels?: boolean; // Set to false for compact/no-label layouts
}

export const AreaPrecinctSelector: React.FC<AreaPrecinctSelectorProps> = ({
  selectedArea,
  selectedPrecinct,
  onAreaChange,
  onPrecinctChange,
  disabled = false,
  showLabels = true,
}) => {
  const { claims, isLoaded: authLoaded } = useAuth();

  // === Load Areas (role-based) ===
  const areas =
    useLiveQuery(async () => {
      if (!authLoaded || !claims || claims.role !== "state_admin") return [];

      const allAreas = await indexedDb.areas
        .filter((a: Area) => a.active === true)
        .toArray();

      const allowedAreas = claims.areas || [];
      const filtered = allAreas.filter((a) => allowedAreas.includes(a.id));

      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }, [authLoaded, claims]) ?? [];

  // === Load Precincts (by area + role) ===
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

  // === Loading & Disabled States (strict boolean, single source) ===
  const isComponentLoading =
    !authLoaded ||
    areas === undefined ||
    (selectedArea && precincts === undefined);

  const isAreaDisabled = Boolean(disabled || isComponentLoading);
  const isPrecinctDisabled = Boolean(
    disabled || isComponentLoading || !selectedArea
  );

  // === Handlers with correct MUI Select types ===
  const handleAreaChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const value = event.target.value;
      onAreaChange(value);
    },
    [onAreaChange]
  );

  const handlePrecinctChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const value = event.target.value;
      onPrecinctChange(value);
    },
    [onPrecinctChange]
  );

  // === Hide if no access ===
  if (!authLoaded || claims?.role !== "state_admin") {
    return null;
  }

  return (
    <Grid container spacing={2} alignItems="end">
      {/* Area Selector */}
      <Grid size={{ xs: 12, md: 4 }}>
        <FormControl fullWidth disabled={isAreaDisabled}>
          {showLabels && <InputLabel>Area</InputLabel>}
          <Select
            value={selectedArea}
            onChange={handleAreaChange}
            label={showLabels ? "Area" : undefined}
            displayEmpty
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
      </Grid>

      {/* Precinct Selector */}
      <Grid size={{ xs: 12, md: 4 }}>
        <FormControl fullWidth disabled={isPrecinctDisabled}>
          {showLabels && <InputLabel>Precinct</InputLabel>}
          <Select
            value={selectedPrecinct}
            onChange={handlePrecinctChange}
            label={showLabels ? "Precinct" : undefined}
            displayEmpty
          >
            <MenuItem value="">
              <em>{selectedArea ? "All Precincts" : "Select Area First"}</em>
            </MenuItem>
            {precincts.map((p) => (
              <MenuItem key={p.id} value={p.precinct_code}>
                {p.precinct_code} - {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Loading spinner for precincts */}
        {isComponentLoading && selectedArea && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
            <CircularProgress size={20} />
          </Box>
        )}
      </Grid>
    </Grid>
  );
};
