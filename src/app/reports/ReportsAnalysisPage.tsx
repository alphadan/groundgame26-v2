// src/app/reports/ReportsPage.tsx
import React from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Phone, Email } from "@mui/icons-material";
import { BarChart } from "@mui/x-charts/BarChart";

// Dummy data — replace with real Cloud Functions later
const dummyKPIs = [
  { label: "Voters Contacted", current: 5240, goal: 10000, percentage: 52.4 },
  { label: "Mail Ballots Signed", current: 1820, goal: 5000, percentage: 36.4 },
  { label: "Doors Knocked", current: 3100, goal: 6000, percentage: 51.7 },
  { label: "New Volunteers", current: 87, goal: 150, percentage: 58 },
];

const dummyTrendData = [
  { month: "Sep", contacts: 3200 },
  { month: "Oct", contacts: 4100 },
  { month: "Nov", contacts: 4800 },
  { month: "Dec", contacts: 5240 },
];

const dummyTeam = [
  {
    name: "Sarah Johnson",
    role: "County Chair",
    email: "sarah@campaign.com",
    phone: "555-0101",
  },
  {
    name: "Mike Chen",
    role: "Area Coordinator",
    email: "mike@campaign.com",
    phone: "555-0102",
  },
  {
    name: "Lisa Torres",
    role: "Precinct Captain",
    email: "lisa@campaign.com",
    phone: "555-0103",
  },
  {
    name: "David Patel",
    role: "Volunteer Lead",
    email: "david@campaign.com",
    phone: "555-0104",
  },
];

export default function AnalysisPage() {
  const { user, claims, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="70vh"
      >
        <CircularProgress sx={{ color: "#B22234" }} />
      </Box>
    );
  }

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Leader";
  const role = (claims?.role || "user").replace("_", " ").toUpperCase();

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Executive Reports & Analytics
      </Typography>

      {/* Welcome & Role */}
      <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
        <Typography variant="h5">Welcome back, {displayName}</Typography>
        <Typography variant="h6" color="text.secondary" mt={1}>
          {role}
        </Typography>
      </Paper>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={5}>
        {dummyKPIs.map((kpi) => (
          <Grid size={{ xs: 12, md: 6 }} key={kpi.label}>
            <Card sx={{ height: "100%", boxShadow: 3 }}>
              <CardContent>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  {kpi.label}
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {kpi.current.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Goal: {kpi.goal.toLocaleString()}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={kpi.percentage}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      bgcolor: "grey.300",
                      "& .MuiLinearProgress-bar": {
                        bgcolor: kpi.percentage >= 100 ? "#4caf50" : "#B22234",
                      },
                    }}
                  />
                  <Typography variant="body2" align="right" mt={1}>
                    {kpi.percentage.toFixed(1)}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Trend Chart */}
      <Paper sx={{ p: 4, mb: 5, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Contact Trend (Last 4 Months)
        </Typography>
        <BarChart
          dataset={dummyTrendData}
          xAxis={[{ scaleType: "band", dataKey: "month" }]}
          series={[{ dataKey: "contacts", label: "Voters Contacted" }]}
          height={300}
          colors={["#B22234"]}
        />
      </Paper>

      {/* Executive Summary */}
      <Paper sx={{ p: 4, mb: 5, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Executive Summary — December 27, 2025
        </Typography>
        <Alert severity="success" sx={{ mb: 3 }}>
          <strong>Strong Progress:</strong> We are 52% toward our voter contact
          goal with momentum building.
        </Alert>
        <Typography paragraph>
          App usage is up 18% this week with 87 new volunteers onboarded. Voter
          registration in our target areas grew 2.1% vs PA statewide average of
          1.4%.
        </Typography>
        <Typography paragraph>
          Priority: Focus on mail ballot signups among Republicans — currently
          at 36% of goal. Swing voter contacts are tracking well.
        </Typography>
        <Typography>
          <strong>Next Action:</strong> Launch targeted mail ballot drive in
          low-signup precincts next week.
        </Typography>
      </Paper>

      {/* Team / Subordinates */}
      <Paper sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Your Team ({dummyTeam.length} members)
        </Typography>
        <List>
          {dummyTeam.map((member, index) => (
            <React.Fragment key={member.email}>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: "#B22234" }}>
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={member.name}
                  secondary={
                    <>
                      <Typography
                        component="span"
                        variant="body2"
                        display="block"
                      >
                        {member.role}
                      </Typography>
                      <Box display="flex" gap={2} mt={0.5}>
                        <Chip
                          icon={<Email />}
                          label={member.email}
                          size="small"
                          clickable
                          component="a"
                          href={`mailto:${member.email}`}
                        />
                        <Chip
                          icon={<Phone />}
                          label={member.phone}
                          size="small"
                          clickable
                          component="a"
                          href={`tel:${member.phone}`}
                        />
                      </Box>
                    </>
                  }
                />
              </ListItem>
              {index < dummyTeam.length - 1 && (
                <Divider variant="inset" component="li" />
              )}
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
