// src/app/admin/components/CreateUserForm.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { db } from "../../../lib/db"; // Dexie / IndexedDB instance
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
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

// Standard Organization List
const ORGANIZATIONS = [
  { id: "PA15-G-01", name: "Chester County Republican Committee" },
  { id: "PA15-G-02", name: "Turning Point Action" },
  { id: "PA15-G-03", name: "Young Republicans" },
];

interface Props {
  claims: any; // Passed from FirebaseManagementPage
}

export const CreateUserForm: React.FC<Props> = ({ claims }) => {
  const { callFunction } = useCloudFunctions();

  // --- State ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdData, setCreatedData] = useState<WelcomeEmailData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [precinctOptions, setPrecinctOptions] = useState<string[]>([]);
  const [precinctLoading, setPrecinctLoading] = useState(false);

  const [form, setForm] = useState({
    email: "",
    display_name: "",
    preferred_name: "",
    phone: "",
    role: "",
    org_id: "",
    precinct_id: "",
  });

  // --- 1. Load Precincts from IndexedDB (Scoped to Admin's Area) ---
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
        console.error("Failed to load precincts from IndexedDB:", err);
      } finally {
        setPrecinctLoading(false);
      }
    };
    fetchPrecincts();
  }, [claims]);

  // --- 2. Filter Roles based on Admin Rank ---
  const availableRoles = useMemo(() => {
    const roleMap: Record<string, string[]> = {
      developer: [
        "developer",
        "state_admin",
        "county_chair",
        "area_chair",
        "committeeperson",
        "candidate",
        "ambassador",
      ],
      state_rep_district: [
        "area_chair",
        "candidate",
        "ambassador",
        "committeeperson",
      ],
      county_chair: ["area_chair"],
      area_chair: ["committeeperson", "ambassador"],
    };
    return roleMap[claims?.role] || ["ambassador"];
  }, [claims?.role]);

  const isPrecinctRequired = ["committeeperson", "ambassador"].includes(
    form.role
  );

  // --- 3. Handlers ---
  const handleProvision = async () => {
    setConfirmOpen(false);
    setIsSubmitting(true);
    try {
      const result = await callFunction<WelcomeEmailData>("adminCreateUser", {
        ...form,
        county_id: claims?.counties?.[0] || "",
        area_id: claims?.areas?.[0] || "",
        // The Cloud Function will use context to fill in "created_by"
      });
      setCreatedData(result);

      // Reset form on success
      setForm({
        email: "",
        display_name: "",
        preferred_name: "",
        phone: "",
        role: "",
        org_id: "",
        precinct_id: "",
      });
    } catch (err: any) {
      alert(err.message || "Provisioning failed. Check logs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 4. Success View (The "Copy to Clipboard" Screen) ---
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
          <Typography variant="body2">
            The account is active. Use the buttons below to copy the invitation
            details for your email app.
          </Typography>

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
              <IconButton
                size="small"
                onClick={() =>
                  navigator.clipboard.writeText(emailTemplate.subject)
                }
              >
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
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
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: "pre-line",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                }}
              >
                {emailTemplate.body}
              </Typography>
              <IconButton
                sx={{ position: "absolute", top: 8, right: 8 }}
                onClick={() =>
                  navigator.clipboard.writeText(emailTemplate.body)
                }
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Button
            variant="outlined"
            fullWidth
            onClick={() => setCreatedData(null)}
            sx={{ mt: 2 }}
          >
            Provision Another Volunteer
          </Button>
        </Stack>
      </Paper>
    );
  }

  // --- 5. Form View ---
  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Create New User
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Fill out the details below. A new user will be provisioned. Simply send
        the new user the pre-generated Welcome Email.
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Full Name *"
            fullWidth
            required
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
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
            label="Phone Number *"
            fullWidth
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            select
            label="Organization *"
            fullWidth
            required
            value={form.org_id}
            onChange={(e) => setForm({ ...form, org_id: e.target.value })}
          >
            {ORGANIZATIONS.map((org) => (
              <MenuItem key={org.id} value={org.id}>
                {org.name}
              </MenuItem>
            ))}
          </TextField>
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
          !form.org_id ||
          (isPrecinctRequired && !form.precinct_id)
        }
        onClick={() => setConfirmOpen(true)}
      >
        {isSubmitting ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          "Provision Account"
        )}
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
            Verify the following details carefully before creating the account:
          </Typography>
          <Stack spacing={1}>
            <Typography variant="caption" display="block">
              <b>Name:</b> {form.display_name}
            </Typography>
            <Typography variant="caption" display="block">
              <b>Email:</b> {form.email}
            </Typography>
            <Typography
              variant="caption"
              display="block"
              sx={{ textTransform: "capitalize" }}
            >
              <b>Role:</b> {form.role.replace("_", " ")}
            </Typography>
            <Typography variant="caption" display="block">
              <b>Organization:</b>{" "}
              {ORGANIZATIONS.find((o) => o.id === form.org_id)?.name}
            </Typography>
            {isPrecinctRequired && (
              <Typography variant="caption" display="block">
                <b>Precinct:</b> {form.precinct_id}
              </Typography>
            )}
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
