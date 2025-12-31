// src/app/guide/HowToUsePage.tsx
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  Container,
} from "@mui/material";
import {
  Dashboard,
  Analytics,
  Message,
  People,
  Search,
  DirectionsWalk,
  Settings,
  EmojiEvents,
} from "@mui/icons-material";

export default function HowToUsePage() {
  const theme = useTheme();

  const steps = [
    {
      icon: <Dashboard color="primary" />,
      title: "1. Start at Your Dashboard",
      description:
        "See your progress, key metrics, and AI-powered executive summary every time you log in.",
    },
    {
      icon: <Analytics color="primary" />,
      title: "2. Explore Reports & Analytics",
      description:
        "View trends, voter breakdowns, and quick targeting reports to understand your area.",
    },
    {
      icon: <Message color="primary" />,
      title: "3. Create Messages",
      description:
        "Go to Messaging → select your audience → get AI-crafted text templates → copy with one tap.",
    },
    {
      icon: <People color="primary" />,
      title: "4. Build a Voter Contact List",
      description:
        "Select a precinct + filters → generate a downloadable list for phone banking or mail.",
    },
    {
      icon: <Search color="primary" />,
      title: "5. Find Any Voter by Name",
      description:
        "Quickly search for an individual voter by name or address and contact them instantly.",
    },
    {
      icon: <DirectionsWalk color="primary" />,
      title: "6. Go Canvassing with Walk Lists",
      description:
        "Generate a household-grouped walk list → high-turnout voters first → tap to call/text → add notes in the field.",
    },
    {
      icon: <EmojiEvents color="primary" />,
      title: "7. Earn Badges & Rewards",
      description:
        "Complete goals (doors knocked, voters contacted) → earn points → redeem for exclusive GOP gear and recognition.",
    },
    {
      icon: <Settings color="primary" />,
      title: "8. Manage Your Profile",
      description:
        "Update your photo, name, email, toggle dark mode, and view app version in Settings.",
    },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper sx={{ p: { xs: 4, sm: 6 }, borderRadius: 4, boxShadow: 6 }}>
        <Stack spacing={5} alignItems="center" textAlign="center">
          {/* Hero */}
          <Box>
            <Typography
              variant="h3"
              fontWeight="bold"
              color="primary"
              gutterBottom
              sx={{ fontSize: { xs: "2.5rem", md: "3.5rem" } }}
            >
              How to Use GroundGame
            </Typography>
            <Typography variant="h5" color="text.secondary">
              Your step-by-step guide to winning doors in 2026
            </Typography>
          </Box>

          <Divider
            sx={{
              width: "60%",
              borderColor: "primary.main",
              borderBottomWidth: 3,
            }}
          />

          {/* Main Steps */}
          <List sx={{ width: "100%" }}>
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <ListItem alignItems="flex-start">
                  <ListItemIcon sx={{ minWidth: 64, mt: 1 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        bgcolor: "primary.100",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {step.icon}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {step.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body1" color="text.secondary">
                        {step.description}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < steps.length - 1 && <Divider sx={{ my: 2 }} />}
              </React.Fragment>
            ))}
          </List>

          {/* Pro Tips */}
          <Box sx={{ width: "100%" }}>
            <Typography
              variant="h5"
              fontWeight="bold"
              color="primary"
              gutterBottom
            >
              Pro Tips from the Field
            </Typography>
            <Stack spacing={2} sx={{ mt: 3 }}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="body1">
                  <strong>Texting:</strong> Your message is automatically
                  copied. After sending, tap the ← arrow in the top-left to
                  return.
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="body1">
                  <strong>Walk Lists:</strong> Swipe left/right on mobile to see
                  all columns.
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="body1">
                  <strong>Badges:</strong> Every action counts — knock doors,
                  send texts, recruit volunteers to earn points and exclusive
                  rewards.
                </Typography>
              </Paper>
            </Stack>
          </Box>

          {/* Closing */}
          <Box sx={{ mt: 6 }}>
            <Typography
              variant="h5"
              fontWeight="bold"
              color="primary"
              gutterBottom
            >
              You're ready to win.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Every door knocked, every voter contacted brings us closer to
              victory in 2026.
            </Typography>
            <Typography
              variant="h6"
              fontWeight="bold"
              color="primary"
              sx={{ mt: 3 }}
            >
              Now go Get Out The Vote!
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
