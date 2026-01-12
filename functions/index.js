import * as functions from "firebase-functions/v1";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { BigQuery } from "@google-cloud/bigquery";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Filter } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onObjectFinalized } from "firebase-functions/v2/storage";

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

export const getVotersByPrecinct = onCall(async (request) => {
  // 1. In v2, auth is located in request.auth
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // 2. Data is located in request.data
  const { precinctCode } = request.data;

  if (!precinctCode) {
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a precinctCode."
    );
  }

  // 3. BigQuery uses named placeholders with @ but the params object
  // needs to match that key exactly.
  const sql = `
    SELECT * FROM \`groundgame26-v2.groundgame26_voters.chester_county\` 
    WHERE precinct = @precinctCode 
    AND active = TRUE 
    LIMIT 1000`;

  const options = {
    query: sql,
    params: { precinctCode },
  };

  try {
    const [rows] = await bigquery.query(options);
    return { voters: rows };
  } catch (error) {
    console.error("BigQuery Error:", error);
    throw new HttpsError("internal", "Failed to fetch voters from BigQuery.");
  }
});

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
        sql += ` AND VBM_AppReturnedDate = IS NOT NULL`;
      } else if (filters.mailBallot === "false") {
        sql += ` AND VBM_AppReturnedDate = IS NULL`;
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

/**
 * Get Message Ideas
 * Logic: Filters templates based on voter profile.
 * Supports the "ANY" case where a null field in DB matches any filter.
 */

export const getMessageIdeas = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  const data = request.data || {};

  // Note: We use Filter directly here because it's imported at the top of your file
  // from "firebase-admin/firestore"

  let query = db.collection("message_templates").where("active", "==", true);

  try {
    // Defensive check for Party (Mapping 'R' to 'Republican' if necessary
    // should ideally happen on frontend, but we handle it here too)
    const partyValue =
      data.party === "R"
        ? "Republican"
        : data.party === "D"
        ? "Democratic"
        : data.party;

    // Helper to safely apply OR filters
    const applyOrFilter = (queryRef, field, value) => {
      if (!value || value === "all") return queryRef;

      // We use Filter directly (not admin.firestore.Filter)
      return queryRef.where(
        Filter.or(
          Filter.where(field, "==", value),
          Filter.where(field, "==", null)
        )
      );
    };

    // Apply filters
    query = applyOrFilter(query, "age_group", data.ageGroup);
    query = applyOrFilter(query, "party", partyValue);
    query = applyOrFilter(query, "turnout_score_general", data.turnout);
    query = applyOrFilter(query, "has_mail_ballot", data.mailBallot);

    const snapshot = await query.limit(50).get();

    const templates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { templates };
  } catch (error) {
    // If you see an error here now, it will likely be a missing Index link
    console.error("Query Execution Error:", error);
    throw new HttpsError(
      "internal",
      error.message || "Failed to fetch templates."
    );
  }
});

// ================================================================
// INCREMENT MESSAGE USAGE COUNT
// ================================================================

/**
 * Analytics: Increment Copy Count
 * Logic: Tracks every time a user clicks "Copy" on a script.
 */
