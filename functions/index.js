import * as functions from "firebase-functions/v1";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { BigQuery } from "@google-cloud/bigquery";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();

const db = getFirestore();
const bigquery = new BigQuery();

// ================================================================
// 1. BIGQUERY PROXY (Gen 2)
// ================================================================
export const queryVoters = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    try {
      const token = req.headers.authorization?.split("Bearer ")[1];
      if (!token) return res.status(401).send("No token");

      // Verify the user is authenticated
      await getAuth().verifyIdToken(token);

      let sql = req.body.sql || req.query.sql;
      if (!sql) return res.status(400).send("No SQL");

      // 🚀 THE FIX: Update the security check to include the v2 project ID
      // We use a more flexible check to ensure it's hitting the correct table
      const lowerSql = sql.toLowerCase();
      const isValidTable =
        lowerSql.includes(
          "from `groundgame26-v2.groundgame26_voters.chester_county`"
        ) || lowerSql.includes("from `groundgame26_voters.chester_county`"); // Fallback for local testing

      if (!isValidTable) {
        console.warn("BLOCKED: Unauthorized table access attempt:", sql);
        return res.status(403).send("Invalid table: Unauthorized data source.");
      }

      // Formatting Fixes
      sql = sql.replace(/''/g, "NULL");
      sql = sql.replace(/'true'/gi, "TRUE");
      sql = sql.replace(/'false'/gi, "FALSE");

      // Execute Query
      const [rows] = await bigquery.query({
        query: sql,
        location: "US", // Ensure location matches your dataset
      });

      res.json(rows);
    } catch (err) {
      console.error("QUERY FAILED:", err);
      res.status(500).send("Server error: " + err.message);
    }
  }
);

// ================================================================
// 2. GET VOTERS BY PRECINCT (Converted to export const)
// ================================================================
export const getVotersByPrecinct = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Auth required");
    }
    const { precinctCode } = data;
    const sql = `SELECT * FROM \`groundgame26-v2.groundgame26_voters.chester_county\` WHERE precinct = @precinctCode AND active = TRUE LIMIT 1000`;
    const [rows] = await bigquery.query({
      query: sql,
      params: { precinctCode },
    });
    return { voters: rows };
  }
);

// ================================================================
// SEARCH VOTERS BY NAME — FINAL v2 VERSION (Dec 2025)
// ================================================================

export const searchVotersByNameV2 = onCall(
  {
    cors: [/localhost:\d+$/, /127\.0\.0\.1:\d+$/, "https://groundgame26.com"],
    region: "us-central1",
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const { name } = request.data || {};

    if (!name || typeof name !== "string" || name.trim().length < 3) {
      throw new HttpsError(
        "invalid-argument",
        "Name must be at least 3 characters"
      );
    }

    const searchTerm = name.trim().toLowerCase();

    const table = `groundgame26-v2.groundgame26_voters.chester_county`;

    const sql = `
      SELECT 
        voter_id,
        full_name,
        age,
        party,
        precinct,
        address,
        phone_mobile,
        modeled_party
      FROM \`${table}\`
      WHERE LOWER(full_name) LIKE @searchTerm
      ORDER BY full_name
      LIMIT 100
    `;

    try {
      const [rows] = await bigquery.query({
        query: sql,
        params: { searchTerm: `%${searchTerm}%` },
        location: "US",
      });

      console.log(`Name search for "${name}" returned ${rows.length} results`);
      return { voters: rows };
    } catch (error) {
      console.error("Name search BigQuery error:", error);
      throw new HttpsError("internal", "Search failed — please try again");
    }
  }
);

// ================================================================
// GET DASHBOARD STATS — FINAL, WORKING FOR CHESTER COUNTY TABLE
// Uses correct field names: area_district and precinct
// ================================================================

