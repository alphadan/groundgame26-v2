import React, { useState } from "react";
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Button,
  Stack,
  Paper,
  Alert,
  Divider,
} from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import GavelIcon from "@mui/icons-material/Gavel";

interface ChecklistProps {
  onComplete: () => void;
}

export default function OnboardingChecklist({ onComplete }: ChecklistProps) {
  const [checked, setChecked] = useState({
    noIncentives: false,
    noQuotas: false,
    threeDayRule: false,
    dataPrivacy: false,
  });

  const isReady = Object.values(checked).every(Boolean);

  return (
    <Paper
      elevation={0}
      sx={{ p: { xs: 2, md: 4 }, bgcolor: "background.paper" }}
    >
      <Stack spacing={3}>
        <Box textAlign="center" sx={{ mb: 2 }}>
          <GavelIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
          <Typography
            variant="h5"
            fontWeight="700"
            sx={{ fontFamily: "serif" }}
          >
            Volunteer Legal Commitment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You must affirm the following to access GroundGame26 voter data.
          </Typography>
        </Box>

        <Alert severity="error" variant="outlined" sx={{ fontWeight: 500 }}>
          ATTENTION: Violating Pennsylvania Election Code (25 P.S. § 3539)
          regarding voter bribery is a Third-Degree Felony.
        </Alert>

        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Checkbox
                checked={checked.noIncentives}
                onChange={(e) =>
                  setChecked({ ...checked, noIncentives: e.target.checked })
                }
              />
            }
            label={
              <Typography variant="body2">
                <strong>No Voter Incentives:</strong> I will NOT offer any
                "valuable thing" (swag, t-shirts, food, or money) to induce a
                citizen to register or vote.
              </Typography>
            }
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={checked.noQuotas}
                onChange={(e) =>
                  setChecked({ ...checked, noQuotas: e.target.checked })
                }
              />
            }
            label={
              <Typography variant="body2">
                <strong>No Registration Quotas:</strong> I understand that
                receiving "swag" or incentives for my volunteer work is
                permitted <strong>only</strong> as a general reward for service
                and is <strong>never</strong> based on the specific number of
                voter registration forms I collect.
              </Typography>
            }
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={checked.threeDayRule}
                onChange={(e) =>
                  setChecked({ ...checked, threeDayRule: e.target.checked })
                }
              />
            }
            label={
              <Typography variant="body2">
                <strong>3-Day Submission Rule:</strong> I agree to deliver all
                completed registration forms to the County Board of Elections
                within 3 days of receipt.
              </Typography>
            }
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={checked.dataPrivacy}
                onChange={(e) =>
                  setChecked({ ...checked, dataPrivacy: e.target.checked })
                }
              />
            }
            label={
              <Typography variant="body2">
                <strong>Data Security:</strong> I will use voter data solely for
                authorized campaign activities and will not screenshot or export
                information.
              </Typography>
            }
          />
        </Stack>

        <Box sx={{ pt: 2 }}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={!isReady}
            onClick={onComplete}
            sx={{ py: 1.5, fontWeight: "bold" }}
          >
            I Agree & Activate My Account
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