export const incrementCopyCount = onCall(async (request) => {
  // Authorization: Only logged-in users contribute to analytics
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  const { templateId } = request.data;
  if (!templateId) {
    throw new HttpsError("invalid-argument", "Template ID is required.");
  }

  try {
    const templateRef = db.collection("message_templates").doc(templateId);

    // Atomic increment: works even if the field was previously missing
    await templateRef.update({
      copy_count: FieldValue.increment(1),
      last_used_at: Date.now(), // Optional: track freshness
    });

    return { success: true };
  } catch (error) {
    logger.error("Increment Copy Count Error:", error);
    // We throw a silent-ish error here because we don't want to
    // interrupt the user's "Copy" experience if analytics fail.
    return { success: false, error: error.message };
  }
});

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

      logger.log("rolesSnap", rolesSnap);

      const counties = new Set();
      const areas = new Set();
      const precincts = new Set();
      const roles = new Set();
      const groupIds = new Set();

      rolesSnap.forEach((doc) => {
        const d = doc.data();
        if (d.role) roles.add(d.role);
        if (d.group_id) groupIds.add(d.group_id);
        if (d.county_id) counties.add(d.county_id);
        if (d.area_id) areas.add(d.area_id);
        if (d.precinct_id) precincts.add(d.precinct_id);
      });

      const primaryRole = ROLE_PRIORITY.find((r) => roles.has(r)) || "base";

      logger.log("primaryRole", primaryRole);

      // 4. Return profile matching your frontend syncReferenceData requirements
      return {
        profile: {
          uid,
          display_name: userData.display_name || null,
          email: userData.email || request.auth.token.email || null,
          role: primaryRole,
          permissions: getPermissionsForRole(primaryRole),
          group_id: Array.from(groupIds)[0] || null,
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
        group_id: "pending",
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
      const groupIds = new Set();

      rolesSnap.forEach((doc) => {
        const d = doc.data();
        if (d.role) roles.add(d.role);
        if (d.group_id) groupIds.add(d.group_id);
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
        group_id: Array.from(groupIds)[0] || null,
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
      throw new HttpsError("invalid-argument", "request required");
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
    throw new HttpsError("Unauthorized");
  }

  const { voter_id, precinct, full_name, address, note } = request.data;

  if (!note || typeof note !== "string" || note.trim().length === 0) {
    throw new HttpsError("Note text is required");
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
    throw new HttpsError("Failed to save note");
  }
});

// ================================================================
//  Get VOTER NOTE
// ================================================================

export const getVoterNotes = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("Unauthorized");
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
    throw new HttpsError("Failed to load notes");
  }
});

// ================================================================
//  CREATE INDIVIDUAL AREA
// ================================================================

export const adminCreateArea = onCall(async (request) => {
  // 1. Authentication check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const data = request.data;

  // 2. Basic input validation
  if (!data.id || !data.name || !data.area_district) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: id, name, or area_district."
    );
  }

  try {
    // Optional: Check if caller has permission (e.g., admin role)
    const caller = await getAuth().getUser(request.auth.uid);
    // Example: if (!caller.customClaims?.admin) throw ...

    await db
      .collection("areas")
      .doc(data.id)
      .set({
        id: data.id.trim(),
        name: data.name.trim(),
        area_district: data.area_district.trim(),
        county_id: data.county_id || null, // ← keep if still needed
        active: data.active ?? true, // Default to true
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        // No chair fields anymore
      });

    logger.info(`Area created: ${data.id} by ${request.auth.uid}`);

    return { success: true, id: data.id };
  } catch (error) {
    logger.error("adminCreateArea failed:", error);
    throw new HttpsError("internal", error.message || "Failed to create area.");
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

    // Safe destructuring FIRST (no logic inside)
    const {
      id,
      uid,
      area_district,
      county_code,
      is_vacant,
      group_id,
      precint_code,
      role: roleName,
      active = true,
    } = data;

    // Compute final values AFTER destructuring
    const finalUid = is_vacant ? null : uid;

    await db
      .collection("org_roles")
      .doc(id)
      .set({
        id: id || null,
        uid: finalUid,
        area_district: area_district || null,
        county_code: county_code || "Unknown",
        is_vacant: is_vacant ?? false,
        group_id: group_id || null,
        precinct_code: precint_code || null, // fixed typo: precint → precinct
        role: roleName || "Unknown",
        active,
        created_at: FieldValue.serverTimestamp(),
        last_updated: FieldValue.serverTimestamp(),
      });

    return { success: true };
  } catch (error) {
    console.error("Admin Create Org_Role failed:", error);
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
      group_id,
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
      group_id,
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
    logger.error("Batch import failed:", error);
    throw new HttpsError("internal", "Batch write failed");
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
    logger.error("Batch import failed:", error);
    throw new HttpsError("internal", "Batch write failed");
  }
});

