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
  Tooltip,
  Stack,
  Divider,
  useTheme,
  Avatar,
  Menu,
  MenuItem,
  CssBaseline,
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
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { user, userProfile, claims } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [realBadges, setRealBadges] = useState<any[]>([]);

  const canManageTeam = !!claims?.permissions?.can_manage_team;

  const [appControl] = useState({
    current_app_version: "2.1.0",
    current_db_version: "2026.Q1",
  });

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
  }, [canManageTeam]);

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
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      {/* CssBaseline ensures the background color is applied to the body */}
      <CssBaseline />

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
              bgcolor: "background.paper", // Theme aware drawer
              borderRight: "1px solid",
              borderColor: "divider",
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
          bgcolor: "background.default", // Theme aware main background
        }}
      >
        <AppBar
          position="static"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Toolbar sx={{ py: isMobile ? 1 : 0 }}>
            <Stack
              direction="column"
              sx={{ width: "100%" }}
              spacing={isMobile ? 1.5 : 0}
            >
              {/* ROW 1: Mobile (Menu + Actions) / Desktop (Everything) */}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ width: "100%" }}
              >
                {/* Left Side: Hamburger Menu */}
                <Box sx={{ display: "flex", alignItems: "center" }}>
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

                  {/* On Desktop, Badges stay here next to the menu/logo area */}
                  {!isMobile && (
                    <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
                      {realBadges.map((badge) => (
                        <Tooltip key={badge.id} title={badge.badge_title}>
                          <Typography
                            sx={{
                              fontSize: "1.5rem",
                              cursor: "default",
                              transition: "transform 0.2s",
                              "&:hover": {
                                transform: "scale(1.3) rotate(10deg)",
                              },
                            }}
                          >
                            {badge.badge_unicode}
                          </Typography>
                        </Tooltip>
                      ))}
                    </Stack>
                  )}
                </Box>

                {/* Right Side: Settings + Avatar */}
                <Stack direction="row" spacing={1} alignItems="center">
                  {/* On Desktop, Points stay here */}
                  {!isMobile && (
                    <Tooltip title="Your Rewards Points" arrow>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          bgcolor: "primary.50",
                          px: 2,
                          py: 0.5,
                          borderRadius: "24px",
                          border: "2px solid",
                          borderColor: "#4527a0",
                          cursor: "pointer",
                          mr: 1,
                        }}
                        onClick={() => navigate("/settings")}
                      >
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 900, mr: 1, color: "#4527a0" }}
                        >
                          POINTS:
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 900,
                            fontFamily: "'Roboto Mono', monospace",
                          }}
                        >
                          {userProfile?.points_balance?.toLocaleString() || 0}
                        </Typography>
                      </Box>
                    </Tooltip>
                  )}

                  <IconButton
                    size="small"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings />
                  </IconButton>

                  <IconButton onClick={handleAvatarClick} sx={{ p: 0 }}>
                    <Avatar
                      src={user?.photoURL ?? ""}
                      sx={{
                        width: 38,
                        height: 38,
                        bgcolor: "gold.main",
                        border: "2px solid white",
                        boxShadow: 2,
                      }}
                    >
                      {(user?.displayName || user?.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </Avatar>
                  </IconButton>
                </Stack>
              </Stack>

              {/* ROW 2: Mobile ONLY (Badges + Points) */}
              {isMobile && (
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ width: "100%", pt: 0.5 }}
                >
                  {/* Badges on the Left */}
                  <Stack direction="row" spacing={1}>
                    {realBadges.map((badge) => (
                      <Typography key={badge.id} sx={{ fontSize: "1.8rem" }}>
                        {badge.badge_unicode}
                      </Typography>
                    ))}
                  </Stack>

                  {/* Points on the Right */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      bgcolor: "primary.50",
                      px: 1.5,
                      py: 0.2,
                      borderRadius: "24px",
                      border: "2px solid",
                      borderColor: "#4527a0",
                    }}
                    onClick={() => navigate("/settings")}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 900,
                        mr: 0.5,
                        color: "#4527a0",
                        fontSize: "0.65rem",
                      }}
                    >
                      POINTS:
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 900, fontSize: "0.9rem" }}
                    >
                      {userProfile?.points_balance?.toLocaleString() || 0}
                    </Typography>
                  </Box>
                </Stack>
              )}
            </Stack>
          </Toolbar>
        </AppBar>

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
          <MenuItem disabled sx={{ opacity: 0.7, py: 0.5 }}>
            <Typography variant="caption">
              v{appControl.current_app_version}
            </Typography>
          </MenuItem>
        </Menu>

        {/* This container area holds the Outlet and is now theme-sensitive */}
        <Box
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 4 },
            bgcolor: "background.default",
            color: "text.primary",
            overflowY: "auto",
          }}
        >
          {children || <Outlet />}
        </Box>
      </Box>
    </Box>
  );
}
