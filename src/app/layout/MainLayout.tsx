// src/app/layout/MainLayout.tsx
import React, { useState, useEffect, useCallback, ReactNode } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  Breadcrumbs,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Stack,
  Divider,
  useTheme,
} from "@mui/material";
import {
  Analytics,
  Campaign,
  Logout,
  Menu as MenuIcon,
  HomeWork,
  Phone,
  DirectionsWalk,
  Search as SearchIcon,
  Settings,
} from "@mui/icons-material";
import Logo from "../../components/ui/Logo";
import DataObjectIcon from "@mui/icons-material/DataObject";

// Role & Org Icons
import GopElephant from "../../assets/icons/gop-elephant.svg";
import CandidateRosette from "../../assets/icons/candidate-rosette.svg";
import CountyChairCrown from "../../assets/icons/county-chair-crown.svg";
import AreaChairBadge from "../../assets/icons/area-chair-badge.svg";
import CommitteepersonShield from "../../assets/icons/committeeperson-shield.svg";

// === Badge Icons (24x24 SVGs) – Replace these with your actual badge SVGs ===
import BadgeTrophy from "../../assets/icons/badge-trophy.svg";
import BadgeFirstTimer from "../../assets/icons/badge-first-timer.svg";
import BadgeTeamLeader from "../../assets/icons/badge-team-leader.svg";
import BadgeMailMaster from "../../assets/icons/badge-mail-master.svg";
import BadgeTopRecruiter from "../../assets/icons/badge-top-recruiter.svg";

const drawerWidth = 280;

interface MainLayoutProps {
  children?: ReactNode;
}

const ROLE_ICONS: Record<string, string> = {
  state_admin: CommitteepersonShield,
  candidate: CandidateRosette,
  county_chair: CountyChairCrown,
  area_chair: AreaChairBadge,
  committeeperson: CommitteepersonShield,
  ambassador: CandidateRosette,
};

const ORG_ICONS: Record<string, string> = {
  chester_gop: GopElephant,
};