// ================================================================
// IMPORT BULK Areas
// ================================================================

export const adminImportAreas = onCall(async (request) => {
  // 1. Authentication check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const areas = request.data.data;

  // 2. Validate input
  if (!Array.isArray(areas) || areas.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Expected a non-empty array of areas."
    );
  }

  const batch = db.batch();
  let successCount = 0;
  const errors = [];

  for (const area of areas) {
    const { id, name, area_district, active = true, county_id } = area;

    // Required fields validation
    if (!id || !name || !area_district) {
      errors.push(
        `Area missing required fields (id, name, area_district): ${JSON.stringify(
          area
        )}`
      );
      continue;
    }

    const docRef = db.collection("areas").doc(id.trim());

    batch.set(docRef, {
      id: id.trim(),
      name: name.trim(),
      area_district: area_district.trim(),
      county_id: county_id || null,
      active: !!active, // Force boolean
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    successCount++;
  }

  try {
    if (successCount > 0) {
      await batch.commit();
    }

    const message =
      errors.length > 0
        ? `Imported ${successCount}/${
            areas.length
          } areas. Errors: ${errors.join("; ")}`
        : `Successfully imported ${successCount} areas.`;

    logger.info(message);

    return {
      success: successCount,
      total: areas.length,
      errors: errors.length > 0 ? errors : null,
    };
  } catch (error) {
    logger.error("adminImportAreas batch failed:", error);
    throw new HttpsError(
      "internal",
      "Batch import failed: " + (error.message || "Unknown error")
    );
  }
});

// ================================================================
//  CREATE INDIVIDUAL MESSAGE TEMPLATES
// ================================================================

// ... existing imports ...

/**
 * Admin: Create Message Template
 * Logic: Auto-slug ID, sanitizes tags, calculates word count.
 */
export const adminCreateMessageTemplate = onCall(async (request) => {
  // 1. Auth & Permission Gating
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  // Permissions check using custom claims
  if (!request.auth.token.permissions?.can_manage_resources) {
    throw new HttpsError("permission-denied", "Insufficient permissions.");
  }

  const data = request.data;

  // 2. Validation
  const required = ["id", "subject_line", "body", "category"];
  for (const field of required) {
    if (!data[field]) {
      throw new HttpsError("invalid-argument", `Missing field: ${field}`);
    }
  }

  try {
    const body = data.body.trim();

    // Tag Processing (String -> Clean Array)
    const tagsArray =
      typeof data.tags === "string"
        ? data.tags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t !== "")
        : [];

    // Server-side Word Count
    const wordCount = body ? body.split(/\s+/).length : 0;

    const templateData = {
      id: data.id,
      subject_line: data.subject_line.trim(),
      body: body,
      category: data.category,
      // ANY Case: If frontend sends "all", store as null for query logic
      party: data.party === "all" ? null : data.party || null,
      age_group: data.age_group === "all" ? null : data.age_group || null,
      turnout_score_general:
        data.turnout_score_general === "all"
          ? null
          : data.turnout_score_general || null,
      has_mail_ballot:
        data.has_mail_ballot === "all" ? null : data.has_mail_ballot || null,
      tags: tagsArray,
      active: data.active ?? true,
      word_count: wordCount,
      favorite_count: 0,
      copy_count: 0,
      created_by_uid: request.auth.uid,
      created_at: Date.now(),
      last_updated: Date.now(),
    };

    await db.collection("message_templates").doc(data.id).set(templateData);

    return { success: true, docId: data.id };
  } catch (error) {
    logger.error("Template Creation Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * User: Toggle Favorite Message
 * Logic: Atomic transaction to add/remove favorite and update global count.
 */
export const toggleFavoriteMessage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  const { templateId } = request.data;
  if (!templateId) {
    throw new HttpsError("invalid-argument", "Template ID required.");
  }

  const uid = request.auth.uid;
  const favoriteId = `${uid}_${templateId}`;
  const favRef = db.collection("user_favorites").doc(favoriteId);
  const templateRef = db.collection("message_templates").doc(templateId);

  try {
    await db.runTransaction(async (transaction) => {
      const favDoc = await transaction.get(favRef);

      if (favDoc.exists) {
        // Un-heart: Delete link and decrement global count
        transaction.delete(favRef);
        transaction.update(templateRef, {
          favorite_count: FieldValue.increment(-1),
        });
      } else {
        // Heart: Create link and increment global count
        transaction.set(favRef, {
          uid,
          template_id: templateId,
          created_at: Date.now(),
        });
        transaction.update(templateRef, {
          favorite_count: FieldValue.increment(1),
        });
      }
    });

    return { success: true };
  } catch (error) {
    logger.error("Toggle Favorite Error:", error);
    throw new HttpsError("internal", "Failed to update favorite status.");
  }
});

// ================================================================
//  CREATE INDIVIDUAL DOWNLOADABLE TEMPLATES
// ================================================================

// functions/src/index.js
export const adminGenerateResourceUploadUrl = onCall(
  { cors: true },
  async (request) => {
    const {
      title,
      category,
      fileName,
      county_code,
      area_code,
      precinct_code,
      scope,
    } = request.data;

    // 1. File size & Type security (Logic check)
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      throw new HttpsError("invalid-argument", "Only PDF files are allowed.");
    }

    const filePath = `resources/${category.toLowerCase()}/${Date.now()}-${fileName}`;
    const file = bucket.file(filePath);

    const [url] = await file.getSignedUrl({
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType: "application/pdf",
      version: "v4",
    });

    return { uploadUrl: url, filePath };
  }
);

// ================================================================
//  SET DOWNLOADABLE TEMPLATES COLLECTION
// ================================================================

export const onResourceUploaded = onObjectFinalized(async (event) => {
  const metadata = event.data.metadata;
  if (!event.data.name.startsWith("resources/")) return;

  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${
    event.data.bucket
  }/o/${encodeURIComponent(event.data.name)}?alt=media`;

  await db.collection("campaign_resources").add({
    title: metadata.title,
    category: metadata.category,
    scope: metadata.scope,
    county_code: metadata["county-code"],
    area_code: metadata["area-code"],
    precinct_code: metadata["precinct-code"],
    url: downloadUrl,
    verified_by_role: "area_chair", // Logic to determine role can go here
    created_at: FieldValue.serverTimestamp(),
  });
});

// ================================================================
//  GET DOWNLOADABLE TEMPLATES
// ================================================================

export const getResourcesByLocation = onCall(
  { cors: true },
  async (request) => {
    logger.info("adminGenerateResourceUploadUrl called", {
      uid: request.auth?.uid,
    });
    logger.info("Incoming request data:", request.data);

    // 1. Auth Guard
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const { county, area, precinct } = request.data;

    logger.info(
      `Searching for: County=${county}, Area=${area}, Precinct=${precinct}`
    );

    try {
      // 2. The "Waterfall" Query
      // Notice: We use 'db' and 'Filter' directly here because they are
      // already imported and initialized at the top of your file.
      const query = db.collection("campaign_resources").where(
        Filter.or(
          // Search using the _code fields that match your frontend/BigQuery values
          Filter.and(
            Filter.where("county_code", "==", county),
            Filter.where("scope", "==", "county")
          ),
          Filter.and(
            Filter.where("area_code", "==", area),
            Filter.where("scope", "==", "area")
          ),
          Filter.and(
            Filter.where("precinct_code", "==", precinct),
            Filter.where("scope", "==", "precinct")
          )
        )
      );

      logger.info("getResourcesByLocation query", query);

      const snapshot = await query.get();
      const resources = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      logger.info(`Found ${snapshot.size} matching documents`);

      // 3. Categorize
      const categorized = {
        Brochures: resources.filter((r) => r.category === "Brochures"),
        Ballots: resources.filter((r) => r.category === "Ballots"),
        Graphics: resources.filter((r) => r.category === "Graphics"),
        Forms: resources.filter((r) => r.category === "Forms"),
        Scripts: resources.filter((r) => r.category === "Scripts"),
      };

      return { categorized };
    } catch (error) {
      logger.error("Resource Query Error:", error); // Using the 'logger' you imported
      throw new HttpsError("internal", error.message);
    }
  }
);

// ================================================================
//  CREATE NEW USERS THROUGH APP
// ================================================================

export const adminCreateUser = onCall({ cors: true }, async (request) => {
  // 1. Authentication Check
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to provision users."
    );
  }

  const {
    email,
    display_name,
    preferred_name,
    phone,
    role,
    group_id,
    county_id,
    area_id,
    precinct_id,
    active,
  } = request.data;

  // 2. Data Validation
  if (!email || !display_name || !role || !group_id) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: email, display_name, role, or group_id."
    );
  }

  // 3. Authorization Logic: Verify the Creator's Rank
  const adminRole = request.auth.token.role;
  const adminName = request.auth.token.name || "A Campaign Lead";

  const allowedRanks = {
    developer: [
      "developer",
      "state_admin",
      "county_chair",
      "state_rep_district",
      "area_chair",
      "candidate",
      "committeeperson",
      "ambassador",
      "base",
    ],
    state_rep_district: [
      "area_chair",
      "candidate",
      "ambassador",
      "committeeperson",
    ],
    county_chair: ["area_chair"],
    area_chair: ["committeeperson", "ambassador"],
  };

  const canCreate = allowedRanks[adminRole]?.includes(role);
  if (!canCreate) {
    throw new HttpsError(
      "permission-denied",
      `A ${adminRole} is not authorized to create a ${role}.`
    );
  }

  try {
    // 4. Generate Temporary Password (First 4 of Name + 123456)
    const cleanName = display_name.replace(/[^a-zA-Z]/g, "");
    const tempPassword = `${cleanName.substring(0, 4)}123456`;

    logger.info(`Provisioning new ${role}: ${email}`);

    // 5. Create Firebase Auth Account
    const userRecord = await auth.createUser({
      email: email.trim(),
      password: tempPassword,
      displayName: display_name.trim(),
      phoneNumber: phone ? phone.trim() : undefined,
    });

    const uid = userRecord.uid;

    // 6. Create Firestore User Document (ID = UID)
    const userDoc = {
      uid: uid,
      display_name: display_name.trim(),
      preferred_name: preferred_name || display_name.split(" ")[0],
      email: email.toLowerCase().trim(),
      phone: phone || null,
      photo_url: null,
      active: active ?? true,
      created_by: request.auth.uid,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    // 7. Create Org Role Document
    // This will trigger the syncOrgRolesToClaims function automatically
    const roleDoc = {
      uid: uid,
      role: role,
      group_id: group_id,
      county_id: county_id || null,
      area_id: area_id || null,
      precinct_id: precinct_id || null,
      active: true,
      is_vacant: false,
      updated_at: FieldValue.serverTimestamp(),
    };

    // Execute Firestore writes
    const batch = db.batch();
    batch.set(db.collection("users").doc(uid), userDoc);
    batch.add(db.collection("org_roles"), roleDoc);
    await batch.commit();

    logger.info(`User ${uid} successfully provisioned by ${request.auth.uid}`);

    // 8. Return data for the Frontend Welcome Email Template
    return {
      success: true,
      uid: uid,
      email: email,
      display_name: display_name,
      preferred_name: userDoc.preferred_name,
      tempPassword: tempPassword,
      created_by: adminName,
    };
  } catch (error) {
    logger.error("Admin Create User failed:", error);

    if (error.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "This email address is already registered in the system."
      );
    }
    if (error.code === "auth/invalid-phone-number") {
      throw new HttpsError(
        "invalid-argument",
        "The phone number provided is invalid."
      );
    }

    throw new HttpsError(
      "internal",
      error.message || "An unexpected error occurred during user provisioning."
    );
  }
});
