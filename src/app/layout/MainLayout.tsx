import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { subscribeToUserBadges } from "../../services/badgeService";
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
  Tooltip,
  Stack,
  Divider,
  useTheme,
  Avatar,
  Menu,
  MenuItem,
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
  DataObject as DataObjectIcon,
} from "@mui/icons-material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import Logo from "../../components/ui/Logo";

const drawerWidth = 280;

export default function MainLayout({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get live profile data from Context
  const { user, userProfile, claims } = useAuth();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [realBadges, setRealBadges] = useState<any[]>([]);

  // Permissions check
  const canManageTeam = !!claims?.permissions?.can_manage_team;

  const [appControl] = useState({
    current_app_version: "2.1.0",
    current_db_version: "2026.Q1",
  });

  const breadcrumbName = useMemo(() => {
    const path = location.pathname;
    if (path.includes("dashboard")) return "Dashboard";
    if (path.includes("voters")) return "Voter Contact";
    if (path.includes("walk-lists")) return "Walk Lists";
    if (path.includes("name-search")) return "Name Search";
    if (path.includes("settings")) return "Settings";
    if (path.includes("admin")) return "Admin";
    return "Ground Game";
  }, [location.pathname]);

  const handleSignOut = useCallback(async () => {
    await signOut(auth);
    navigate("/", { replace: true });
  }, [navigate]);

  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToUserBadges(user.uid, setRealBadges);
  }, [user?.uid]);

  const menuItems = useMemo(() => {
    const items = [
      { text: "Dashboard", icon: <HomeWork />, path: "/dashboard" },
      { text: "Analysis", icon: <Analytics />, path: "/analysis" },
      { text: "Resources", icon: <Campaign />, path: "/resources" },
      { divider: true },
      { text: "Voter List", icon: <Phone />, path: "/voters" },
      { text: "Walk Lists", icon: <DirectionsWalk />, path: "/walk-lists" },
      { text: "Name Search", icon: <SearchIcon />, path: "/name-search" },
      { divider: true },
      { text: "Settings", icon: <Settings />, path: "/settings" },
      { text: "How to Use", icon: <TipsAndUpdatesIcon />, path: "/how-to-use" },
    ];
    if (canManageTeam) {
      items.push({ text: "Admin", icon: <DataObjectIcon />, path: "/admin" });
    }
    return items;
  }, [canManageTeam]); // Fixed: Added missing canManageTeam to dependency array

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ justifyContent: "center", py: 3 }}>
        <Logo width={140} />
      </Toolbar>
      <Divider />
      <List sx={{ px: 2, flexGrow: 1 }}>
        {menuItems.map((item, index) => {
          if ("divider" in item) return <Divider key={index} sx={{ my: 1 }} />;
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isActive}
                onClick={() => {
                  navigate(item.path);
                  if (!isDesktop) setMobileOpen(false);
                }}
                sx={{ borderRadius: 1 }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? "primary.main" : "text.secondary",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider />
      <List sx={{ px: 2 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={handleSignOut} sx={{ borderRadius: 2 }}>
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
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "grey.50" }}>
      <Box
        component="nav"
        sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}
      >
        <Drawer
          variant={isDesktop ? "permanent" : "temporary"}
          open={isDesktop || mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Toolbar
            sx={{ justifyContent: "space-between", px: { xs: 2, sm: 3 } }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              {!isDesktop && (
                <IconButton
                  color="inherit"
                  edge="start"
                  onClick={() => setMobileOpen(true)}
                  sx={{ mr: 1 }}
                >
                  <MenuIcon />
                </IconButton>
              )}
              <Breadcrumbs aria-label="breadcrumb">
                <IconButton
                  size="small"
                  onClick={() => navigate("/dashboard")}
                  sx={{ color: "primary.main" }}
                >
                  <HomeWork />
                </IconButton>
                <Typography variant="h6" fontWeight="bold" color="text.primary">
                  {breadcrumbName}
                </Typography>
              </Breadcrumbs>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              {/* GAMIFIED POINTS HUD */}
              <Tooltip title="Your Total Rewards Points" arrow>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    bgcolor: "primary.50",
                    px: { xs: 1.5, sm: 2 },
                    py: 0.75,
                    borderRadius: "24px",
                    border: "2px solid",
                    borderColor: "#4527a0", // Dark Purple border
                    boxShadow: "0px 2px 4px rgba(0,0,0,0.05)",
                    transition: "transform 0.2s, background-color 0.2s",
                    cursor: "pointer",
                    "&:hover": {
                      transform: "scale(1.05)",
                      bgcolor: "primary.100",
                    },
                  }}
                  onClick={() => navigate("/settings")}
                >
                  <Stack direction="row" alignItems="baseline" spacing={1}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 900,
                        textTransform: "uppercase",
                        fontSize: "0.7rem",
                        color: "#4527a0", // Matching Dark Purple text
                        letterSpacing: 1,
                      }}
                    >
                      Points:
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 900,
                        color: "text.primary",
                        fontFamily: "'Roboto Mono', monospace",
                        fontSize: "1.1rem",
                      }}
                    >
                      {userProfile?.points_balance?.toLocaleString() || 0}
                    </Typography>
                  </Stack>
                </Box>
              </Tooltip>

              <Stack
                direction="row"
                spacing={1}
                sx={{ mx: 1, display: { xs: "none", sm: "flex" } }}
              >
                {realBadges.map((badge) => (
                  <Tooltip key={badge.id} title={badge.badge_title}>
                    <Typography
                      sx={{
                        fontSize: "1.5rem",
                        cursor: "default",
                        transition: "transform 0.2s",
                        "&:hover": { transform: "scale(1.3) rotate(10deg)" },
                      }}
                    >
                      {badge.badge_unicode}
                    </Typography>
                  </Tooltip>
                ))}
              </Stack>

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
                      bgcolor: "gold.main",
                      color: "#000",
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                      border: "2px solid white",
                      boxShadow: 2,
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
                  <Settings fontSize="small" sx={{ mr: 1 }} /> Settings
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleMenuClose();
                    handleSignOut();
                  }}
                >
                  <Logout fontSize="small" sx={{ mr: 1 }} /> Log Out
                </MenuItem>
                <Divider />
                <MenuItem disabled sx={{ opacity: 0.7, py: 0.2 }}>
                  <Typography variant="caption" fontWeight={600}>
                    Version: {appControl.current_app_version}
                  </Typography>
                </MenuItem>
                <MenuItem disabled sx={{ opacity: 0.7, py: 0.2 }}>
                  <Typography variant="caption" fontWeight={600}>
                    Database: {appControl.current_db_version}
                  </Typography>
                </MenuItem>
              </Menu>
            </Stack>
          </Toolbar>
        </Box>

        <Box sx={{ flexGrow: 1, p: { xs: 2, md: 4 } }}>
          {children || <Outlet />}
        </Box>
      </Box>
    </Box>
  );
}
