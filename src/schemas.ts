// src/schemas.ts
// Schema mappings for county-specific BigQuery tables

// Define a generic schema type for column mappings
export interface CountySchema {
  tableName: string;
  columns: {
    areaDistrict: string;
    precinctCode: string;
    party: string;
    hasMailBallot: string;
    mailBallotReturned: string;
    modeledParty: string;
  };
}

// Map of county IDs to their schemas
export const COUNTY_SCHEMAS: Record<string, CountySchema> = {
  "PA-C-15": {
    tableName: "groundgame26_voters.chester_county",
    columns: {
      areaDistrict: "area_district",
      precinctCode: "precinct",
      party: "party",
      hasMailBallot: "has_mail_ballot",
      mailBallotReturned: "mail_ballot_returned",
      modeledParty: "modeled_party",
    },
  },
};

// Helper to get schema for a county (with fallback)
export const getCountySchema = (countyId: string): CountySchema => {
  return (
    COUNTY_SCHEMAS[countyId] || {
      tableName: "groundgame26_voters.chester_county", // Hard fallback to Chester
      columns: {
        areaDistrict: "area_district",
        precinctCode: "precinct_key",
        party: "party",
        hasMailBallot: "has_mail_ballot",
        mailBallotReturned: "mail_ballot_returned",
        modeledParty: "modeled_party",
      },
    }
  );
};
