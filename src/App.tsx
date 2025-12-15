import React, { useEffect } from "react";
import { db } from "./lib/firebase";
import { collection, getDocsFromServer } from "firebase/firestore";
import { Box, Typography, CircularProgress } from "@mui/material";

function App() {
  useEffect(() => {
    const test = async () => {
      console.log("🔥 Testing Firestore connection...");
      const snapshot = await getDocsFromServer(collection(db, "counties"));
      console.log("Counties from server:", snapshot.size);
      snapshot.docs.forEach((doc) => console.log(doc.id, doc.data()));
    };
    test();
  }, []);

  return (
    <Box p={8}>
      <Typography variant="h4">GroundGame26 v2</Typography>
      <Typography>Open console → check for counties size</Typography>
    </Box>
  );
}

export default App;
