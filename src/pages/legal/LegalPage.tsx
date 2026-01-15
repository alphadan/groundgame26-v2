import React, { useState } from "react";
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Divider,
  Button,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 4 }}>{children}</Box>}
    </div>
  );
}

export default function LegalPage() {
  const [value, setValue] = useState(0);
  const navigate = useNavigate();

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 4 }}
      >
        Back
      </Button>

      <Typography variant="h3" fontWeight="800" gutterBottom>
        Legal & Compliance
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Last Updated: January 14, 2026
      </Typography>

      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={value}
          onChange={(_, newValue) => setValue(newValue)}
          variant="fullWidth"
        >
          <Tab label="Privacy Policy" />
          <Tab label="Data Usage Agreement" />
        </Tabs>
      </Paper>

      <CustomTabPanel value={value} index={0}>
        <Typography variant="h5" gutterBottom fontWeight="700">
          1. Data Collection & Privacy
        </Typography>
        <Typography paragraph>
          Ground Game 26 ("the App") is designed to facilitate Get Out The Vote
          (GOTV) activities. We collect personally identifiable information
          (PII) such as your name, email, and phone number to manage your
          account and track campaign progress.
        </Typography>

        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          2. Voter Data Sources
        </Typography>
        <Typography paragraph>
          The voter lists provided within this app are sourced from official
          government registration records. We do not sell this data. It is
          accessed strictly for non-partisan outreach.
        </Typography>

        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          3. Analytics & Tracking
        </Typography>
        <Typography paragraph>
          We use Google Analytics 4 (GA4) to monitor app performance and
          volunteer engagement. This includes tracking your role and geographic
          area to optimize campaign distribution.
        </Typography>
      </CustomTabPanel>

      <CustomTabPanel value={value} index={1}>
        <Typography variant="h5" gutterBottom fontWeight="700">
          Acceptable Use Policy
        </Typography>
        <Typography paragraph>
          By accessing the Ground Game 26 platform, you agree to the following
          legally binding terms regarding the handling of sensitive voter
          information.
        </Typography>

        <Box sx={{ bgcolor: "grey.50", p: 3, borderRadius: 2, mb: 4 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            KEY RULES FOR VOLUNTEERS:
          </Typography>
          <ul>
            <li>
              <Typography variant="body2" paragraph>
                <strong>Non-Commercial Use:</strong> You may not use voter data
                for any commercial, personal, or non-campaign purpose.
              </Typography>
            </li>
            <li>
              <Typography variant="body2" paragraph>
                <strong>No Data Harvesting:</strong> Scraping, exporting, or
                distributing voter lists outside of the App is strictly
                prohibited.
              </Typography>
            </li>
            <li>
              <Typography variant="body2" paragraph>
                <strong>Accountability:</strong> Every action you take—including
                voter searches and profile edits—is logged with a timestamp and
                your unique ID for security auditing.
              </Typography>
            </li>
          </ul>
        </Box>

        <Typography variant="h6" gutterBottom>
          Termination of Access
        </Typography>
        <Typography paragraph>
          The Organization reserves the right to deactivate any role or user
          account immediately if a violation of this Data Usage Agreement is
          detected or suspected.
        </Typography>
      </CustomTabPanel>

      <Divider sx={{ my: 4 }} />
      <Typography
        variant="caption"
        color="text.secondary"
        textAlign="center"
        display="block"
      >
        Ground Game 26 • Built for 2026 Engagement • Secure Governance
      </Typography>
    </Container>
  );
}