export const getDashboardStats = onCall(
  {
    cors: [/localhost:\d+$/, /127\.0\.0\.1:\d+$/, "https://groundgame26.com"],
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const { areaCode, precinctCodes } = request.data || {};

    // Validate inputs (optional but safe)
    if (areaCode && typeof areaCode !== "string") {
      throw new HttpsError("invalid-argument", "areaCode must be a string");
    }
    if (
      precinctCodes &&
      (!Array.isArray(precinctCodes) ||
        precinctCodes.some((p) => typeof p !== "string"))
    ) {
      throw new HttpsError(
        "invalid-argument",
        "precinctCodes must be an array of strings"
      );
    }

    const table = `groundgame26-v2.groundgame26_voters.chester_county`;

    let sql = `
      SELECT 
        COUNTIF(party = 'R') AS total_r,
        COUNTIF(party = 'D') AS total_d,
        COUNTIF(party NOT IN ('R','D') AND party IS NOT NULL) AS total_nf,
        COUNTIF(has_mail_ballot = TRUE AND party = 'R') AS mail_r,
        COUNTIF(has_mail_ballot = TRUE AND party = 'D') AS mail_d,
        COUNTIF(has_mail_ballot = TRUE AND party NOT IN ('R','D') AND party IS NOT NULL) AS mail_nf,
        COUNTIF(mail_ballot_returned = TRUE AND party = 'R') AS returned_r,
        COUNTIF(mail_ballot_returned = TRUE AND party = 'D') AS returned_d,
        COUNTIF(mail_ballot_returned = TRUE AND party NOT IN ('R','D') AND party IS NOT NULL) AS returned_nf,
        COUNTIF(modeled_party = '1 - Hard Republican') AS hard_r,
        COUNTIF(modeled_party LIKE '2 - Weak%') AS weak_r,
        COUNTIF(modeled_party = '3 - Swing') AS swing,
        COUNTIF(modeled_party LIKE '4 - Weak%') AS weak_d,
        COUNTIF(modeled_party = '5 - Hard Democrat') AS hard_d
      FROM \`${table}\`
      WHERE 1=1
    `;

    const params = {};

    // Use correct column name: area_district
    if (areaCode) {
      sql += ` AND area_district = @areaCode`;
      params.areaCode = areaCode;
    }

    // Use correct column name: precinct
    if (precinctCodes?.length > 0) {
      sql += ` AND precinct IN UNNEST(@precinctCodes)`;
      params.precinctCodes = precinctCodes;
    }

    try {
      const [rows] = await bigquery.query({
        query: sql,
        params,
        location: "US",
      });

      console.log("Dashboard stats query successful:", rows[0]);
      return { stats: rows[0] || {} };
    } catch (error) {
      console.error("BigQuery query failed:", error);
      throw new HttpsError("internal", "Failed to load dashboard stats");
    }
  }
);

// ================================================================
// GET VOTERS BY PRECINCT — v2 (NEW NAME)
// ================================================================

export const getVotersByPrecinctV2 = onCall(
  {
    cors: [/localhost:\d+$/, /127\.0\.0\.1:\d+$/, "https://groundgame26.com"],
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    let { precinctCode } = request.data || {};

    if (!precinctCode || typeof precinctCode !== "string") {
      throw new HttpsError("invalid-argument", "Valid precinctCode required");
    }

    // Normalize: remove leading zeros
    const normalizedPrecinct = precinctCode.replace(/^0+/, "") || "0";

    const table = `groundgame26-v2.groundgame26_voters.chester_county`;

    const sql = `
      SELECT 
        voter_id, full_name, age, gender, party, modeled_party,
        phone_home, phone_mobile, address, turnout_score_general,
        mail_ballot_returned, likely_mover, precinct, area_district
      FROM \`${table}\`
      WHERE precinct = @normalizedPrecinct
      ORDER BY turnout_score_general DESC
      LIMIT 1000
    `;

    try {
      const [rows] = await bigquery.query({
        query: sql,
        params: { normalizedPrecinct: normalizedPrecinct }, // ← Explicit key = value
        location: "US",
      });

      console.log(
        `Loaded ${rows.length} voters for precinct "${precinctCode}" (normalized: "${normalizedPrecinct}")`
      );
      return { voters: rows };
    } catch (error) {
      console.error("Precinct query failed:", error);
      throw new HttpsError("internal", "Failed to load voter list");
    }
  }
);

// ================================================================
// GET DYNAMIC QUERIES— v2 (NEW NAME)
// ================================================================

