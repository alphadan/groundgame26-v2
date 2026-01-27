// src/app/admin/surveys/SurveyResults.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";

import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Model } from "survey-core"; // Needed to create a Survey Model instance
import {
  VisualizationPanel,
  IVisualizationPanelOptions,
} from "survey-analytics";
import "survey-core/survey-core.min.css";
import "survey-analytics/survey.analytics.min.css";
import "./survey-styles.css";
export default function SurveyResults() {
  const { survey_id } = useParams<{ survey_id: string }>();
  const navigate = useNavigate();

  const [surveyJson, setSurveyJson] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch survey meta + JSON
  useEffect(() => {
    if (!survey_id) return;

    const loadData = async () => {
      try {
        // 1. Get survey meta to find jsonPath
        const metaQuery = query(
          collection(db, "surveys"),
          where("survey_id", "==", survey_id),
        );
        const metaSnap = await getDocs(metaQuery);
        if (metaSnap.empty) throw new Error("Survey meta not found");

        const metaDoc = metaSnap.docs[0].data();
        const jsonPath = metaDoc.jsonPath;

        if (!jsonPath) throw new Error("No JSON path defined for this survey");

        // 2. Load JSON from Storage
        const fileRef = ref(storage, jsonPath);
        const url = await getDownloadURL(fileRef);
        const resp = await fetch(url, { cache: "force-cache" });
        if (!resp.ok) throw new Error("Failed to load survey JSON");
        const json = await resp.json();
        setSurveyJson(json);

        // 3. Load all responses for this survey_id
        const respQuery = query(
          collection(db, "surveyResponses"),
          where("survey_id", "==", survey_id),
          orderBy("submittedAt", "desc"),
        );
        const respSnap = await getDocs(respQuery);
        const respData = respSnap.docs.map((doc) => doc.data());
        setResponses(respData);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load results");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [survey_id]);

  // Mount VisualizationPanel once we have data
  const vizContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!surveyJson || responses.length === 0 || !vizContainerRef.current)
      return;

    // 1. Create a temporary Survey Model to get access to .getAllQuestions()
    const surveyModel = new Model(surveyJson);

    // 2. Prepare options (optional but recommended)
    const vizOptions: IVisualizationPanelOptions = {
      labelTruncateLength: 27, // Shorten long labels
      allowHideQuestions: true, // Let admins hide irrelevant questions

      // haveCommercialLicense: true, // Uncomment if you have a paid license
    };

    // 3. Instantiate VisualizationPanel correctly:
    //    - First arg: surveyModel.getAllQuestions() → Question[]
    //    - Second arg: responses (array of response objects)
    //    - Third arg: options
    const vizPanel = new VisualizationPanel(
      surveyModel.getAllQuestions(),
      responses,
      vizOptions,
    );

    // 4. Render into the container
    vizPanel.render(vizContainerRef.current);

    // Cleanup on unmount / data change
    return () => {
      vizPanel.destroy(); // Correct method – removes from DOM and cleans up
    };
  }, [surveyJson, responses, survey_id]); // Add survey_id if it affects title/options

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error || !surveyJson) {
    return (
      <Box sx={{ p: 4, maxWidth: 800, mx: "auto" }}>
        <Alert severity="error">
          {error || "Unable to load survey results. Please try again."}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Admin-style header – matches SurveysManagement.tsx */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <IconButton
          onClick={() => navigate(-1)}
          color="primary"
          size="large"
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon fontSize="large" />
        </IconButton>

        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Survey Results: {survey_id}
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Aggregated responses and visualizations
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {responses.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No responses have been submitted for this survey yet.
        </Alert>
      ) : (
        <>
          <Typography variant="body1" gutterBottom sx={{ mb: 3 }}>
            <strong>{responses.length}</strong> response
            {responses.length !== 1 ? "s" : ""} collected
          </Typography>

          <Paper
            elevation={3}
            sx={{
              p: 2,
              borderRadius: 3,
              minHeight: "500px",
              overflow: "hidden",
            }}
          >
            <div
              ref={vizContainerRef}
              style={{ height: "100%", minHeight: "500px" }}
            />
          </Paper>
        </>
      )}
    </Box>
  );
}
