import React, { useState } from "react";
import { Box, TextField, Button, Stack, Typography } from "@mui/material";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { State_Rep_District } from "../../../types";

interface DistrictFormProps {
  onSuccess: () => void;
  onCancel: () => void; // Added onCancel prop
}

export const DistrictForm: React.FC<DistrictFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { create } = useAdminCRUD<State_Rep_District>({
    collectionName: "state_rep_districts",
  });

  const [districtNum, setDistrictNum] = useState("");
  const [countyId, setCountyId] = useState("PA-C-15");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const partyRepDistrict = `PA-SRD-district_${districtNum}`;
    const displayName = `State Republican Party - District ${districtNum}`;

    const newDistrict: Partial<State_Rep_District> = {
      id: partyRepDistrict,
      party_rep_district: partyRepDistrict,
      name: displayName,
      district_number: districtNum,
      county_id: countyId,
      group_id: "PA-ORG-STATE-GOP",
      active: true,
      budget_status: "active",
      area_associations: [],
      district_leaders: [],
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Date.now(),
    };

    try {
      await create(newDistrict as State_Rep_District);
      onSuccess();
    } catch (err) {
      console.error("Failed to create district:", err);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Stack spacing={3}>
        <Typography variant="body2" color="text.secondary">
          Enter the district number below. The system will automatically
          generate the official identifiers.
        </Typography>

        <TextField
          label="District Number"
          required
          fullWidth
          value={districtNum}
          onChange={(e) => setDistrictNum(e.target.value)}
          placeholder="e.g. 2"
        />

        <TextField
          label="County ID"
          required
          fullWidth
          value={countyId}
          onChange={(e) => setCountyId(e.target.value)}
        />

        <Box sx={{ p: 2, bgcolor: "rgba(0,0,0,0.03)", borderRadius: 1 }}>
          <Typography
            variant="caption"
            color="primary"
            sx={{ fontStyle: "italic" }}
          >
            {districtNum
              ? `Official Name: State Republican Party - District ${districtNum}`
              : "Enter a number to see preview..."}
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button variant="outlined" color="inherit" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={!districtNum || !countyId}
          >
            Create District
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