export default function MainLayout({ children }: MainLayoutProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { user, claims } = useAuth();
  const appControl = useLiveQuery(() =>
    db.app_control.toArray().then((arr) => arr[0])
  );

  const userRole =
    typeof claims?.role === "string" ? claims.role.toLowerCase() : null;
  const userOrgId = typeof claims?.org_id === "string" ? claims.org_id : null;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const pathnames = location.pathname.split("/").filter(Boolean);
  const breadcrumbName =
    pathnames.length > 0
      ? pathnames[pathnames.length - 1]
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())
      : "Dashboard";

  const menuItems = [
    { text: "Dashboard", icon: <HomeWork />, path: "/dashboard" },
    { text: "Analysis", icon: <Analytics />, path: "/analysis" },
    { text: "Messaging", icon: <Campaign />, path: "/messaging" },
    { divider: true },
    { text: "Voter List", icon: <Phone />, path: "/voters" },
    { text: "Walk Lists", icon: <DirectionsWalk />, path: "/walk-lists" },
    { text: "Name Search", icon: <SearchIcon />, path: "/name-search" },
    { divider: true },
    { text: "Settings", icon: <Settings />, path: "/settings" },
    // Admin only
    ...(claims?.role === "state_admin"
      ? [{ text: "Firebase", icon: <DataObjectIcon />, path: "/admin" }]
      : []),
  ];

  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);

  // === Earned Badges with SVG icons and tooltips ===
  const earnedBadges = [
    { id: 1, icon: BadgeTrophy, tooltip: "100 Doors Knocked" },
    { id: 2, icon: BadgeFirstTimer, tooltip: "First-Time User" },
    { id: 3, icon: BadgeTeamLeader, tooltip: "Team Leader" },
    { id: 4, icon: BadgeMailMaster, tooltip: "Mail Ballot Master" },
    { id: 5, icon: BadgeTopRecruiter, tooltip: "Top Recruiter" },
  ];

  const drawer = (
    <Box>
      <Toolbar sx={{ justifyContent: "center", py: 3 }}>
        <Logo />
      </Toolbar>

      <Divider />

      <List sx={{ px: 2 }}>
        {menuItems.map((item, index) => {
          if ("divider" in item) {
            return <Divider key={`divider-${index}`} sx={{ my: 2 }} />;
          }

          const isActive = location.pathname === item.path;

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (!isDesktop) setMobileOpen(false);
                }}
                sx={{
                  // Subtle primary tint instead of full color
                  bgcolor: isActive ? "primary.50" : "transparent",
                  "&:hover": {
                    bgcolor: isActive ? "primary.100" : "action.hover",
                  },
                  // No border radius
                  borderRadius: 0,
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? "primary.main" : "text.secondary",
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "primary.main" : "text.primary",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}

        <ListItem disablePadding sx={{ mt: 4 }}>
          <ListItemButton onClick={handleSignOut}>
            <ListItemIcon>
              <Logout />
            </ListItemIcon>
            <ListItemText primary="Log Out" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      {/* Drawer */}
      <Drawer
        variant={isDesktop ? "permanent" : "temporary"}
        open={isDesktop || mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: "background.paper",
            borderRight: 1,
            borderColor: "divider",
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}
      >
        {/* Mobile Top Bar */}
        {!isDesktop && (
          <AppBar
            position="fixed"
            sx={{ bgcolor: "primary.main", zIndex: theme.zIndex.drawer + 1 }}
          >
            <Toolbar>
              <IconButton
                color="inherit"
                onClick={handleDrawerToggle}
                edge="start"
              >
                <MenuIcon />
              </IconButton>
              <Box sx={{ flexGrow: 1, textAlign: "center", mr: 5 }}>
                <Logo />
              </Box>
            </Toolbar>
          </AppBar>
        )}

        {/* Sticky Header */}
        <Box
          sx={{
            bgcolor: "background.paper",
            borderBottom: 1,
            borderColor: "divider",
            position: "sticky",
            top: 0,
            zIndex: 1100,
            ...(isMobile && { pt: "56px" }),
          }}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            {/* Left: Breadcrumbs */}
            <Breadcrumbs aria-label="breadcrumb">
              <IconButton size="small" onClick={() => navigate("/dashboard")}>
                <HomeWork color="primary" />
              </IconButton>
              <Typography variant="h6" fontWeight="medium" color="text.primary">
                {breadcrumbName}
              </Typography>
            </Breadcrumbs>

            <Stack direction="row" spacing={1} alignItems="center">
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ display: "inline-flex", pr: 4 }}
              >
                {/* Badges with SVG icons and tooltips */}
                {earnedBadges.map((badge) => (
                  <Tooltip key={badge.id} title={badge.tooltip} arrow>
                    <Box
                      component="img"
                      src={badge.icon}
                      alt={badge.tooltip}
                      sx={{ width: 24, height: 24, flexShrink: 0 }}
                    />
                  </Tooltip>
                ))}

                {/* Placeholder if no badges */}
                {earnedBadges.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Earn badges by completing goals!
                  </Typography>
                )}
              </Stack>

              {/* Right: Badges already above, now Role, Org, Settings, Avatar */}

              {/* Role Icon */}
              {userRole && ROLE_ICONS[userRole] && (
                <Tooltip
                  title={userRole
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                >
                  <Box
                    component="img"
                    src={ROLE_ICONS[userRole]}
                    alt={userRole}
                    sx={{ height: 32 }}
                  />
                </Tooltip>
              )}

              {/* Org Icon */}
              {userOrgId && ORG_ICONS[userOrgId] && (
                <Tooltip
                  title={userOrgId
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                >
                  <Box
                    component="img"
                    src={ORG_ICONS[userOrgId]}
                    alt="Org"
                    sx={{ height: 36 }}
                  />
                </Tooltip>
              )}

              <Tooltip title="Settings">
                <IconButton onClick={() => navigate("/settings")}>
                  <Settings />
                </IconButton>
              </Tooltip>

              <Tooltip title={user?.displayName || user?.email || "User"}>
                <IconButton onClick={handleAvatarClick}>
                  <Avatar
                    src={user?.photoURL ?? ""}
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: user?.photoURL ? "transparent" : "gold.main", // Gold background if no photo
                      color: "gold.contrastText", // White text for contrast
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                    }}
                  >
                    {(user?.displayName || user?.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                <MenuItem
                  onClick={() => {
                    handleMenuClose();
                    navigate("/settings");
                  }}
                >
                  <Settings fontSize="small" sx={{ mr: 1 }} />
                  Settings
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleMenuClose();
                    handleSignOut();
                  }}
                >
                  <Logout fontSize="small" sx={{ mr: 1 }} />
                  Log Out
                </MenuItem>

                {/* Version & Database Info – caption style */}
                <Divider sx={{ my: 1 }} />

                <MenuItem
                  disableRipple
                  disabled
                  sx={{
                    opacity: 0.7,
                    cursor: "default",
                    py: 0.2,
                    fontWeight: 500,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      width: "100%",
                      textAlign: "left",
                      fontWeight: 500,
                    }}
                  >
                    Version: {appControl?.current_app_version || "—"}
                  </Typography>
                </MenuItem>

                <MenuItem
                  disableRipple
                  disabled
                  sx={{
                    opacity: 0.7,
                    cursor: "default",
                    py: 0.2,
                    fontWeight: 500,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ width: "100%", textAlign: "left", fontWeight: 500 }}
                  >
                    Database: {appControl?.current_db_version || "—"}
                  </Typography>
                </MenuItem>
              </Menu>
            </Stack>
          </Toolbar>
        </Box>

        {/* Page Content */}
        <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3, md: 4 } }}>
          {children || <Outlet />}
        </Box>
      </Box>
    </Box>
  );
}
