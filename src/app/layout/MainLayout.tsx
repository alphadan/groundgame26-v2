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
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import Logo from "../../components/ui/Logo";

const drawerWidth = 280;

export default function MainLayout({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, claims } = useAuth();
  const [realBadges, setRealBadges] = useState<any[]>([]);

  console.log(
    "MainLayout: Rendering. Desktop Mode:",
    isDesktop,
    "User UID:",
    user?.uid,
  );

  const canManageTeam = !!claims?.permissions?.can_manage_team;

  const handleSignOut = useCallback(async () => {
    console.log("MainLayout: Executing Sign Out");
    await signOut(auth);
    navigate("/", { replace: true });
  }, [navigate]);

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
    if (canManageTeam)
      items.push({ text: "Admin", icon: <DataObjectIcon />, path: "/admin" });

    console.log("MainLayout: Generated", items.length, "menu items");
    return items;
  }, [canManageTeam]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToUserBadges(user.uid, setRealBadges);
  }, [user?.uid]);

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
                sx={{
                  bgcolor: isActive ? "primary.50" : "transparent",
                  "&:hover": {
                    bgcolor: isActive ? "primary.100" : "action.hover",
                  },
                  borderRadius: 0,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? "inherit" : "text.secondary",
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
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {!isDesktop && (
        <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap>
              GroundGame26
            </Typography>
          </Toolbar>
        </AppBar>
      )}

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
          p: { xs: 2, md: 3 },
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {!isDesktop && <Toolbar />}
        {/* Render actual content here */}
        <Box sx={{ flexGrow: 1 }}>{children || <Outlet />}</Box>
      </Box>
    </Box>
  );
}
