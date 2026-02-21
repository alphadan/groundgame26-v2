import React from "react";
import {
  Box,
  Typography,
  Button,
  Checkbox,
  Paper,
  Container,
  Divider,
  Stack,
  IconButton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import { LEGAL_CONFIG } from "../../constants/legal";

// ICON IMPORTS
import GavelIcon from "@mui/icons-material/Gavel";
import SecurityIcon from "@mui/icons-material/Security";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import TimerIcon from "@mui/icons-material/Timer";
import AppRegistrationIcon from "@mui/icons-material/AppRegistration";
import PhonelinkLockIcon from "@mui/icons-material/PhonelinkLock";

const ICON_MAP: Record<string, React.ElementType> = {
  privacy: VerifiedUserIcon,
  noIncentives: GavelIcon,
  noQuotas: AppRegistrationIcon,
  threeDayRule: TimerIcon,
  dataSecurity: PhonelinkLockIcon,
  smsPacing: SecurityIcon,
};

export default function LegalPage() {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
      {/* HEADER ACTIONS */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 4, display: "print-none" }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ fontWeight: "bold" }}
        >
          Back
        </Button>
        <IconButton
          onClick={handlePrint}
          color="primary"
          title="Print for your records"
        >
          <PrintIcon />
        </IconButton>
      </Stack>

      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          p: { xs: 3, md: 6 },
          borderRadius: 4,
          border: "2px solid",
          borderColor: "divider",
        }}
      >
        <Box textAlign="center" mb={6}>
          <Typography
            variant="h4"
            fontWeight="700"
            gutterBottom
            sx={{ fontFamily: "Roboto", color: "primary.main" }}
          >
            Consent Agreement
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontFamily: "monospace", letterSpacing: 1 }}
          >
            VERSION: {LEGAL_CONFIG.CURRENT_VERSION} | EFFECTIVE:{" "}
            {LEGAL_CONFIG.LAST_UPDATED}
          </Typography>
        </Box>

        <Box sx={{ mb: 6 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Statement of Purpose
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            As a volunteer for GroundGame26, you are entrusted with sensitive
            voter data and the responsibility of upholding the integrity of the
            electoral process in Pennsylvania. The following standards are
            legally binding and were affirmed at the time of your account
            activation.
          </Typography>
        </Box>

        <Divider sx={{ mb: 6 }} />

        <Stack spacing={4}>
          {LEGAL_CONFIG.REQUIRED_CHECKS.map((item, index) => {
            const IconComponent = ICON_MAP[item.id] || SecurityIcon;

            return (
              <Box key={item.id} sx={{ pageBreakInside: "avoid" }}>
                <Stack direction="row" spacing={3} alignItems="flex-start">
                  {/* Boxes are checked and disabled because this is a record of what they already agreed to */}
                  <Checkbox
                    checked={true}
                    disabled={true}
                    sx={{
                      mt: -0.5,
                      "&.Mui-disabled": {
                        color: "primary.main",
                        opacity: 0.8,
                      },
                    }}
                  />
                  <Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color="primary.dark"
                      sx={{ display: "flex", alignItems: "center", mb: 0.5 }}
                    >
                      <IconComponent sx={{ mr: 1.5, fontSize: 24 }} />
                      {item.label}
                    </Typography>
                    <Typography
                      variant="body1"
                      color="text.primary"
                      sx={{ lineHeight: 1.6, opacity: 0.9 }}
                    >
                      {item.description}
                    </Typography>
                  </Box>
                </Stack>
                {index < LEGAL_CONFIG.REQUIRED_CHECKS.length - 1 && (
                  <Divider sx={{ mt: 4 }} />
                )}
              </Box>
            );
          })}
        </Stack>

        <Box
          sx={{
            mt: 8,
            p: 3,
            bgcolor: "action.hover",
            borderRadius: 2,
            textAlign: "center",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1 }}
          >
            This document serves as your official record of agreement to the
            2026 GroundGame26 Volunteer Terms.
          </Typography>
          <Typography variant="caption" fontWeight="bold">
            Ground Game 26 • Secure Field Operations • PA Election Code
            Compliant
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
