// src/components/layout/PublicPageLayout.tsx
import React from "react";
import { Box, Container, Button, Typography, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Logo from "../../components/ui/Logo";

interface PublicPageLayoutProps {
  children: React.ReactNode;
  title: string;
}

export const PublicPageLayout: React.FC<PublicPageLayoutProps> = ({
  children,
  title,
}) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh", py: 6 }}>
      <Container maxWidth="md">
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 4 }}
        >
          <Logo />
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/login")}
          >
            Back to Login
          </Button>
        </Stack>

        <Typography variant="h3" fontWeight="bold" color="primary" gutterBottom>
          {title}
        </Typography>

        <Box sx={{ mt: 4 }}>{children}</Box>
      </Container>
    </Box>
  );
};
