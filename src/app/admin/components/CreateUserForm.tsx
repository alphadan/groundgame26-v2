// src/app/admin/components/CreateUserForm.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { db } from "../../../lib/db"; // Dexie
import {
  getWelcomeEmailTemplate,
  WelcomeEmailData,
} from "../constants/emailTemplates";
import {
  Box,
  Button,
  TextField,
  Typography,
  Grid,
  MenuItem,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Autocomplete,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  Tooltip,
  Alert,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

// Standard Groups List (for role assignment)
const GROUPS = [
  { id: "PA15-G-01", name: "Chester County Republican Committee" },
  { id: "PA15-G-02", name: "Turning Point Action" },
  { id: "PA15-G-03", name: "Young Republicans" },
];

interface Props {
  claims: any;
}

export const CreateUserForm: React.FC<Props> = ({ claims }) => {
  const { callFunction } = useCloudFunctions();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdData, setCreatedData] = useState<WelcomeEmailData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [precinctOptions, setPrecinctOptions] = useState<string[]>([]);
  const [precinctLoading, setPrecinctLoading] = useState(false);

  const [form, setForm] = useState({
    email: "",
    display_name: "",
    preferred_name: "",
    phone: "",
    role: "",
    group_id: "", // Keep if needed for initial role assignment
    precinct_id: "",
    active: true, // NEW: Active toggle
  });

  // Load precincts scoped to admin's area
  useEffect(() => {
    const fetchPrecincts = async () => {
      const areaId = claims?.areas?.[0];
      if (!areaId) return;

      setPrecinctLoading(true);
      try {
        const data = await db
          .table("precincts")
          .where("area_id")
          .equals(areaId)
          .toArray();
        setPrecinctOptions(data.map((p) => p.id));
      } catch (err) {
        console.error("Failed to load precincts:", err);
      } finally {
        setPrecinctLoading(false);
      }
    };
    fetchPrecincts();
  }, [claims]);

  // Filter roles based on admin rank
  const availableRoles = useMemo(() => {
    const roleMap: Record<string, string[]> = {
      developer: ["committeeperson", "candidate", "ambassador"],
      state_rep_district: ["candidate", "ambassador", "committeeperson"],
      county_chair: ["area_chair"],
      area_chair: ["committeeperson", "ambassador"],
    };
    return roleMap[claims?.role] || ["ambassador"];
  }, [claims?.role]);

  const isPrecinctRequired = ["committeeperson", "ambassador"].includes(
    form.role
  );

  const handleProvision = async () => {
    setConfirmOpen(false);
    setIsSubmitting(true);
    try {
      const result = await callFunction<WelcomeEmailData>("adminCreateUser", {
        ...form,
        county_id: claims?.counties?.[0] || "",
        area_id: claims?.areas?.[0] || "",
        active: form.active,
      });
      setCreatedData(result);

      // Reset form
      setForm({
        email: "",
        display_name: "",
        preferred_name: "",
        phone: "",
        role: "",
        group_id: "",
        precinct_id: "",
        active: true,
      });
    } catch (err: any) {
      alert(err.message || "Provisioning failed. Check logs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Success View
  if (createdData) {
    const emailTemplate = getWelcomeEmailTemplate(createdData);
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderColor: "success.main",
          bgcolor: "rgba(76, 175, 80, 0.04)",
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight="bold" color="success.main">
            User Provisioned Successfully
          </Typography>
          <Alert severity="info">
            The account is active by default. Send the welcome email below.
          </Alert>

          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight="bold"
            >
              Email Subject:
            </Typography>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ mt: 0.5 }}
            >
              <Typography variant="body2">{emailTemplate.subject}</Typography>
              <Tooltip title={copiedField === "subject" ? "Copied!" : "Copy"}>
                <IconButton
                  size="small"
                  onClick={() => handleCopy(emailTemplate.subject, "subject")}
                >
                  <ContentCopyIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight="bold"
            >
              Email Body:
            </Typography>
            <Box
              sx={{
                p: 2,
                mt: 1,
                bgcolor: "background.paper",
                border: "1px solid #ddd",
                borderRadius: 1,
                position: "relative",
                whiteSpace: "pre-wrap",
              }}
            >
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                {emailTemplate.body}
              </Typography>
              <Tooltip title={copiedField === "body" ? "Copied!" : "Copy"}>
                <IconButton
                  sx={{ position: "absolute", top: 8, right: 8 }}
                  onClick={() => handleCopy(emailTemplate.body, "body")}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Button
            variant="outlined"
            fullWidth
            onClick={() => setCreatedData(null)}
            sx={{ mt: 2 }}
          >
            Provision Another User
          </Button>
        </Stack>
      </Paper>
    );
  }

  // Form View
  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Create New User
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Fill out the details. A new user will be provisioned with a temporary
        password.
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Full Name *"
            fullWidth
            required
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            inputProps={{ maxLength: 100 }}
            helperText={`${form.display_name.length}/100 characters`}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Preferred Name *"
            fullWidth
            required
            value={form.preferred_name}
            onChange={(e) =>
              setForm({ ...form, preferred_name: e.target.value })
            }
            inputProps={{ maxLength: 50 }}
            helperText={`${form.preferred_name.length}/50 characters`}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Email Address *"
            type="email"
            fullWidth
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Phone Number"
            fullWidth
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            helperText="Optional - used for SMS notifications"
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            select
            label="Assigned Role *"
            fullWidth
            required
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {availableRoles.map((r) => (
              <MenuItem key={r} value={r} sx={{ textTransform: "capitalize" }}>
                {r.replace("_", " ")}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            select
            label="Group *"
            fullWidth
            required
            value={form.group_id}
            onChange={(e) => setForm({ ...form, group_id: e.target.value })}
          >
            {GROUPS.map((org) => (
              <MenuItem key={org.id} value={org.id}>
                {org.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        {isPrecinctRequired && (
          <Grid size={{ xs: 12 }}>
            <Autocomplete
              options={precinctOptions}
              loading={precinctLoading}
              value={form.precinct_id}
              onChange={(_, newValue) =>
                setForm({ ...form, precinct_id: newValue || "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Assigned Precinct ID *"
                  required
                  fullWidth
                  helperText="Must match database ID (e.g. PA15-P-235)"
                />
              )}
            />
          </Grid>
        )}

        <Grid size={{ xs: 12 }}>
          <FormControlLabel
            control={
              <Switch
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
            }
            label="Active (can log in)"
          />
        </Grid>
      </Grid>

      <Button
        variant="contained"
        fullWidth
        size="large"
        sx={{ mt: 4, py: 1.5, fontWeight: "bold" }}
        disabled={
          !form.email ||
          !form.display_name ||
          !form.role ||
          !form.group_id ||
          (isPrecinctRequired && !form.precinct_id)
        }
        onClick={() => setConfirmOpen(true)}
      >
        Provision Account
      </Button>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          Confirm Provisioning
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" mb={2}>
            Verify details before creating the account:
          </Typography>
          <Stack spacing={1}>
            <Typography variant="caption">
              <b>Name:</b> {form.display_name}
            </Typography>
            <Typography variant="caption">
              <b>Email:</b> {form.email}
            </Typography>
            <Typography variant="caption" sx={{ textTransform: "capitalize" }}>
              <b>Role:</b> {form.role.replace("_", " ")}
            </Typography>
            <Typography variant="caption">
              <b>Group:</b> {GROUPS.find((o) => o.id === form.group_id)?.name}
            </Typography>
            {isPrecinctRequired && (
              <Typography variant="caption">
                <b>Precinct:</b> {form.precinct_id}
              </Typography>
            )}
            <Typography variant="caption">
              <b>Active:</b> {form.active ? "Yes" : "No"}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleProvision}
            disabled={isSubmitting}
          >
            Confirm & Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