export const queryVotersDynamic = onCall(
  {
    cors: [/localhost:\d+$/, /127\.0\.0\.1:\d+$/, "https://groundgame26.com"],
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const filters = request.data || {};
    console.log("Received filters:", filters); // Debug log

    const table = `groundgame26-v2.groundgame26_voters.chester_county`;

    let sql = `
      SELECT 
        voter_id, full_name, age, party, precinct, area_district,
        address, phone_mobile, phone_home, has_mail_ballot,
        modeled_party, turnout_score_general, zip_code
      FROM \`${table}\`
      WHERE 1=1
    `;

    const params = {};

    // === Area ===
    if (filters.area && filters.area.trim() !== "") {
      sql += ` AND area_district = @area`;
      params.area = filters.area.trim();
    }

    // === Precinct ===
    if (filters.precinct && filters.precinct.trim() !== "") {
      const normalized = filters.precinct.trim().replace(/^0+/, "") || "0";
      console.log("Params precinct:", normalized);
      logger.log("Params: precinct", normalized);
      sql += ` AND precinct = @precinct`;
      params.precinct = normalized;
    }

    // === Name ===
    if (filters.name && filters.name.trim() !== "") {
      sql += ` AND LOWER(full_name) LIKE @name`;
      params.name = `%${filters.name.trim().toLowerCase()}%`;
    }

    // === Street ===
    if (filters.street && filters.street.trim() !== "") {
      sql += ` AND LOWER(address) LIKE @street`;
      params.street = `%${filters.street.trim().toLowerCase()}%`;
    }

    // === Modeled Party ===
    if (filters.modeledParty && filters.modeledParty.trim() !== "") {
      sql += ` AND modeled_party = @modeledParty`;
      params.modeledParty = filters.modeledParty.trim();
    }

    // === Turnout Score ===
    if (filters.turnout && filters.turnout.trim() !== "") {
      const score = parseInt(filters.turnout.trim());
      if (!isNaN(score)) {
        sql += ` AND turnout_score_general = @turnout`;
        params.turnout = score;
      }
    }

    // === Age Group ===
    if (filters.ageGroup && filters.ageGroup.trim() !== "") {
      const [min, maxStr] = filters.ageGroup.split("-");
      const minAge = parseInt(min);
      const maxAge = maxStr === "+" ? null : parseInt(maxStr);

      sql += ` AND age >= @ageMin`;
      params.ageMin = minAge;

      if (maxAge !== null) {
        sql += ` AND age <= @ageMax`;
        params.ageMax = maxAge;
      }
    }

    // === Mail Ballot ===
    if (filters.mailBallot && filters.mailBallot.trim() !== "") {
      if (filters.mailBallot === "true") {
        sql += ` AND has_mail_ballot = TRUE`;
      } else if (filters.mailBallot === "false") {
        sql += ` AND has_mail_ballot = FALSE`;
      }
    }

    // === Zip Code ===
    if (filters.zipCode && filters.zipCode.trim() !== "") {
      const zip = filters.zipCode.trim();
      if (/^\d{5}$/.test(zip)) {
        sql += ` AND zip_code = @zipCode`;
        params.zipCode = parseInt(zip);
      }
    }

    sql += ` ORDER BY full_name LIMIT 2000`;

    console.log("Final SQL:", sql);
    logger.log("Final SQL:", sql);
    console.log("Params:", params);
    logger.log("Params:", params);

    try {
      const [rows] = await bigquery.query({
        query: sql,
        params,
        location: "US",
      });

      console.log(`Dynamic query returned ${rows.length} voters`);
      return { voters: rows };
    } catch (error) {
      console.error("Dynamic query failed:", error);
      throw new HttpsError("internal", "Query failed — check server logs");
    }
  }
);

// ================================================================
// GET MESSAGE IDEAS
// ================================================================

export const getMessageIdeas = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new Error(
        "Unauthorized  you must be logged in to access message templates."
      );
    }

    const data = request.data || {};

    let q = db.collection("message_templates").where("active", "==", true);

    if (data.ageGroup && data.ageGroup !== "All") {
      q = q.where("age_group", "==", data.ageGroup);
    }
    if (data.modeledParty && data.modeledParty !== "All") {
      q = q.where("modeled_party", "==", data.modeledParty);
    }
    if (data.turnout && data.turnout !== "All") {
      q = q.where("turnout_score_general", "==", data.turnout);
    }
    if (data.mailBallot && data.mailBallot !== "All") {
      q = q.where("mail_ballot", "==", data.mailBallot);
    }

    try {
      const snapshot = await q.limit(50).get();

      const templates = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      return { templates };
    } catch (error) {
      console.error("Error fetching message templates:", error);
      throw new Error("Failed to fetch message templates.");
    }
  }
);

// ================================================================
// GET USER PROFILE
// ================================================================

export const getUserProfile = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new Error("Unauthorized");
    }

    const uid = request.auth.uid;

    try {
      const userDoc = await db.collection("users").doc(uid).get();

      if (!userDoc.exists) {
        // Optional: return null or default profile
        return { profile: null };
      }

      return { profile: { uid: userDoc.id, ...userDoc.data() } };
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw new Error("Failed to fetch profile");
    }
  }
);
