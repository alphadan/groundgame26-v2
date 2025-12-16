// src/app/dashboard/TestFetch.tsx - TEMPORARY DIAGNOSTIC FILE

import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase"; // Adjust path if necessary
import { CircularProgress, Typography, Box } from "@mui/material";

export default function TestFetch() {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setSuccess(false);

    console.log("TEST FETCH: Starting isolated query...");

    try {
      unsubscribe = onSnapshot(
        collection(db, "counties"),
        (snapshot) => {
          // SUCCESS CALLBACK (This is the log we need to see!)
          console.log(
            "✅ TEST FETCH SUCCESS! Data received. Size:",
            snapshot.size
          );
          setSuccess(true);
          setLoading(false);
        },
        (error) => {
          // ERROR CALLBACK
          console.error("❌ TEST FETCH FAILURE! Error:", error);
          setLoading(false);
        }
      );
    } catch (e) {
      // SYNCHRONOUS ERROR
      console.error("❌ TEST FETCH Sync error:", e);
      setLoading(false);
    }

    // CRITICAL CLEANUP: Runs when the component unmounts
    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log("TEST FETCH: Cleanup finished.");
      }
    };
  }, []); // Runs only ONCE when the component mounts

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="70vh"
      flexDirection="column"
    >
      {loading && <CircularProgress />}
      <Typography ml={2} variant="h6">
        {loading
          ? "Loading Test Data (Checking Firestore Connection)..."
          : success
          ? "SUCCESS: Isolated Query Completed."
          : "FAILURE: See console for error."}
      </Typography>
    </Box>
  );
}
