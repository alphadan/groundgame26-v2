import * as functions from "firebase-functions/v1";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { BigQuery } from "@google-cloud/bigquery";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();
const bucket = storage.bucket("groundgame26-v2.firebasestorage.app");
const bigquery = new BigQuery();

// ================================================================
// ROLE_PRIORITY MAPPING
// ================================================================

const ROLE_PRIORITY = [
  "developer",
  "state_admin",
  "county_chair",
  "state_rep_district",
  "area_chair",
  "committeeperson",
  "ambassador",
  "base",
];

// ================================================================
// PERMISSIONS MAPPING
// ================================================================

const getPermissionsForRole = (role) => {
  const base = {
    can_manage_team: false,
    can_create_users: false,
    can_manage_resources: false,
    can_upload_collections: false,
    can_create_collections: false,
    can_create_documents: false,
  };

  switch (role) {
    case "developer":
      return {
        ...base,
        can_manage_team: true,
        can_create_users: true,
        can_manage_resources: true,
        can_upload_collections: true,
        can_create_collections: true,
        can_create_documents: true,
      };
    case "state_admin":
    case "county_chair":
    case "state_rep_district":
    case "area_chair":
      return {
        ...base,
        can_manage_team: true,
        can_create_users: true,
        can_manage_resources: true,
      };
    default:
      return base;
  }
};

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

        COUNTIF(modeled_party = '1 - Hard Republican') AS hard_r,
        COUNTIF(modeled_party LIKE '2 - Weak%') AS weak_r,
        COUNTIF(modeled_party = '3 - Swing') AS swing,
        COUNTIF(modeled_party LIKE '4 - Weak%') AS weak_d,
        COUNTIF(modeled_party = '5 - Hard Democrat') AS hard_d,

        COUNTIF(age_group = '18-25' AND party = 'R') AS age_18_25_r,
        COUNTIF(age_group = '18-25' AND party = 'D') AS age_18_25_d,
        COUNTIF(age_group = '26-40' AND party = 'R') AS age_26_40_r,
        COUNTIF(age_group = '26-40' AND party = 'D') AS age_26_40_d,
        COUNTIF(age_group = '41-70' AND party = 'R') AS age_41_70_r,
        COUNTIF(age_group = '41-70' AND party = 'D') AS age_41_70_d,
        COUNTIF(age_group = '71+' AND party = 'R') AS age_71_plus_r,
        COUNTIF(age_group = '71+' AND party = 'D') AS age_71_plus_d,

        COUNTIF(has_mail_ballot = TRUE AND age_group = '18-25' AND party = 'R') AS mail_age_18_25_r,
        COUNTIF(has_mail_ballot = TRUE AND age_group = '18-25' AND party = 'D') AS mail_age_18_25_d,
        COUNTIF(has_mail_ballot = TRUE AND age_group = '26-40' AND party = 'R') AS mail_age_26_40_r,
        COUNTIF(has_mail_ballot = TRUE AND age_group = '26-40' AND party = 'D') AS mail_age_26_40_d,
        COUNTIF(has_mail_ballot = TRUE AND age_group = '41-70' AND party = 'R') AS mail_age_41_70_r,
        COUNTIF(has_mail_ballot = TRUE AND age_group = '41-70' AND party = 'D') AS mail_age_41_70_d,
        COUNTIF(has_mail_ballot = TRUE AND age_group = '71+' AND party = 'R') AS mail_age_71_plus_r,
        COUNTIF(has_mail_ballot = TRUE AND age_group = '71+' AND party = 'D') AS mail_age_71_plus_d
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
        voter_id, full_name, gender, age, party, precinct, area_district,
        address, city, email, phone_mobile, phone_home, has_mail_ballot,
        modeled_party, turnout_score_general, date_registered, likely_mover, zip_code
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

    // === Party ===
    if (filters.party && filters.party.trim() !== "") {
      sql += ` AND party = @party`;
      params.party = filters.party.trim();
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
      sql += ` AND age_group = @ageGroup`;
      params.ageGroup = filters.ageGroup.trim();
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

export const queryVotersDynamicRNC = onCall(
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

    const table = `groundgame26-v2.groundgame26_voters.chester_county_rnc_master_202512`;

    let sql = `
      SELECT 
        statevoterid, firstname, lastname, fullname, gender, age, agegroup, officialparty, precinctname,
        precinctnumber, primaryaddress1, primarycity, mobile, landline, officialparty,
        calculatedparty, generalregularity, primaryregularity, registrationdate, moved, primaryzip, VBM_AppReturnedDate
      FROM \`${table}\`
      WHERE 1=1
    `;

    const params = {};

    // === Precinct ===
    if (filters.precinct && filters.precinct.trim() !== "") {
      const normalized = filters.precinct.trim().replace(/^0+/, "") || "0";

      console.log("Params precinct:", normalized);
      logger.log("Params: precinct", normalized);

      sql += ` AND PrecinctNumber = @precinct`;

      // Convert the string to a Number so BigQuery sees it as an INT64
      params.precinct = Number(normalized);
    }

    // === Name ===
    if (filters.name && filters.name.trim() !== "") {
      sql += ` AND LOWER(FullName) LIKE @name`;
      params.name = `%${filters.name.trim().toLowerCase()}%`;
    }

    // === Street ===
    if (filters.street && filters.street.trim() !== "") {
      sql += ` AND LOWER(primaryaddress1) LIKE @street`;
      params.street = `%${filters.street.trim().toLowerCase()}%`;
    }

    // === Modeled Party ===
    if (filters.modeledParty && filters.modeledParty.trim() !== "") {
      sql += ` AND calculatedparty = @modeledParty`;
      params.modeledParty = filters.modeledParty.trim();
    }

    // === Party ===
    if (filters.party && filters.party.trim() !== "") {
      sql += ` AND officialparty = @party`;
      params.party = filters.party.trim();
    }

    // === Turnout Score ===
    if (filters.turnout && filters.turnout.trim() !== "") {
      const score = parseInt(filters.turnout.trim());
      if (!isNaN(score)) {
        sql += ` AND generalregularity = @turnout`;
        params.turnout = score;
      }
    }

    // === Age Group ===
    if (filters.ageGroup && filters.ageGroup.trim() !== "") {
      sql += ` AND AgeGroup = @ageGroup`;
      params.ageGroup = filters.ageGroup.trim();
    }

    // === Mail Ballot ===
    if (filters.mailBallot && filters.mailBallot.trim() !== "") {
      if (filters.mailBallot === "true") {
        sql += ` AND VBM_AppReturnedDate = !null`;
      } else if (filters.mailBallot === "false") {
        sql += ` AND VBM_AppReturnedDate = null`;
      }
    }

    // === Zip Code ===
    if (filters.zipCode && filters.zipCode.trim() !== "") {
      const zip = filters.zipCode.trim();
      if (/^\d{5}$/.test(zip)) {
        sql += ` AND PrimaryZip = @zipCode`;
        params.zipCode = parseInt(zip);
      }
    }

    sql += ` ORDER BY fullname LIMIT 2000`;

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
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }
    const uid = request.auth.uid;

    try {
      // 2. Fetch User Identity
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.data() || {};

      // 3. Query all active role assignments from the new org_roles structure
      const rolesSnap = await db
        .collection("org_roles")
        .where("uid", "==", uid)
        .where("is_vacant", "==", false)
        .where("active", "==", true)
        .get();

      const counties = new Set();
      const areas = new Set();
      const precincts = new Set();
      const roles = new Set();
      const orgIds = new Set();

      rolesSnap.forEach((doc) => {
        const d = doc.data();
        if (d.role) roles.add(d.role);
        if (d.org_id) orgIds.add(d.org_id);
        if (d.county_id) counties.add(d.county_id);
        if (d.area_id) areas.add(d.area_id);
        if (d.precinct_id) precincts.add(d.precinct_id);
      });

      const primaryRole = ROLE_PRIORITY.find((r) => roles.has(r)) || "base";

      // 4. Return profile matching your frontend syncReferenceData requirements
      return {
        profile: {
          uid,
          display_name: userData.display_name || null,
          email: userData.email || request.auth.token.email || null,
          role: primaryRole,
          permissions: getPermissionsForRole(primaryRole),
          org_id: Array.from(orgIds)[0] || null,
          access: {
            counties: Array.from(counties),
            areas: Array.from(areas),
            precincts: Array.from(precincts),
          },
        },
      };
    } catch (error) {
      console.error("Error in getUserProfile:", error);
      throw new HttpsError("internal", error.message);
    }
  }
);

