// src/app/resources/components/UsefulLinks.tsx
import React from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
  useTheme,
  useMediaQuery,
  Paper,
} from "@mui/material";
import {
  Web as WebsiteIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from "@mui/icons-material";
import { UsefulLink } from "../../../types";

// 1. Export the constant so it can be imported elsewhere if needed
export const USEFUL_LINKS_DATA: UsefulLink[] = [
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
    name: "Chester County Online Mail-In Ballot Form",
    description: "Official online mail-in ballot application",
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

interface UsefulLinksProps {
  // 2. Make links optional so we can fall back to the local constant if none provided
  links?: UsefulLink[];
}

export const UsefulLinks: React.FC<UsefulLinksProps> = ({ links }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // 3. Use passed props if they exist, otherwise use the local data
  const displayLinks = links && links.length > 0 ? links : USEFUL_LINKS_DATA;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Useful Links
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Key contacts and websites for campaign support and voter services.
      </Typography>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}
      >
        <Table size={isMobile ? "small" : "medium"}>
          <TableHead>
            <TableRow sx={{ bgcolor: "secondary.main" }}>
              <TableCell
                sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
              >
                Organization
              </TableCell>
              {!isMobile && (
                <TableCell
                  sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                >
                  Description
                </TableCell>
              )}
              <TableCell
                sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
              >
                Links & Contact
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayLinks.map((link, index) => (
              <TableRow key={index} hover>
                <TableCell sx={{ verticalAlign: "top" }}>
                  <Typography variant="body1" fontWeight="bold">
                    {link.name}
                  </Typography>
                </TableCell>
                {!isMobile && (
                  <TableCell sx={{ verticalAlign: "top" }}>
                    <Typography variant="body2" color="text.secondary">
                      {link.description}
                    </Typography>
                  </TableCell>
                )}
                <TableCell sx={{ verticalAlign: "top" }}>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                  >
                    <Link
                      href={link.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      color="primary"
                      underline="hover"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        fontWeight: "medium",
                      }}
                    >
                      <WebsiteIcon fontSize="small" />
                      Visit Site
                    </Link>

                    {link.phone && (
                      <Link
                        href={`tel:${link.phone.replace(/\D/g, "")}`}
                        color="text.primary"
                        variant="body2"
                        underline="none"
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <PhoneIcon fontSize="small" color="action" />
                        {link.phone}
                      </Link>
                    )}

                    {link.email && (
                      <Link
                        href={`mailto:${link.email}`}
                        color="text.primary"
                        variant="body2"
                        underline="none"
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <EmailIcon fontSize="small" color="action" />
                        {link.email}
                      </Link>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
