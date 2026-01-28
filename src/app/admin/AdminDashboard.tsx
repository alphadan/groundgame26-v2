import React from "react";
import { useAuth } from "../../context/AuthContext";

import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Divider,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import MapIcon from "@mui/icons-material/Map";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import MessageIcon from "@mui/icons-material/Message";
import NotificationsIcon from "@mui/icons-material/Notifications";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import TheaterComedyIcon from "@mui/icons-material/TheaterComedy";
import PhoneDisabledIcon from "@mui/icons-material/PhoneDisabled";
import ScienceIcon from "@mui/icons-material/Science";

// ... other icons
import RouterButton from "../../components/navigation/RouterButton"; // Adjust path based on your folder structure

const cardConfigs = [
  {
    title: "Manage Users",
    icon: <PeopleIcon fontSize="large" color="primary" />,
    description: "Add, edit, delete users and manage permissions",
    subActivities: [
      "Add User",
      "Edit Profile",
      "Reset Password",
      "Delete User",
    ],
    path: "/admin/users",
  },
  {
    title: "Manage Messages",
    icon: <MessageIcon fontSize="large" color="primary" />,
    description: "Add, edit, delete messages and manage filters",
    subActivities: [
      "Add Messages",
      "Edit Messages",
      "Reset Messages Filters",
      "Delete Messages",
    ],
    path: "/admin/messages",
  },
  {
    title: "Manage Resources",
    icon: <FileDownloadIcon fontSize="large" color="primary" />,
    description: "Add, edit, delete campaign resources",
    subActivities: ["Brochures", "Ballots", "Graphics", "Scripts"],
    path: "/admin/resources",
  },
  {
    title: "Manage Notifications",
    icon: <NotificationsIcon fontSize="large" color="primary" />,
    description: "Add, edit, delete notifications",
    subActivities: [
      "Add Notifications",
      "Edit Notifications",
      "Reset Notifications Ques",
      "Delete Notifications",
    ],
    path: "/admin/notifications",
  },
  {
    title: "Firebase Analytics",
    icon: <AnalyticsIcon fontSize="large" color="primary" />,
    description: "View User Metrics",
    subActivities: ["Send Broadcast", "Schedule", "View History"],
    path: "/admin/analytics",
  },
  {
    title: "Engagement Center",
    icon: <EmojiEventsIcon fontSize="large" color="primary" />,
    description: "Manage Rewards",
    subActivities: [
      "Add Rewards",
      "Edit Rewards",
      "Create Badges",
      "Manage Badges",
    ],
    path: "/admin/engagement",
  },
  {
    title: "Manage Areas",
    icon: <MapIcon fontSize="large" color="primary" />,
    description: "Manage Areas",
    subActivities: [
      "Add Areas",
      "Edit Areas",
      "Reset Areas",
      "Bulk Upload Areas",
    ],
    path: "/admin/areas",
  },
  {
    title: "Manage Precincts",
    icon: <LocationCityIcon fontSize="large" color="primary" />,
    description: "Manage Precincts",
    subActivities: [
      "Add Precincts",
      "Edit Precincts",
      "Reset Precincts",
      "Bulk Upload Precincts",
    ],
    path: "/admin/precincts",
  },
  {
    title: "Manage Groups",
    icon: <GroupsIcon fontSize="large" color="primary" />,
    description: "Manage Groups",
    subActivities: [
      "Add Groups",
      "Edit Groups",
      "Reset Groups",
      "Bulk Upload Groups",
    ],
    path: "/admin/groups",
  },
  {
    title: "Manage Goals",
    icon: <GpsFixedIcon fontSize="large" color="primary" />,
    description: "Manage goals at precinct level",
    subActivities: ["Create Goals", "Edit Goals", "Reset Goals"],
    path: "/admin/goals",
  },
  {
    title: "Manage Roles",
    icon: <TheaterComedyIcon fontSize="large" color="primary" />,
    description: "Manage user roles and permissions",
    subActivities: ["Create Roles", "Assign Roles", "Fill Vacancies"],
    path: "/admin/roles",
  },
  {
    title: "Manage Do Not Contact",
    icon: <PhoneDisabledIcon fontSize="large" color="primary" />,
    description: "Manage DNC at precinct level",
    subActivities: ["Add DNC", "Edit DNC", "Ban Users"],
    path: "/admin/dnc",
  },
  {
    title: "Manage Surveys",
    icon: <ScienceIcon fontSize="large" color="primary" />,
    description: "Manage Survey codes and demographics",
    subActivities: [
      "Add survey",
      "Edit survey code",
      "Get survey demograohics",
    ],
    path: "/admin/surveys",
  },
  // ... add others (Areas, Precincts, Rewards stub, etc.)
];

export default function AdminDashboard() {
  const { claims } = useAuth(); // Optional: for future permission filtering

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Admin Dashboard
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        paragraph
        sx={{ mb: 4 }}
      >
        Securely manage users, areas, precincts, rewards and more
      </Typography>

      <Grid container spacing={3}>
        {cardConfigs.map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={card.title}>
            <Card
              elevation={3}
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                transition: "all 0.2s",
                "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  {card.icon}
                  <Typography variant="h6" ml={2}>
                    {card.title}
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" paragraph>
                  {card.description}
                </Typography>

                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Key Actions:
                </Typography>
                <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 2 }}>
                  {card.subActivities.map((act) => (
                    <Typography component="li" variant="body2" key={act}>
                      {act}
                    </Typography>
                  ))}
                </Box>

                <Divider sx={{ my: 2 }} />
              </CardContent>

              <Box sx={{ p: 3, pt: 0 }}>
                <RouterButton
                  variant="contained"
                  fullWidth
                  size="large"
                  to={card.path}
                >
                  Enter {card.title}
                </RouterButton>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
