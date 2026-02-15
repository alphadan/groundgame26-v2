import React from "react";
import { Box, Typography, Link, Stack, Container } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

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
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 2, sm: 4 }}
          justifyContent="center"
          alignItems="center"
          sx={{ mb: 3 }}
        >
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

        <Box textAlign="center">
          <Typography variant="caption" color="text.secondary">
            © 2026 Ground Game 26. Built for Civic Education & Voter Engagement.
          </Typography>
        </Box>
        <Box textAlign="center">
          <Typography variant="caption" color="text.secondary">
            Paid for by GroundGame26. Not authorized by any candidate or
            candidate's committee.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};
