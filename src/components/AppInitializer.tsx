// src/components/AppInitializer.tsx
import React, { useEffect, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Box, CircularProgress, Typography } from "@mui/material";

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      // This fires immediately with cached state, then again when token refreshes
      setIsReady(true);
    });

    return () => unsubscribe();
  }, []);

  if (!isReady) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={60} />
        <Typography variant="h6">Initializing GroundGame26...</Typography>
      </Box>
    );
  }

  return <>{children}</>;
};

export default AppInitializer;
