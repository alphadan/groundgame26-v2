//src/constants/legal.ts
export const LEGAL_CONFIG = {
  CURRENT_VERSION: "2026.02.14",
  LAST_UPDATED: "February 14, 2026",
  REQUIRED_CHECKS: [
    {
      id: "privacy",
      label: "Data Privacy & Sources",
      description:
        "I will protect personal voter data (PII) and never share data outside this app. Voter lists are sourced from official government records for GOP outreach only.",
    },
    {
      id: "noIncentives",
      label: "No Voter Incentives (PA 25 P.S. § 3539)",
      description:
        "I will NOT offer swag, t-shirts, or food to any person in exchange for registration. Voter bribery is a Third-Degree Felony.",
    },
    {
      id: "noQuotas",
      label: "No Registration Quotas",
      description:
        "I affirm that any rewards or t-shirts I receive are for general service and are NOT based on the number of registrations I collect.",
    },
    {
      id: "threeDayRule",
      label: "3-Day Form Submission",
      description:
        "I agree to mail or deliver all completed physical voter registration forms to the County Board of Elections within 72 hours of receipt.",
    },
    {
      id: "dataSecurity",
      label: "Technical Data Security",
      description:
        'I will not screenshot, export, or use automated "scraping" tools on the GroundGame26 platform.',
    },
    {
      id: "smsPacing",
      label: "SMS Outreach Pacing",
      description:
        "I will pace manual SMS outreach to prevent carrier account suspension (Max 10 per hour).",
    },
  ],
} as const;
