// src/app/messaging/ResourcesPage.tsx
import React, { useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { FilterSelector } from "../../components/FilterSelector";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Snackbar,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  useTheme,
  useMediaQuery,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
} from "@mui/material";
import {
  ContentCopy as ContentCopyIcon,
  Download as DownloadIcon,
  PictureAsPdf,
  Web as WebsiteIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from "@mui/icons-material";

import {
  FilterValues,
  MessageTemplate,
  CampaignResource,
  UsefulLink,
} from "../../types";

const SAMPLE_RESOURCES: CampaignResource[] = [
  {
    id: "brochure-2026",
    title: "2026 Republican Candidate Platform Brochure",
    description:
      "Tri-fold brochure highlighting key policies on affordability, crime, and energy",
    category: "Brochures",
    url: "https://firebasestorage.googleapis.com/v0/b/groundgame26-v2.firebasestorage.app/o/brochures%2Fsample_brochure.pdf?alt=media", // Replace with real URL
  },
  {
    id: "sample-ballot-chester",
    title: "Sample 2026 General Election Ballot - Chester County",
    description: "Mock ballot showing Republican candidates and key issues",
    category: "Ballots",
    url: "https://firebasestorage.googleapis.com/v0/b/groundgame26-v2.firebasestorage.app/o/ballots%2FPA15-15-005-BALLOT-2025.pdf?alt=media",
  },
  {
    id: "voter-reg-form",
    title: "Pennsylvania Voter Registration Form",
    description: "Official form for new registrations and party changes",
    category: "Forms",
    url: "https://firebasestorage.googleapis.com/v0/b/groundgame26-v2.firebasestorage.app/o/forms%2FPADOS_MailInApplication.pdf?alt=media",
  },
  {
    id: "yard-sign-template",
    title: "Yard Sign Design Template",
    description: "Customizable Republican elephant yard sign layout",
    category: "Graphics",
    url: "https://firebasestorage.googleapis.com/v0/b/groundgame26-v2.firebasestorage.app/o/graphics%2Fcampaign-lawn-signs_CS03-F.pdf?alt=media",
  },
  {
    id: "canvassing-script",
    title: "Door-to-Door Canvassing Script Guide",
    description: "Talking points on economy, healthcare, and public safety",
    category: "Scripts",
    url: "https://firebasestorage.googleapis.com/v0/b/groundgame26-v2.firebasestorage.app/o/scripts%2FScript-Voter-Registration-2020-copy.pdf",
  },
];

const USEFUL_LINKS: UsefulLink[] = [
  {
    name: "Chester County Republican Committee",
    description: "Official county GOP headquarters and leadership",
    phone: "610-696-1842",
    email: "HQ@RepublicanCCC.com",
    website: "https://www.republicanccc.com/",
  },
  {
    name: "Chester County Board of Elections",
    description: "Voter services, resources and news",
    phone: "610-344-6410",
    email: "ccelectionofficials@chesco.org",
    website: "https://www.chesco.org/156/Voter-Services",
  },
  {
    name: "Chester County Elections Forms",
    description: "Official forms for voters, candidates and poll workers",
    phone: "610-344-6410",
    email: "ccelectionofficials@chesco.org",
    website: "https://www.chesco.org/290/Forms",
  },
  {
    name: "Chester County Online Voter Registration Form",
    description: "Official online voter application",
    phone: "",
    email: "",
    website:
      "https://www.pavoterservices.pa.gov/Pages/VoterRegistrationApplication.aspx",
  },
  {
    name: "Chester County Online Absentee Ballot Form",
    description: "Official online absentee ballot application",
    phone: "",
    email: "",
    website:
      "https://www.pavoterservices.pa.gov/OnlineAbsenteeApplication/#/OnlineMailInBegin",
  },
  {
    name: "Chester County Online Mail-In Ballot Form",
    description: "Official online mail-in ballot application",
    phone: "",
    email: "",
    website:
      "https://www.pavoterservices.pa.gov/OnlineAbsenteeApplication/#/OnlineMailInBegin",
  },
  {
    name: "Chester County Absentee Ballot Form",
    description: "Official online absentee ballot application",
    phone: "",
    email: "",
    website:
      "https://www.pavoterservices.pa.gov/OnlineAbsenteeApplication/#/OnlineMailInBegin",
  },
  {
    name: "Chester County Absentee Ballot Form",
    description: "Official online absentee ballot application",
    phone: "",
    email: "",
    website:
      "https://www.pavoterservices.pa.gov/OnlineAbsenteeApplication/#/OnlineMailInBegin",
  },
  {
    name: "Pennsylvania Voter Services (Dept of State)",
    description:
      "Pennsylvania election administration, campaign finance and lobbying",
    phone: "877-868-3772",
    email: "ra-voterreg@pa.gov",
    website: "https://www.pa.gov/agencies/dos/programs/voting-and-elections",
  },
];

export default function ResourcesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { user, isLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [suggestedMessages, setSuggestedMessages] = useState<MessageTemplate[]>(
    []
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState("");

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Cloud Function for messages
  const getMessageIdeas = httpsCallable<
    {
      ageGroup?: string;
      modeledParty?: string;
      turnout?: string;
      mailBallot?: string;
    },
    { templates: MessageTemplate[] }
  >(functions, "getMessageIdeas");

  const handleSubmit = useCallback(
    async (submittedFilters: FilterValues) => {
      setFilters(submittedFilters);
      setIsSubmitting(true);
      setLoadingMessages(true);
      setMessageError("");
      setSuggestedMessages([]);

      try {
        const result = await getMessageIdeas({
          ageGroup: submittedFilters.ageGroup || undefined,
          modeledParty: submittedFilters.modeledParty || undefined,
          turnout: submittedFilters.turnout || undefined,
          mailBallot: submittedFilters.mailBallot || undefined,
        });

        const templates = result.data?.templates || [];
        setSuggestedMessages(templates);

        if (templates.length === 0) {
          setMessageError("No message templates found for this audience.");
        }
      } catch (err: any) {
        console.error("Failed to load messages:", err);
        setMessageError(
          err?.message || "Failed to generate messages. Please try again."
        );
      } finally {
        setLoadingMessages(false);
        setIsSubmitting(false);
      }
    },
    [getMessageIdeas]
  );

  const copyToClipboard = useCallback(async (text: string, title: string) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setSnackbarMessage(`"${title}" copied to clipboard!`);
      setSnackbarOpen(true);
    } catch {
      setSnackbarMessage("Copy failed — please select and copy manually.");
      setSnackbarOpen(true);
    }
  }, []);

  const handleDownload = useCallback((title: string, url: string) => {
    // In real app, you could track download here
    window.open(url, "_blank");
    setSnackbarMessage(`Downloading ${title}...`);
    setSnackbarOpen(true);
  }, []);

  if (!isLoaded) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Header */}
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Resources
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom mb={6}>
        Your one-stop hub for campaign materials and outreach tools
      </Typography>

      {/* Section 1: Target & Message */}
      <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, mb: 8 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Target & Message
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Select your audience and get AI-generated, personalized outreach
          messages.
        </Typography>

        <FilterSelector
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
          unrestrictedFilters={[
            "modeledParty",
            "ageGroup",
            "mailBallot",
            "turnout",
          ]}
        />

        {loadingMessages ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <CircularProgress size={60} />
            <Typography variant="body1" mt={3} color="text.secondary">
              Generating personalized messages...
            </Typography>
          </Box>
        ) : messageError ? (
          <Alert severity="warning" sx={{ my: 3 }}>
            {messageError}
          </Alert>
        ) : suggestedMessages.length === 0 ? (
          <Alert severity="info" sx={{ my: 3 }}>
            Apply filters above to generate targeted message templates.
          </Alert>
        ) : (
          <Grid container spacing={3} sx={{ mt: 3 }}>
            {suggestedMessages.map((msg) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={msg.id}>
                <Card
                  elevation={3}
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 3,
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: 8,
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                    <Typography variant="h6" gutterBottom fontWeight="bold">
                      {msg.subject_line || "Untitled Message"}
                    </Typography>

                    {msg.tags && msg.tags.length > 0 && (
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        sx={{ mb: 2 }}
                      >
                        {msg.tags.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    )}

                    <Typography
                      variant="body2"
                      color="text.primary"
                      sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                    >
                      {msg.body}
                    </Typography>
                  </CardContent>

                  <Divider />

                  <CardActions sx={{ justifyContent: "space-between", pt: 2 }}>
                    <Button
                      startIcon={<ContentCopyIcon />}
                      onClick={() =>
                        copyToClipboard(msg.body, msg.subject_line || "Message")
                      }
                      size="medium"
                      color="primary"
                      sx={{ fontWeight: "bold" }}
                    >
                      Copy Message
                    </Button>

                    <Tooltip title="Copy full message">
                      <IconButton
                        onClick={() =>
                          copyToClipboard(
                            msg.body,
                            msg.subject_line || "Message"
                          )
                        }
                        color="primary"
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* Section 2: Download Center */}
      <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Download Center
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Campaign brochures, sample ballots, voter forms, and graphics ready
          for print or digital use
        </Typography>

        <Grid container spacing={4}>
          {["Brochures", "Ballots", "Forms", "Graphics", "Scripts"].map(
            (category) => {
              const categoryResources = SAMPLE_RESOURCES.filter(
                (r) => r.category === category
              );

              if (categoryResources.length === 0) return null;

              return (
                <Grid size={{ xs: 12 }} key={category}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    color="primary"
                    sx={{ mt: 2 }}
                  >
                    {category}
                  </Typography>
                  <Grid container spacing={3}>
                    {categoryResources.map((resource) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={resource.id}>
                        <Card
                          elevation={2}
                          sx={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            borderRadius: 3,
                          }}
                        >
                          <CardContent sx={{ flexGrow: 1 }}>
                            <Stack
                              direction="row"
                              spacing={2}
                              alignItems="center"
                              sx={{ mb: 2 }}
                            >
                              <PictureAsPdf
                                color="secondary"
                                sx={{ fontSize: 40 }}
                              />
                              <Typography variant="subtitle1" fontWeight="bold">
                                {resource.title}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {resource.description}
                            </Typography>
                          </CardContent>

                          <CardActions>
                            <Button
                              variant="contained"
                              startIcon={<DownloadIcon />}
                              onClick={() =>
                                handleDownload(resource.title, resource.url)
                              }
                              fullWidth
                              sx={{ fontWeight: "bold" }}
                            >
                              Download PDF
                            </Button>
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              );
            }
          )}
        </Grid>

        {SAMPLE_RESOURCES.length === 0 && (
          <Alert severity="info" sx={{ mt: 4 }}>
            No resources available yet. Check back soon!
          </Alert>
        )}
      </Paper>
      {/* Section 3: Useful Links */}
      <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, mt: 4 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Useful Links
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Key contacts and websites for campaign support
        </Typography>

        <TableContainer>
          <Table size={isMobile ? "small" : "medium"}>
            <TableHead>
              <TableRow sx={{ bgcolor: "secondary.main" }}>
                <TableCell
                  sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                >
                  Organization
                </TableCell>
                <TableCell
                  sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                >
                  Description
                </TableCell>
                <TableCell
                  sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                >
                  Phone
                </TableCell>
                <TableCell
                  sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                >
                  Email
                </TableCell>
                <TableCell
                  sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                >
                  Website
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {USEFUL_LINKS.map((link, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {link.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {link.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={link.website}
                      target="_blank"
                      rel="noopener"
                      color="inherit"
                      underline="hover"
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <WebsiteIcon fontSize="small" />
                      Visit Site
                    </Link>
                  </TableCell>
                  <TableCell>
                    {link.phone ? (
                      <Link
                        href={`tel:${link.phone.replace(/\D/g, "")}`}
                        color="inherit"
                        underline="hover"
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <PhoneIcon fontSize="small" />
                        {link.phone}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {link.email ? (
                      <Link
                        href={`mailto:${link.email}`}
                        color="inherit"
                        underline="hover"
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <EmailIcon fontSize="small" />
                        {link.email}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          variant="filled"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
