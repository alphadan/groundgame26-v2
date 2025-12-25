// src/app/layout/MainLayout.tsx
import React, { useState, useEffect, useCallback, ReactNode } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
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
} from "@mui/material";
import {
  BarChart,
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

// Icons (safe fallbacks)
import GopElephant from "../../assets/icons/gop-elephant.svg";
import CandidateRosette from "../../assets/icons/candidate-rosette.svg";
import CountyChairCrown from "../../assets/icons/county-chair-crown.svg";
import AreaChairBadge from "../../assets/icons/area-chair-badge.svg";
import CommitteepersonShield from "../../assets/icons/committeeperson-shield.svg";

const drawerWidth = 260;

interface MainLayoutProps {
  children?: ReactNode;
}

// === Safe Icon Maps with Fallbacks ===
const ROLE_ICONS: Record<string, string> = {
  state_admin: CommitteepersonShield,
  candidate: CandidateRosette,
  county_chair: CountyChairCrown,
  area_chair: AreaChairBadge,
  committeeperson: CommitteepersonShield,
  ambassador: CandidateRosette,
  // Add more as needed
};

const ORG_ICONS: Record<string, string> = {
  chester_gop: GopElephant,
  // Add more organizations
};

export default function MainLayout({ children }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width:1200px)");
  const navigate = useNavigate();
  const location = useLocation();

  const { user, claims, isLoaded } = useAuth();

  // === Safe Derived Values ===
  const userRole =
    typeof claims?.role === "string" ? claims.role.toLowerCase() : null;
  const userOrgId = typeof claims?.org_id === "string" ? claims.org_id : null;

  // Avatar menu
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);

  // === Safe Sign Out ===
  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out failed:", err);
      // Still navigate away – best effort
    } finally {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // === Breadcrumb ===
  const pathnames = location.pathname.split("/").filter(Boolean);
  const breadcrumbName =
    pathnames.length > 0
      ? pathnames[pathnames.length - 1]
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())
      : "Dashboard";

  // === Menu Items (Dynamic & Safe) ===
  const menuItems = [
    { text: "Dashboard", icon: <HomeWork />, path: "/dashboard" },
    { text: "Reports", icon: <BarChart />, path: "/reports" },
    { text: "Analysis", icon: <Analytics />, path: "/analysis" },
    { text: "Actions", icon: <Campaign />, path: "/actions" },
    { divider: true },
    { text: "Voter List", icon: <Phone />, path: "/voters" },
    { text: "Walk Lists", icon: <DirectionsWalk />, path: "/walk-lists" },
    { text: "Name Search", icon: <SearchIcon />, path: "/name-search" },
    { divider: true },
    { text: "Settings", icon: <Settings />, path: "/settings" },
  ];

  // Admin-only items
  menuItems.push({
    text: "Firebase",
    icon: <DataObjectIcon />,
    path: "/admin", // ← make sure this matches your route
  });

  const drawer = (
    <Box>
      <Toolbar sx={{ mt: 2, mb: 2, justifyContent: "center" }}>
        <Logo />
      </Toolbar>
      <List>
        {menuItems.map((item, index) => {
          if ("divider" in item) {
            return (
              <Box
                key={`divider-${index}`}
                sx={{ my: 2, mx: 2, borderTop: 1, borderColor: "divider" }}
              />
            );
          }

          const isActive = location.pathname === item.path;

          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (!isDesktop) setMobileOpen(false);
                }}
                sx={{
                  borderLeft: isActive ? 4 : 0,
                  borderColor: "#B22234",
                  pl: isActive ? 2.5 : 3,
                  backgroundColor: isActive
                    ? "rgba(178, 34, 52, 0.08)"
                    : "transparent",
                  "&:hover": { backgroundColor: "rgba(178, 34, 52, 0.12)" },
                }}
              >
                <ListItemIcon
                  sx={{ color: isActive ? "#B22234" : "inherit", minWidth: 40 }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? "bold" : "medium",
                    color: isActive ? "#B22234" : "inherit",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}

        <ListItem disablePadding>
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

  // === Mobile Drawer Toggle ===
  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Permanent Desktop Drawer */}
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
            bgcolor: "#fafafa",
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}
      >
        {/* Top App Bar (Mobile Only) */}
        {!isDesktop && (
          <AppBar
            position="fixed"
            sx={{
              bgcolor: "#B22234",
              zIndex: (theme) => theme.zIndex.drawer + 1,
            }}
          >
            <Toolbar>
              <IconButton
                color="inherit"
                onClick={handleDrawerToggle}
                edge="start"
              >
                <MenuIcon />
              </IconButton>
              <Box sx={{ flexGrow: 1, textAlign: "center" }}>
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
            zIndex: 1099,
            ...(!isDesktop && { mt: "64px" }), // Offset for mobile app bar
          }}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Breadcrumbs aria-label="breadcrumb">
              <IconButton size="small" onClick={() => navigate("/dashboard")}>
                <HomeWork sx={{ color: "#B22234" }} />
              </IconButton>
              <Typography color="text.primary" fontWeight="medium">
                {breadcrumbName}
              </Typography>
            </Breadcrumbs>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
                    alt="Organization"
                    sx={{ height: 36 }}
                  />
                </Tooltip>
              )}

              <Tooltip title="Settings">
                <IconButton onClick={() => navigate("/settings")}>
                  <Settings />
                </IconButton>
              </Tooltip>

              {/* Avatar Menu */}
              <Tooltip title={user?.displayName || user?.email || "User"}>
                <IconButton onClick={handleAvatarClick}>
                  <Avatar
                    src={user?.photoURL ?? ""}
                    sx={{ width: 40, height: 40 }}
                  >
                    {(user?.displayName ||
                      user?.email ||
                      "U")[0]?.toUpperCase()}
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
              </Menu>
            </Box>
          </Toolbar>
        </Box>

        {/* Page Content */}
        <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
          {children || <Outlet />}
        </Box>
      </Box>
    </Box>
  );
}
