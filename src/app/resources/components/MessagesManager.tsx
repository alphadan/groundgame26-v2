// src/app/resources/components/MessagesManager.tsx
import React, { useState, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../lib/firebase";
import { FilterSelector } from "../../../components/FilterSelector";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  LinearProgress,
  TablePagination,
  Paper,
} from "@mui/material";
import {
  ContentCopy as ContentCopyIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
} from "@mui/icons-material";

import { FilterValues, MessageTemplate } from "../../../types";

interface MessagesManagerProps {
  onNotify: (message: string) => void;
}

export const MessagesManager: React.FC<MessagesManagerProps> = ({
  onNotify,
}) => {
  const { isLoaded } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestedMessages, setSuggestedMessages] = useState<MessageTemplate[]>(
    []
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);

  const getMessageIdeas = httpsCallable<any, { templates: MessageTemplate[] }>(
    functions,
    "getMessageIdeas"
  );
  const toggleFavoriteMessage = httpsCallable<{ templateId: string }, any>(
    functions,
    "toggleFavoriteMessage"
  );
  const incrementCopyCount = httpsCallable<{ templateId: string }, any>(
    functions,
    "incrementCopyCount"
  );

  const handleToggleFavorite = async (templateId: string) => {
    setSuggestedMessages((prev) =>
      prev.map((msg) =>
        msg.id === templateId
          ? { ...msg, favorite_count: (msg.favorite_count || 0) > 0 ? 0 : 1 }
          : msg
      )
    );
    try {
      await toggleFavoriteMessage({ templateId });
    } catch (err) {
      console.error("Favorite toggle failed:", err);
    }
  };

  const handleCopyMessage = async (msg: MessageTemplate) => {
    try {
      await navigator.clipboard.writeText(msg.body);
      onNotify(`"${msg.subject_line}" copied to clipboard!`);
      incrementCopyCount({ templateId: msg.id });
    } catch (err) {
      onNotify("Copy failed — please select and copy manually.");
    }
  };

  const handleSubmit = useCallback(
    async (submittedFilters: FilterValues) => {
      setIsSubmitting(true);
      setLoadingMessages(true);
      setMessageError("");
      setSuggestedMessages([]);
      setPage(0);

      // DEBUG: See what the FilterSelector is actually giving you
      // console.log("Filters received from Selector:", submittedFilters);

      try {
        const result = await getMessageIdeas({
          ageGroup: submittedFilters.ageGroup || "all",
          party:
            submittedFilters.party === "R"
              ? "Republican"
              : submittedFilters.party === "D"
              ? "Democrat"
              : submittedFilters.party || "all",
          turnout: submittedFilters.turnout || "all",
          mailBallot: submittedFilters.mailBallot || "all",
        });

        console.log("Filters received from Selector:", submittedFilters);

        console.log("Cloud Function Result:", result.data);

        const templates = result.data?.templates || [];
        setSuggestedMessages(templates);

        if (templates.length === 0)
          setMessageError("No message templates found.");
      } catch (err: any) {
        setMessageError(err?.message || "Failed to generate messages.");
      } finally {
        setLoadingMessages(false);
        setIsSubmitting(false);
      }
    },
    [getMessageIdeas]
  );

  const paginatedMessages = suggestedMessages.slice(
    page * pageSize,
    page * pageSize + pageSize
  );

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (!isLoaded) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Message Ideas
      </Typography>
      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        unrestrictedFilters={["party", "ageGroup", "mailBallot", "turnout"]}
        showLocationFilters={false}
      />

      {loadingMessages ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <CircularProgress size={60} />
        </Box>
      ) : messageError ? (
        <Alert severity="warning" sx={{ my: 3 }}>
          {messageError}
        </Alert>
      ) : (
        <>
          <Grid container spacing={3} sx={{ mt: 4 }}>
            {paginatedMessages.map((msg) => (
              <Grid key={msg.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <Card
                  elevation={3}
                  sx={{
                    height: 420, // Fixed height for uniformity
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 3,
                  }}
                >
                  <CardContent
                    sx={{
                      flexGrow: 1,
                      overflowY: "auto", // Vertical scroll inside the card
                      paddingBottom: 1,
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      sx={{ mb: 1 }}
                    >
                      <Typography
                        variant="h6"
                        fontWeight="bold"
                        sx={{ lineHeight: 1.2 }}
                      >
                        {msg.subject_line}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleFavorite(msg.id)}
                        color={
                          (msg.favorite_count || 0) > 0 ? "error" : "default"
                        }
                      >
                        {(msg.favorite_count || 0) > 0 ? (
                          <FavoriteIcon />
                        ) : (
                          <FavoriteBorderIcon />
                        )}
                      </IconButton>
                    </Stack>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {msg.body}
                    </Typography>
                  </CardContent>

                  <CardActions
                    sx={{ borderTop: `1px solid rgba(0,0,0,0.1)`, p: 1.5 }}
                  >
                    <Button
                      startIcon={<ContentCopyIcon />}
                      onClick={() => handleCopyMessage(msg)}
                      variant="contained"
                      size="small"
                      fullWidth
                    >
                      Copy Message
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {suggestedMessages.length > 0 && (
            <TablePagination
              component="div"
              count={suggestedMessages.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={pageSize}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[8, 16, 24]} // Your requested paging numbers
              sx={{ mt: 2 }}
            />
          )}
        </>
      )}
    </Box>
  );
};