// ================================================================
// CREATE USER PROFILE
// ================================================================

export const createUserProfile = functions.auth
  .user()
  .onCreate(async (user) => {
    const uid = user.uid;
    const email = user.email?.toLowerCase() || "";
    const displayName = user.displayName || email.split("@")[0];

    try {
      // Aligned with UserProfile interface
      await db.doc(`users/${uid}`).set({
        uid,
        display_name: displayName,
        preferred_name: displayName.split(" ")[0], // Default to first name
        email,
        phone: user.phoneNumber || null,
        photo_url: user.photoURL || null,
        primary_county: "15",
        primary_precinct: "",
        role: "base",
        org_id: "pending",
        notifications_enabled: true,
        login_count: 1,
        last_ip: "auth-trigger",
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        last_login: FieldValue.serverTimestamp(),
      });

      await db.collection("login_attempts").add({
        uid,
        email,
        success: true,
        type: "initial_registration",
        ip: "auth-trigger",
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("createUserProfile failed:", err);
    }
  });

// ================================================================
//  SYNC ORG ROLES — CENTRALIZED & CLEAN
//  CLOUD TRIGGERED FUNCTION ONLY
// ================================================================

export const syncOrgRolesToClaims = onDocumentWritten(
  "org_roles/{docId}",
  async (event) => {
    // In v2, the 'event' object contains 'data', which has 'before' and 'after' snapshots
    const snapshotAfter = event.data?.after;
    const snapshotBefore = event.data?.before;

    const data = snapshotAfter ? snapshotAfter.data() : null;
    const prevData = snapshotBefore ? snapshotBefore.data() : null;

    const uid = data?.uid || prevData?.uid;
    if (!uid) {
      logger.info("No UID found for role change, skipping.");
      return;
    }

    const ROLE_PRIORITY = [
      "developer",
      "state_admin",
      "county_chair",
      "state_rep_district",
      "area_chair",
      "committeeperson",
      "ambassador",
      "base",
    ];

    try {
      // 1. Re-calculate the current state for this user
      const rolesSnap = await db
        .collection("org_roles")
        .where("uid", "==", uid)
        .where("is_vacant", "==", false)
        .where("active", "==", true)
        .get();

      const counties = new Set();
      const areas = new Set();
      const precincts = new Set();
      const roles = new Set();
      const orgIds = new Set();

      rolesSnap.forEach((doc) => {
        const d = doc.data();
        if (d.role) roles.add(d.role);
        if (d.org_id) orgIds.add(d.org_id);
        if (d.county_id) counties.add(d.county_id);
        if (d.area_id) areas.add(d.area_id);
        if (d.precinct_id) precincts.add(d.precinct_id);
      });

      const primaryRole = ROLE_PRIORITY.find((r) => roles.has(r)) || "base";
      const permissions = getPermissionsForRole(primaryRole);

      // 2. Set Custom Claims for security rules and AuthContext
      const claims = {
        role: primaryRole,
        permissions: permissions,
        counties: Array.from(counties),
        areas: Array.from(areas),
        precincts: Array.from(precincts),
        org_id: Array.from(orgIds)[0] || null,
      };

      await auth.setCustomUserClaims(uid, claims);

      // 3. Update sync timestamp to signal frontend update
      await db.collection("users").doc(uid).set(
        {
          last_claims_sync: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(
        `Claims synced for UID: ${uid}. Primary Role: ${primaryRole}`
      );
      return null;
    } catch (error) {
      console.error("Error in syncOrgRolesToClaims:", error);
      return null;
    }
  }
);

// ================================================================
//  SUBMIT VOLUNTEERS
// ================================================================

export const submitVolunteer = onCall(async (request) => {
  try {
    // Firebase httpsCallable wraps data in a 'data' property
    logger.info("[submitVolunteer]request :", request.data);

    if (!request) {
      throw new Error("invalid-argument", "request required");
    }

    const { name, email, comment, recaptchaToken } = request.data;

    await db.collection("volunteer_requests").add({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      comment: comment?.trim() || "",
      submitted_at: FieldValue.serverTimestamp(),
      status: "new",
    });

    return {
      success: true,
      message: "Volunteer submitted successfully",
    };
  } catch (error) {
    logger.error("Submit failed error:", error);

    // Re-throw Firebase HttpsErrors so the frontend sees them
    if (error instanceof HttpsError) {
      throw error;
    }
    // If it's a generic error, wrap it in an HttpsError
    throw new HttpsError("internal", error.message || "Unknown error occurred");
  }
});

// ================================================================
//  ADD VOTER NOTE
// ================================================================

export const addVoterNote = onCall(async (request) => {
  // Auth check - automatically provided by onCall
  if (!request.auth || !request.auth.uid) {
    throw new Error("Unauthorized");
  }

  const { voter_id, precinct, full_name, address, note } = request.data;

  if (!note || typeof note !== "string" || note.trim().length === 0) {
    throw new Error("Note text is required");
  }

  try {
    // Get user info from auth for created_by_name
    const authUser = await getAuth().getUser(request.auth.uid);

    await db.collection("voter_notes").add({
      voter_id: voter_id || null,
      full_name: full_name || "Unknown",
      address: address || "Unknown",
      note: note.trim(),
      created_by_uid: request.auth.uid,
      created_by_name: authUser.displayName || authUser.email || "Unknown",
      created_at: new Date(),
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to save voter note:");
    throw new Error("Failed to save note");
  }
});

// ================================================================
//  Get VOTER NOTE
// ================================================================

export const getVoterNotes = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new Error("Unauthorized");
  }

  const { voterIds } = request.data;

  if (!Array.isArray(voterIds) || voterIds.length === 0) {
    return { notes: [] };
  }

  try {
    const snapshot = await db
      .collection("voter_notes")
      .where("voter_id", "in", voterIds)
      .orderBy("created_at", "desc")
      .get();

    const notes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { notes };
  } catch (error) {
    console.error("Failed to fetch voter notes:", error);
    throw new Error("Failed to load notes");
  }
});

// ================================================================
//  CREATE INDIVIDUAL AREA
// ================================================================

export const adminCreateArea = onCall(async (request) => {
  // 1. Check authentication first
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const data = request.data;

  try {
    // 2. Correct way to get user info in 2nd Gen
    const authUser = await getAuth().getUser(request.auth.uid);

    await db
      .collection("areas")
      .doc(data.id)
      .set({
        id: data.id || null,
        org_id: data.org_id || null,
        area_district: data.area_district || "Unknown",
        name: data.name || "Unknown",
        chair_uid: data.chair_uid || null,
        vice_chair_uid: data.vice_chair_uid || null,
        chair_email: data.chair_email || "Unknown",
        active: true,
        created_at: Date.now(),
        last_updated: Date.now(),
      });

    return { success: true };
  } catch (error) {
    console.error("Admin Create Area failed:", error);
    // 3. Throw a proper HttpsError for the frontend
    throw new HttpsError("internal", "Failed to create area record.");
  }
});

// ================================================================
//  CREATE INDIVIDUAL PRECINCT
// ================================================================

export const adminCreatePrecinct = onCall(async (request) => {
  // 1. Check authentication first
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const data = request.data;

  try {
    // 2. Correct way to get user info in 2nd Gen
    const authUser = await getAuth().getUser(request.auth.uid);

    await db
      .collection("precincts")
      .doc(data.id)
      .set({
        id: data.id || null,
        county_code: data.county_code || null,
        precinct_code: data.precinct_code || "Unknown",
        name: data.name || "Unknown",
        area_district: data.area_district || null,
        congressional_district: data.congressional_district || null,
        senate_district: data.senate_district || "Unknown",
        house_district: data.house_district || null,
        county_district: data.county_district || null,
        party_rep_district: data.party_rep_district || null,
        active: true,
        created_at: Date.now(),
        last_updated: Date.now(),
      });

    return { success: true };
  } catch (error) {
    console.error("Admin Create Precint failed:", error);
    // 3. Throw a proper HttpsError for the frontend
    throw new HttpsError("internal", "Failed to create precinct record.");
  }
});

// ================================================================
//  CREATE INDIVIDUAL USER
// ================================================================

export const adminCreateUser = onCall(async (request) => {
  // 1. Check authentication first
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const data = request.data;

  try {
    // 2. Correct way to get user info in 2nd Gen
    const authUser = await getAuth().getUser(request.auth.uid);

    await db
      .collection("users")
      .doc(data.uid)
      .set({
        uid: data.uid || null,
        display_name: data.display_name || null,
        org_id: data.org_id || "Unknown",
        name: data.name || "Unknown",
        email: data.email || null,
        login_count: data.login_count || null,
        phone: data.phone || "Unknown",
        photo_url: data.photo_url || null,
        preferred_name: data.preferred_name || null,
        notifications_enabled: data.notifications_enabled || null,
        role: data.role || null,
        active: true,
        created_at: Date.now(),
        last_updated: Date.now(),
      });

    return { success: true };
  } catch (error) {
    console.error("Admin Create User failed:", error);
    // 3. Throw a proper HttpsError for the frontend
    throw new HttpsError("internal", "Failed to create user record.");
  }
});

// ================================================================
//  CREATE ORGNIZATON ROLE
// ================================================================

export const adminCreateOrgRole = onCall(async (request) => {
  // 1. Check authentication first
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const data = request.data;

  try {
    // 2. Correct way to get user info in 2nd Gen
    const authUser = await getAuth().getUser(request.auth.uid);

    await db
      .collection("org_roles")
      .doc(data.id)
      .set({
        id: data.id || null,
        uid: is_vacant ? null : uid,
        area_district: data.area_district || null,
        county_code: data.county_code || "Unknown",
        is_vacant: data.is_vacant || "Unknown",
        org_id: data.org_id || null,
        precint_code: data.precint_code || null,
        role: data.role || "Unknown",
        active: true,
        created_at: Date.now(),
        last_updated: Date.now(),
      });

    return { success: true };
  } catch (error) {
    console.error("Admin Create Org_Role failed:", error);
    // 3. Throw a proper HttpsError for the frontend
    throw new HttpsError("internal", "Failed to create org_role record.");
  }
});

// ================================================================
// IMPORT BULK ORGNIZATON ROLE
// ================================================================

export const adminImportOrgRoles = onCall(async (request) => {
  // 1. Check authentication first
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const roles = request.data.roles;

  // Safety check to ensure it's actually an array
  if (!Array.isArray(roles)) {
    console.error("Received data is not an array:");
    throw new HttpsError("invalid-argument", "Expected an array of roles.");
  }

  const authUser = await getAuth().getUser(request.auth.uid);

  const batch = db.batch();
  let successCount = 0;

  for (const role of roles) {
    const {
      id,
      uid = null,
      role: roleName,
      org_id,
      county_code = null,
      area_district = null,
      precinct_code,
      is_vacant = false,
      active = true,
    } = role;

    const docRef = db.collection("org_roles").doc(id);

    batch.set(docRef, {
      id,
      uid: is_vacant ? null : uid,
      role: roleName,
      org_id,
      county_code,
      area_district,
      precinct_code,
      is_vacant,
      active,
      created_at: Date.now(),
      last_updated: Date.now(),
    });

    successCount++;
  }

  try {
    await batch.commit();
    return { success: successCount, total: roles.length };
  } catch (error) {
    functions.logger.error("Batch import failed:", error);
    throw new functions.https.HttpsError("internal", "Batch write failed");
  }
});

// ================================================================
// IMPORT BULK PRECINCTS
// ================================================================

export const adminImportPrecincts = onCall(async (request) => {
  // 1. Check authentication first
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const precincts = request.data.data;

  // Safety check to ensure it's actually an array
  if (!Array.isArray(precincts)) {
    throw new HttpsError("invalid-argument", "Expected an array of roles.");
  }

  const authUser = await getAuth().getUser(request.auth.uid);

  const batch = db.batch();
  let successCount = 0;

  for (const precinct of precincts) {
    const {
      id,
      name,
      precinct_code,
      area_district,
      county_code,
      congressional_district,
      senate_district,
      house_district,
      county_district,
      party_rep_district,
      active = true,
    } = precinct;

    const docRef = db.collection("precincts").doc(id);

    batch.set(docRef, {
      id,
      name,
      precinct_code,
      area_district,
      county_code,
      congressional_district,
      senate_district,
      house_district,
      county_district,
      party_rep_district,
      active,
      created_at: Date.now(),
      last_updated: Date.now(),
    });

    successCount++;
  }

  try {
    await batch.commit();
    return { success: successCount, total: precincts.length };
  } catch (error) {
    functions.logger.error("Batch import failed:", error);
    throw new functions.https.HttpsError("internal", "Batch write failed");
  }
});

// ================================================================
// IMPORT BULK Areas
// ================================================================

export const adminImportAreas = onCall(async (request) => {
  // 1. Check authentication first
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const areas = request.data.data;

  // Safety check to ensure it's actually an array
  if (!Array.isArray(areas)) {
    throw new HttpsError("invalid-argument", "Expected an array of areas.");
  }

  const authUser = await getAuth().getUser(request.auth.uid);

  const batch = db.batch();
  let successCount = 0;

  for (const area of areas) {
    const {
      id,
      name,
      org_id,
      area_district,
      chair_email,
      chair_uid,
      last_updated,
      vice_chair_uid,
      active = true,
    } = area;

    const docRef = db.collection("areas").doc(id);

    batch.set(docRef, {
      id,
      name,
      org_id,
      area_district,
      chair_email,
      chair_uid,
      last_updated,
      vice_chair_uid,
      active,
      created_at: Date.now(),
      last_updated: Date.now(),
    });

    successCount++;
  }

  try {
    await batch.commit();
    return { success: successCount, total: areas.length };
  } catch (error) {
    functions.logger.error("Batch import failed:", error);
    throw new functions.https.HttpsError("internal", "Batch write failed");
  }
});

// ================================================================
//  CREATE INDIVIDUAL MESSAGE TEMPLATES
// ================================================================

export const adminCreateMessageTemplate = onCall(async (request) => {
  // 1. Check authentication first
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const data = request.data;

  if (!data.id || !data.body || !data.category || !data.tone) {
    throw new HttpsError(
      "invalid-argument",
      "id, body, category, and tone are required."
    );
  }

  const toNullIfAny = (value) =>
    value === "Any" || value === "" ? null : value;

  try {
    // 2. Correct way to get user info in 2nd Gen
    const authUser = await getAuth().getUser(request.auth.uid);

    await db
      .collection("message_templates")
      .doc(data.id)
      .set({
        id: data.id.trim(),
        subject_line: data.subject_line?.trim() || null,
        body: data.body.trim(),
        category: data.category,
        tone: data.tone,
        age_group: data.age_group?.trim() || null,
        modeled_party: toNullIfAny(data.modeled_party),
        turnout_score_general: toNullIfAny(data.turnout_score_general),
        has_mail_ballot: toNullIfAny(data.has_mail_ballot),
        tags: Array.isArray(data.tags)
          ? data.tags
          : data.tags
              ?.split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0) || [],
        active: data.active ?? true,
        created_at: Date.now(),
        last_updated: Date.now(),
      });

    return { success: true };
  } catch (error) {
    console.error("Admin Create Message Template failed:");
    // 3. Throw a proper HttpsError for the frontend
    throw new HttpsError(
      "internal",
      "Failed to create message template record."
    );
  }
});

// ================================================================
//  CREATE INDIVIDUAL MESSAGE TEMPLATES
// ================================================================

export const adminGenerateResourceUploadUrl = onCall(async (request) => {
  logger.info("adminGenerateResourceUploadUrl called", {
    uid: request.auth?.uid,
  });

  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { title, description = "", category, fileName } = request.data || {};

  if (!title || !category || !fileName) {
    throw new HttpsError(
      "invalid-argument",
      "title, category, and fileName are required"
    );
  }

  const validCategories = [
    "Brochures",
    "Ballots",
    "Forms",
    "Graphics",
    "Scripts",
  ];
  if (!validCategories.includes(category)) {
    throw new HttpsError("invalid-argument", "Invalid category");
  }

  const safeFileName = `${Date.now()}-${fileName.replace(
    /[^a-zA-Z0-9.-]/g,
    "_"
  )}`;
  const folder = category.toLowerCase().replace(/\s+/g, "-");
  const filePath = `resources/${folder}/${safeFileName}`;

  logger.info("Generating signed URL", { filePath, title, category });

  const file = bucket.file(filePath);

  try {
    const [url] = await file.getSignedUrl({
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: "application/pdf",
    });

    logger.info("Signed URL generated successfully", { filePath });

    return { uploadUrl: url, filePath, fileName: safeFileName };
  } catch (error) {
    logger.error("Failed to generate signed URL", { error: error.message });
    throw new HttpsError("internal", "Failed to generate upload URL");
  }
});
