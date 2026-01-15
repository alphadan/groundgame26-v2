// src/app/admin/roles/RoleForm.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { recordEvent } from "../../../lib/firebase";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { OrgRole, UserRole } from "../../../types";
import {
  TextField,
  MenuItem,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Autocomplete,
  Box,
} from "@mui/material";

// Database Interfaces
interface DbCounty {
  id: string;
  name?: string;
}
interface DbGroup {
  id: string;
  name: string;
  county_id: string;
  short_name?: string;
}
interface DbArea {
  id: string;
  name?: string;
  county_id: string;
}
interface DbPrecinct {
  id: string;
  name?: string;
  area_id: string;
}

interface RoleFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const ROLE_OPTIONS: UserRole[] = [
  "committeeperson",
  "area_chair",
  "candidate",
  "volunteer",
  "state_rep_district",
];

export default function RoleForm({ onSuccess, onCancel }: RoleFormProps) {
  const { userProfile } = useAuth();
  const { callFunction } = useCloudFunctions();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<OrgRole>>({
    role: "committeeperson",
    group_id: "",
    county_id: "",
    area_id: "",
    precinct_id: "",
    active: true,
  });

  // --- DEXIE LIVE QUERIES ---

  // 1. Counties (filtered by Auth Claims)
  const dbCounties =
    useLiveQuery(() => indexedDb.table<DbCounty>("counties").toArray()) ?? [];
  const filteredCounties = useMemo(() => {
    if (userProfile?.access?.counties?.includes("ALL")) return dbCounties;
    const allowed = userProfile?.access?.counties || [];
    return dbCounties.filter((c) => allowed.includes(c.id));
  }, [dbCounties, userProfile]);

  // 2. Groups (filtered by selected County)
  const dbGroups =
    useLiveQuery(async () => {
      if (!form.county_id) return [];
      try {
        // We check if the table exists and use the collection to prevent crashes
        return await indexedDb
          .table("groups")
          .where("county_id")
          .equals(form.county_id)
          .toArray();
      } catch (e) {
        console.error("Dexie Group Query Failed. Is 'county_id' indexed?", e);
        return [];
      }
    }, [form.county_id]) ?? [];

  // 3. Areas (filtered by selected County)
  const dbAreas =
    useLiveQuery(async () => {
      if (!form.county_id) return [];
      try {
        return await indexedDb
          .table("areas")
          .where("county_id")
          .equals(form.county_id)
          .toArray();
      } catch (e) {
        console.error("Dexie Area Query Failed. Is 'county_id' indexed?", e);
        return [];
      }
    }, [form.county_id]) ?? [];

  // 4. Precincts (filtered by selected Area)
  const dbPrecincts =
    useLiveQuery(async () => {
      if (!form.area_id || form.role !== "committeeperson") return [];
      return await indexedDb
        .table<DbPrecinct>("precincts")
        .where("area_id")
        .equals(form.area_id)
        .toArray();
    }, [form.area_id, form.role]) ?? [];

  // --- AUTO-SELECTION LOGIC ---
  useEffect(() => {
    if (dbGroups.length === 1 && form.group_id !== dbGroups[0].id) {
      setForm((prev) => ({ ...prev, group_id: dbGroups[0].id }));
    }
  }, [dbGroups]);

  const handleSave = async () => {
    if (!form.role || !form.county_id || !form.group_id) {
      setError("Role, County, and Group are required.");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      await callFunction("adminCreateOrgRole", { ...form });
      recordEvent("role_created", {
        role_type: form.role,
        county: form.county_id,
        group: form.group_id,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create position.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userProfile) return <CircularProgress size={24} />;

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}

      {/* 1. County Selection First */}
      <TextField
        select
        label="County"
        value={form.county_id}
        onChange={(e) =>
          setForm({
            ...form,
            county_id: e.target.value,
            group_id: "",
            area_id: "",
            precinct_id: "",
          })
        }
      >
        {filteredCounties.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.id} {c.name ? ` ${c.name}` : ""}
          </MenuItem>
        ))}
      </TextField>

      {/* 2. Group Selection (Dependent on County) */}
      <TextField
        select
        label="Organization Group"
        value={form.group_id}
        disabled={!form.county_id}
        onChange={(e) => setForm({ ...form, group_id: e.target.value })}
        helperText={
          dbGroups.length === 0 && form.county_id
            ? "No groups found for this county"
            : ""
        }
      >
        {dbGroups.map((g) => (
          <MenuItem key={g.id} value={g.id}>
            {g.name || g.short_name || g.id}
          </MenuItem>
        ))}
      </TextField>

      {/* 3. Role Type */}
      <TextField
        select
        label="Role Type"
        value={form.role}
        onChange={(e) =>
          setForm({
            ...form,
            role: e.target.value as UserRole,
            precinct_id: "",
          })
        }
      >
        {ROLE_OPTIONS.map((opt) => (
          <MenuItem key={opt} value={opt}>
            {opt.toUpperCase()}
          </MenuItem>
        ))}
      </TextField>

      {/* 4. Area / District */}
      <TextField
        select
        label="Area / District"
        value={form.area_id}
        disabled={!form.county_id}
        onChange={(e) =>
          setForm({ ...form, area_id: e.target.value, precinct_id: "" })
        }
      >
        <MenuItem value="">
          <em>Select Area</em>
        </MenuItem>
        {dbAreas.map((a) => (
          <MenuItem key={a.id} value={a.id}>
            {a.id} {a.name ? ` ${a.name}` : ""}
          </MenuItem>
        ))}
      </TextField>

      {/* 5. Precinct (Conditional) */}
      {form.role === "committeeperson" && (
        <Autocomplete
          options={dbPrecincts}
          getOptionLabel={(option) =>
            `${option.id} ${option.name ? ` ${option.name}` : ""}`
          }
          isOptionEqualToValue={(option, value) => option.id === value.id}
          disabled={!form.area_id}
          value={dbPrecincts.find((p) => p.id === form.precinct_id) || null}
          onChange={(_, val) =>
            setForm({ ...form, precinct_id: val?.id || "" })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Precinct"
              helperText="Assign to local precinct"
            />
          )}
        />
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2 }}>
        <Button onClick={onCancel} color="inherit" disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSubmitting || !form.county_id || !form.group_id}
        >
          {isSubmitting ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            "Create Role"
          )}
        </Button>
      </Box>
    </Stack>
  );
}
