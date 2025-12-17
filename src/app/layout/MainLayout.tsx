import { useState, useEffect, ReactNode } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth"; // Only need signOut now
import { auth } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext"; // <-- NEW: Import useAuth
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
  LocationOn,
  Home as HomeIcon,
  Settings,
} from "@mui/icons-material";
import SearchIcon from "@mui/icons-material/Search";
import DataObjectIcon from "@mui/icons-material/DataObject";
import Logo from "../../components/ui/Logo";

// Icons
import GopElephant from "../../assets/icons/gop-elephant.svg";
import CandidateRosette from "../../assets/icons/candidate-rosette.svg";
import CountyChairCrown from "../../assets/icons/county-chair-crown.svg";
import AreaChairBadge from "../../assets/icons/area-chair-badge.svg";
import CommitteepersonShield from "../../assets/icons/committeeperson-shield.svg";

const drawerWidth = 260;

interface MainLayoutProps {
  children?: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width:1200px)");
  const navigate = useNavigate();
  const location = useLocation();

  // 🛑 FIX: Consume stable user and claims from context
  const { user: currentUser, claims } = useAuth();

  // 🛑 FIX: Derive role and orgId from stable claims object
  const userRole = (claims?.role as string) || null;
  const userOrgId = (claims?.org_id as string) || null;

  // Avatar dropdown
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  // Icon mappings
  const ORG_ICONS: Record<string, any> = {
    chester_gop: GopElephant,
    // Add more: chester_tpa: TpaLogo, etc.
  };

  const ROLE_ICONS: Record<string, any> = {
    state_admin: CommitteepersonShield,
    candidate: CandidateRosette,
    county_chair: CountyChairCrown,
    area_chair: AreaChairBadge,
    committeeperson: CommitteepersonShield,
    committeeman: CommitteepersonShield,
    committeewoman: CommitteepersonShield,
  };

  // 🛑 FIX: REMOVE the entire useEffect that was re-fetching auth/claims
  // and causing the infinite re-render loop. (Original lines 119-140 are gone)

  // Breadcrumb
  const pathnames = location.pathname.split("/").filter((x) => x);
  const breadcrumbName =
    pathnames.length > 0
      ? pathnames[pathnames.length - 1]
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())
      : "Dashboard";

  const baseMenuItems = [
    { text: "My Dashboard", icon: <HomeWork />, path: "/dashboard/Dashboard" },
    // { text: "My Test", icon: <HomeWork />, path: "/dashboard/TestFetch" },
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

  const menuItems = [...baseMenuItems];

  if (userRole === "state_admin") {
    menuItems.push({
      text: "Firebase",
      icon: <DataObjectIcon />,
      path: "/admin", // ← make sure this matches your route
    });
  }

  const drawer = (
    <Box>
      <Toolbar sx={{ mt: 2, mb: 2 }}>
        <Logo />
      </Toolbar>
      <List>
        {menuItems.map((item, index) => {
          if ("divider" in item) {
            return (
              <Box
                key={`divider-${index}`}
                sx={{
                  my: 2,
                  mx: 2,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              />
            );
          }

          const isActive = location.pathname === item.path;

          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  borderLeft: isActive ? 4 : 0,
                  borderColor: "#B22234",
                  pl: isActive ? 2.5 : 3,
                  backgroundColor: isActive
                    ? "rgba(211, 47, 47, 0.05)"
                    : "transparent",
                  "&:hover": { backgroundColor: "rgba(211, 47, 47, 0.08)" },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? "#B22234" : "inherit",
                    minWidth: 40,
                  }}
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
          <ListItemButton onClick={() => signOut(auth)}>
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
    <Box sx={{ display: "flex" }}>
      {/* Desktop drawer */}
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
            },
          }}
        >
          {drawer}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: drawerWidth } }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1 }}>
        {/* Mobile Top Bar */}
        {!isDesktop && (
          <AppBar position="fixed" sx={{ bgcolor: "#B22234" }}>
            <Toolbar>
              <IconButton color="inherit" onClick={() => setMobileOpen(true)}>
                <MenuIcon />
              </IconButton>
              <Logo />
            </Toolbar>
          </AppBar>
        )}

        {/* PAGE HEADER */}
        <Box
          sx={{
            bgcolor: "white",
            borderBottom: 1,
            borderColor: "divider",
            position: "sticky",
            top: 0,
            zIndex: 1099,
          }}
        >
          <Toolbar
            sx={{
              justifyContent: "space-between",
              minHeight: "64px !important",
            }}
          >
            {/* Breadcrumbs */}
            <Breadcrumbs aria-label="breadcrumb">
              <IconButton
                onClick={() => navigate("/my-precincts")}
                size="small"
              >
                <HomeIcon sx={{ color: "#B22234" }} />
              </IconButton>
              <Typography color="text.primary" fontWeight="medium">
                {breadcrumbName}
              </Typography>
            </Breadcrumbs>

            {/* RIGHT SIDE: ROLE ICON + ORG ICON + SETTINGS + AVATAR */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {/* ROLE ICON */}
              {userRole && ROLE_ICONS[userRole.toLowerCase()] && (
                <Tooltip
                  title={userRole
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                >
                  <img
                    src={ROLE_ICONS[userRole.toLowerCase()]}
                    alt={userRole}
                    style={{ height: 30 }}
                  />
                </Tooltip>
              )}
              {/* ORGANIZATION ICON */}
              {userOrgId && ORG_ICONS[userOrgId] && (
                <Tooltip
                  title={userOrgId
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                >
                  <img
                    src={ORG_ICONS[userOrgId]}
                    alt="Org"
                    style={{ height: 34 }}
                  />
                </Tooltip>
              )}

              {/* Settings */}
              <Tooltip title="Settings">
                <IconButton onClick={() => navigate("/settings")}>
                  <Settings />
                </IconButton>
              </Tooltip>

              {/* Avatar + Dropdown */}
              <Tooltip
                title={currentUser?.displayName || currentUser?.email || "User"}
              >
                <IconButton onClick={handleAvatarClick}>
                  <Avatar
                    src={currentUser?.photoURL || ""}
                    sx={{ width: 36, height: 36 }}
                  >
                    {(currentUser?.displayName ||
                      currentUser?.email ||
                      "U")[0].toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                <MenuItem
                  onClick={() => {
                    handleClose();
                    navigate("/settings");
                  }}
                >
                  <Settings fontSize="small" sx={{ mr: 1 }} />
                  Settings
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleClose();
                    signOut(auth);
                  }}
                >
                  <Logout fontSize="small" sx={{ mr: 1 }} />
                  Log Out
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </Box>

        {/* Main Content */}
        <Box p={3}>{children || <Outlet />}</Box>
      </Box>
    </Box>
  );
}
