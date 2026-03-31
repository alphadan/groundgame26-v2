import React, { useState, useMemo, useEffect } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { useAuth } from "../../../context/AuthContext";
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
  Divider,
  FormControlLabel,
  Switch,
  Tooltip,
  Alert,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

// --- IMMUTABLE CANDIDATE JURISDICTIONS ---
const JURISDICTIONS = {
  congressional: [{ id: "PA06", name: "PA-06 (Congressional)" }],
  senate: [
    { id: "9", name: "Senate District 9" },
    { id: "19", name: "Senate District 19" },
    { id: "44", name: "Senate District 44" },
  ],
  house: [
    { id: "13", name: "House District 13" },
    { id: "26", name: "House District 26" },
    { id: "74", name: "House District 74" },
    { id: "155", name: "House District 155" },
    { id: "157", name: "House District 157" },
    { id: "158", name: "House District 158" },
    { id: "160", name: "House District 160" },
    { id: "167", name: "House District 167" },
  ],
  countywide: [{ id: "ALL", name: "All County Precincts" }],
};

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

  // 1. DYNAMIC AUTH: Pull permissions and the admin's own role
  const { permissions, role: adminRole } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdData, setCreatedData] = useState<WelcomeEmailData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [districtOptions, setDistrictOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [precinctOptions, setPrecinctOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [precinctLoading, setPrecinctLoading] = useState(false);

  const [form, setForm] = useState({
    email: "",
    display_name: "",
    preferred_name: "",
    phone: "",
    role: "",
    group_id: "",
    precinct_id: "",
    active: true,
    district_id: "",
    jurisdiction_type: "" as keyof typeof JURISDICTIONS | "",
    jurisdiction_value: "",
  });

  // 2. DYNAMIC ROLE FILTERING: Only show roles this admin is allowed to provision
  const availableRoles = useMemo(() => {
    // Developers get a master list
    if (adminRole === "developer") {
      return [
        "state_admin",
        "county_chair",
        "state_rep_district",
        "area_chair",
        "candidate",
        "committeeperson",
        "volunteer",
      ];
    }
    // Everyone else uses the array we fetched from Firestore roles_config
    return (
      (claims?.permissions?.allowed_to_create as string[]) || ["volunteer"]
    );
  }, [adminRole, claims]);

  useEffect(() => {
    const fetchData = async () => {
      const countyId = claims?.counties?.[0];
      if (!countyId) return;
      try {
        const dists = await db
          .table("state_rep_districts")
          .where("county_id")
          .equals(countyId)
          .filter((d) => d.active)
          .toArray();

        setDistrictOptions(dists.map((d) => ({ id: d.id, name: d.name })));

        // Auto-lock District Leaders to their own district
        if (adminRole === "state_rep_district" && claims?.districts?.[0]) {
          setForm((prev) => ({ ...prev, district_id: claims.districts[0] }));
        }
      } catch (err) {
        console.error("Failed to load management data:", err);
      }
    };
    fetchData();
  }, [claims, adminRole]);

  useEffect(() => {
    const fetchPrecincts = async () => {
      const areaId = claims?.areas?.[0];
      if (!areaId || areaId === "ALL") return;

      setPrecinctLoading(true);
      try {
        const data = await db
          .table("precincts")
          .where("area_id")
          .equals(areaId)
          .toArray();
        setPrecinctOptions(data.map((p) => ({ id: p.id, name: p.name })));
      } catch (err) {
        console.error("Failed to load precincts:", err);
      } finally {
        setPrecinctLoading(false);
      }
    };
    fetchPrecincts();
  }, [claims]);

  const isPrecinctRequired = ["committeeperson", "volunteer"].includes(
    form.role,
  );
  const isCandidate = form.role === "candidate";

  const handleProvision = async () => {
    // 3. SECURITY GUARD: Final check before calling the cloud
    if (!permissions.can_create_users) {
      alert(
        "Action Blocked: You do not have permission to provision accounts.",
      );
      return;
    }

    // 2a. Clean the name (remove spaces/apostrophes)
    const cleanNamePrefix = form.display_name
      .replace(/[^a-zA-Z0-9]/g, "") // Remove anything not alphanumeric
      .slice(0, 3)
      .toLowerCase();

    // 2b. Generate 6 random alphanumeric chars
    const randomSuffix = Math.random().toString(36).slice(-6);

    // 2c. Combine: Result looks like "johx82n1a"
    const newTempPassword = `${cleanNamePrefix}${randomSuffix}`;

    // Ensure phone is present before sending
    if (!form.phone) {
      alert("Mobile Phone Number is required for secure account setup.");
      return;
    }

    setConfirmOpen(false);
    setIsSubmitting(true);
    try {
      const result = await callFunction<WelcomeEmailData>("adminCreateUser", {
        ...form,
        tempPassword: newTempPassword,
        county_id: claims?.counties?.[0] || "",
        area_id: isCandidate ? "" : claims?.areas?.[0] || "",
        active: form.active,
      });
      setCreatedData(result);
      setForm({
        email: "",
        display_name: "",
        preferred_name: "",
        phone: "",
        role: "",
        group_id: "",
        precinct_id: "",
        active: true,
        district_id: "",
        jurisdiction_type: "",
        jurisdiction_value: "",
      });
    } catch (err: any) {
      alert(err.message || "Provisioning failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
            Copy the credentials below to send to the new user.
          </Alert>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight="bold"
            >
              Email Subject:
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
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

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Create a new field account. The system will generate a secure temporary
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
            label="Mobile Phone Number *"
            fullWidth
            required
            placeholder="e.g. 6105551234"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            helperText="Required for Two-Factor SMS Security"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            select
            label="Assigned Role *"
            fullWidth
            required
            value={form.role}
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value,
                jurisdiction_type: "",
                jurisdiction_value: "",
              })
            }
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
            label="Assign Group *"
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

        {isCandidate ? (
          <>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                label="Candidate Office *"
                fullWidth
                required
                value={form.jurisdiction_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    jurisdiction_type: e.target.value as any,
                    jurisdiction_value: "",
                  })
                }
              >
                <MenuItem value="congressional">Congressional</MenuItem>
                <MenuItem value="senate">State Senate</MenuItem>
                <MenuItem value="house">State House</MenuItem>
                <MenuItem value="countywide">Countywide</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                label="District Selection *"
                fullWidth
                required
                disabled={!form.jurisdiction_type}
                value={form.jurisdiction_value}
                onChange={(e) =>
                  setForm({ ...form, jurisdiction_value: e.target.value })
                }
              >
                {form.jurisdiction_type &&
                  JURISDICTIONS[form.jurisdiction_type].map((j) => (
                    <MenuItem key={j.id} value={j.id}>
                      {j.name}
                    </MenuItem>
                  ))}
              </TextField>
            </Grid>
          </>
        ) : (
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select
              label="Assigned District *"
              fullWidth
              required
              disabled={adminRole === "state_rep_district"}
              value={form.district_id}
              onChange={(e) =>
                setForm({ ...form, district_id: e.target.value })
              }
            >
              {districtOptions.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}

        {isPrecinctRequired && (
          <Grid size={{ xs: 12 }}>
            <Autocomplete
              options={precinctOptions}
              loading={precinctLoading}
              value={
                precinctOptions.find((opt) => opt.id === form.precinct_id) ||
                null
              }
              getOptionLabel={(option) => `${option.name} (${option.id})`}
              onChange={(_, newValue) =>
                setForm({ ...form, precinct_id: newValue ? newValue.id : "" })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Assigned Precinct *"
                  required
                  fullWidth
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
        sx={{ mt: 4, py: 2, fontWeight: "bold" }}
        disabled={
          !permissions.can_create_users || // Final UI block
          !form.email ||
          !form.display_name ||
          !form.phone ||
          !form.role ||
          !form.group_id ||
          (isCandidate && !form.jurisdiction_value) ||
          (!isCandidate && !form.district_id) ||
          (isPrecinctRequired && !form.precinct_id)
        }
        onClick={() => setConfirmOpen(true)}
      >
        {isSubmitting ? "Processing..." : "Provision Account"}
      </Button>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>Confirm New User</DialogTitle>
        <DialogContent dividers>
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
