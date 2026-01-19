// src/components/layout/PublicFooter.tsx
import React from "react";
import {
  Box,
  Typography,
  Link,
  Stack,
  Container,
  IconButton,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import FacebookIcon from "@mui/icons-material/Facebook";
import TwitterIcon from "@mui/icons-material/X"; // Updated for X/Twitter
import InstagramIcon from "@mui/icons-material/Instagram";

export const PublicFooter = () => {
  return (
    <Box
      component="footer"
      sx={{
        py: 6,
        px: 2,
        mt: "auto",
        backgroundColor: "background.paper",
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Container maxWidth="md">
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={4}
          justifyContent="space-between"
          alignItems={{ xs: "center", md: "flex-start" }}
          textAlign={{ xs: "center", md: "left" }}
        >
          {/* Quick Links */}
          <Link
            component={RouterLink}
            to="/volunteer"
            variant="body2"
            color="inherit"
            underline="hover"
          >
            Want to Volunteer?
          </Link>
          <Link
            component={RouterLink}
            to="/about"
            variant="body2"
            color="inherit"
            underline="hover"
          >
            About Our Mission
          </Link>
          <Link
            component={RouterLink}
            to="/contact"
            variant="body2"
            color="inherit"
            underline="hover"
          >
            Contact Us
          </Link>
        </Stack>
      </Container>
    </Box>
  );
};
