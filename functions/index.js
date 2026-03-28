import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  onDocumentWritten,
  onDocumentUpdated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { BigQuery } from "@google-cloud/bigquery";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Filter } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { randomBytes } from "crypto";

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

initializeApp();

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();
const bucket = storage.bucket("groundgame26-v2.firebasestorage.app");
const bigquery = new BigQuery();
const VOTER_TABLE = `groundgame26-v2.groundgame26_voters.20260225_chester_county`;

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
  "volunteer",
  "base",
];

const ROLE_HIERARCHY_VALUES = {
  developer: 0,
  state_admin: 1,
  county_chair: 2,
  state_rep_district: 3,
  area_chair: 4,
  committeeperson: 5,
  volunteer: 6,
  candidate: 7,
  base: 8,
};

// ================================================================
// PERMISSIONS MAPPING
// ================================================================

async function getPermissionsFromFirestore(role) {
  const roleRef = db.collection("roles_config").doc(role || "base");
  const snapshot = await roleRef.get();

  if (!snapshot.exists) {
    logger.warn(`Role ${role} not found. Falling back to base.`);
    const baseSnapshot = await db.collection("roles_config").doc("base").get();
    return baseSnapshot.data();
  }

  return snapshot.data();
}

// ================================================================
// 1. SYNC COLLECTIONS FOR USER DEXIE DB
// ================================================================

// functions/src/index.ts
export const getSyncCollections = onCall(async (request) => {
  // 1. Auth Guard
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const uid = request.auth.uid;

  try {
    // 2. Fetch User Profile AND Org Roles simultaneously
    const [userDoc, rolesSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db
        .collection("org_roles")
        .where("uid", "==", uid)
        .where("is_vacant", "==", false)
        .where("active", "==", true)
        .get(),
    ]);

    if (!userDoc.exists) {
      return { success: false, reason: "no_profile" };
    }

    const userData = userDoc.data();

    // 3. Dynamic Access and Role Calculation (Mirror logic from getUserProfile)
    const countiesSet = new Set();
    const districtsSet = new Set();
    const areasSet = new Set();
    const precinctsSet = new Set();
    const rolesSet = new Set();
    const groupIdsSet = new Set();

    rolesSnap.forEach((doc) => {
      const d = doc.data();
      if (d.role) rolesSet.add(d.role);
      if (d.group_id) groupIdsSet.add(d.group_id);
      if (d.county_id) countiesSet.add(d.county_id);
      if (d.district_id) districtsSet.add(d.district_id);
      if (d.area_id) areasSet.add(d.area_id);
      if (d.precinct_id) precinctsSet.add(d.precinct_id);
    });

    // Determine Primary Role using your priority list
    const primaryRole = ROLE_PRIORITY.find((r) => rolesSet.has(r)) || "base";

    // Get the robust permissions set using your helper function
    const computedPermissions = getPermissionsForRole(primaryRole);

    // WILDCARD EXPANSION (Ensure data visibility matches permissions)
    if (primaryRole === "developer" || primaryRole === "state_admin") {
      countiesSet.add("ALL");
      districtsSet.add("ALL");
      areasSet.add("ALL");
      precinctsSet.add("ALL");
    } else if (primaryRole === "county_chair") {
      districtsSet.add("ALL");
      areasSet.add("ALL");
      precinctsSet.add("ALL");
    } else if (
      ["area_chair", "candidate", "state_rep_district"].includes(primaryRole)
    ) {
      precinctsSet.add("ALL");
    }

    const finalAccess = {
      counties: Array.from(countiesSet).filter(Boolean),
      districts: Array.from(districtsSet).filter(Boolean),
      areas: Array.from(areasSet).filter(Boolean),
      precincts: Array.from(precinctsSet).filter(Boolean),
    };

    // 4. Parallel Fetch of Global Collections
    const [pSnap, aSnap, cSnap, gSnap, dSnap] = await Promise.all([
      db.collection("precincts").get(),
      db.collection("areas").get(),
      db.collection("counties").get(),
      db.collection("groups").get(),
      db.collection("state_rep_districts").get(),
    ]);

    const hasAll = (arr) => Array.isArray(arr) && arr.includes("ALL");

    // 5. Server-Side Filtering based on dynamic finalAccess
    const filteredAreas = aSnap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter(
        (a) =>
          primaryRole === "developer" ||
          hasAll(finalAccess.areas) ||
          finalAccess.areas.includes(a.id),
      );

    const allowedAreaIds = new Set(filteredAreas.map((a) => a.id));
    const filteredPrecincts = pSnap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter(
        (p) =>
          primaryRole === "developer" ||
          hasAll(finalAccess.precincts) ||
          allowedAreaIds.has(p.area_id) ||
          finalAccess.precincts.includes(p.id),
      );

    const filteredDistricts = dSnap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter(
        (d) =>
          primaryRole === "developer" ||
          hasAll(finalAccess.districts) ||
          finalAccess.districts.includes(d.id),
      );

    const filteredCounties = cSnap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter(
        (c) =>
          primaryRole === "developer" ||
          hasAll(finalAccess.counties) ||
          finalAccess.counties.includes(c.id),
      );

    // 6. Assemble the production profile for the frontend
    const profile = {
      uid,
      display_name: userData.display_name || null,
      email: userData.email || null,
      role: primaryRole,
      permissions: computedPermissions, // This restores your "Add" buttons
      access: finalAccess,
      group_id: Array.from(groupIdsSet)[0] || null,
      last_synced: Date.now(),
    };

    return {
      success: true,
      profile,
      districts: filteredDistricts,
      precincts: filteredPrecincts,
      areas: filteredAreas,
      counties: filteredCounties,
      groups: gSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
      serverTime: Date.now(),
    };
  } catch (error) {
    logger.error("Sync failed for UID: " + uid, error);
    throw new HttpsError("internal", error.message);
  }
});

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
        lowerSql.includes("from \`${VOTER_TABLE}\`") ||
        lowerSql.includes("from \`${VOTER_TABLE}\`"); // Fallback for local testing

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
  },
);

// ================================================================
// 2. GET VOTERS BY PRECINCT (Converted to export const)
// ================================================================

export const getVotersByPrecinct = onCall(async (request) => {
  // 1. In v2, auth is located in request.auth
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  // 2. Data is located in request.data
  const { precinctCode } = request.data;

  if (!precinctCode) {
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a precinctCode.",
    );
  }

  // 3. BigQuery uses named placeholders with @ but the params object
  // needs to match that key exactly.
  const sql = `
    SELECT * FROM \`${VOTER_TABLE}\` 
    WHERE precinct = @precinctCode 
    AND active = TRUE 
    `;

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
// GET DASHBOARD STATS — FINAL, WORKING FOR CHESTER COUNTY TABLE
// Uses correct field names: area_district and precinct
// ================================================================

export const getDashboardStats = onCall(
  {
    cors: true,
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const { areaCode, precinctCodes } = request.data || {};

    // Validate inputs
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
        "precinctCodes must be an array of strings",
      );
    }

    const table = VOTER_TABLE;

    // Comprehensive SQL to cover all Chart keys (Registration & Mail-In)
    let sql = `
      SELECT 
        COUNTIF(political_party = 'R') AS total_r,
        COUNTIF(political_party = 'D') AS total_d,
        COUNTIF(political_party NOT IN ('R','D') AND political_party IS NOT NULL) AS total_nf,

        COUNTIF(has_mail_ballot AND political_party = 'R') AS mail_r,
        COUNTIF(has_mail_ballot AND political_party = 'D') AS mail_d,
        COUNTIF(has_mail_ballot AND political_party NOT IN ('R','D')) AS mail_nf,

        COUNTIF(modeled_party = '1 - Hard Republican') AS hard_r,
        COUNTIF(modeled_party = '2 - Weak Republican') AS weak_r,
        COUNTIF(modeled_party = '3 - Swing') AS swing,
        COUNTIF(modeled_party = '4 - Weak Democrat') AS weak_d,
        COUNTIF(modeled_party = '5 - Hard Democrat') AS hard_d,

        COUNTIF(age_group = '18-25' AND political_party = 'R') AS age_18_25_r,
        COUNTIF(age_group = '18-25' AND political_party = 'D') AS age_18_25_d,
        COUNTIF(age_group = '18-25' AND political_party NOT IN ('R','D')) AS age_18_25_i,

        COUNTIF(age_group = '26-40' AND political_party = 'R') AS age_26_40_r,
        COUNTIF(age_group = '26-40' AND political_party = 'D') AS age_26_40_d,
        COUNTIF(age_group = '26-40' AND political_party NOT IN ('R','D')) AS age_26_40_i,

        COUNTIF(age_group = '41-70' AND political_party = 'R') AS age_41_70_r,
        COUNTIF(age_group = '41-70' AND political_party = 'D') AS age_41_70_d,
        COUNTIF(age_group = '41-70' AND political_party NOT IN ('R','D')) AS age_41_70_i,

        COUNTIF(age_group = '71+' AND political_party = 'R') AS age_71_plus_r,
        COUNTIF(age_group = '71+' AND political_party = 'D') AS age_71_plus_d,
        COUNTIF(age_group = '71+' AND political_party NOT IN ('R','D')) AS age_71_plus_i,

        COUNTIF(has_mail_ballot AND age_group = '18-25' AND political_party = 'R') AS mail_age_18_25_r,
        COUNTIF(has_mail_ballot AND age_group = '18-25' AND political_party = 'D') AS mail_age_18_25_d,
        COUNTIF(has_mail_ballot AND age_group = '18-25' AND political_party NOT IN ('R','D')) AS mail_age_18_25_i,

        COUNTIF(has_mail_ballot AND age_group = '26-40' AND political_party = 'R') AS mail_age_26_40_r,
        COUNTIF(has_mail_ballot AND age_group = '26-40' AND political_party = 'D') AS mail_age_26_40_d,
        COUNTIF(has_mail_ballot AND age_group = '26-40' AND political_party NOT IN ('R','D')) AS mail_age_26_40_i,

        COUNTIF(has_mail_ballot AND age_group = '41-70' AND political_party = 'R') AS mail_age_41_70_r,
        COUNTIF(has_mail_ballot AND age_group = '41-70' AND political_party = 'D') AS mail_age_41_70_d,
        COUNTIF(has_mail_ballot AND age_group = '41-70' AND political_party NOT IN ('R','D')) AS mail_age_41_70_i,

        COUNTIF(has_mail_ballot AND age_group = '71+' AND political_party = 'R') AS mail_age_71_plus_r,
        COUNTIF(has_mail_ballot AND age_group = '71+' AND political_party = 'D') AS mail_age_71_plus_d,
        COUNTIF(has_mail_ballot AND age_group = '71+' AND political_party NOT IN ('R','D')) AS mail_age_71_plus_i

      FROM \`${table}\`
      WHERE 1=1
    `;

    const params = {};

    if (areaCode) {
      sql += ` AND area_district = @areaCode`;
      params.areaCode = areaCode;
    }

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

      return { stats: rows[0] || {} };
    } catch (error) {
      console.error("BigQuery dashboard query failed:", error.message);
      throw new HttpsError(
        "internal",
        "Error calculating dashboard analytics.",
      );
    }
  },
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

    const table = VOTER_TABLE;

    const sql = `
      SELECT 
        voter_id, full_name, age, sex, political_party, modeled_party,
        phone_primary, phone_home, phone_mobile, address, turnout_score_general,
        vbn_ballotreturned, likely_moved, precinct, area_district
      FROM \`${table}\`
      WHERE precinct = @normalizedPrecinct
      ORDER BY turnout_score_general DESC
    `;

    try {
      const [rows] = await bigquery.query({
        query: sql,
        params: { normalizedPrecinct: normalizedPrecinct }, // ← Explicit key = value
        location: "US",
      });

      console.log(
        `Loaded ${rows.length} voters for precinct "${precinctCode}" (normalized: "${normalizedPrecinct}")`,
      );
      return { voters: rows };
    } catch (error) {
      console.error("Precinct query failed:", error);
      throw new HttpsError("internal", "Failed to load voter list");
    }
  },
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

    const table = VOTER_TABLE;

    let sql = `
      SELECT 
        voter_id, full_name, sex, age, political_party, precinct, area_district,
        address, house_int, city, email, phone_mobile, phone_home, has_mail_ballot,
        modeled_party, turnout_score_general, turnout_score_primary, date_registered, likely_moved, zip_code, date_of_birth, GN_PR_11_04_25, GN_11_05_24
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

    // === political_party ===
    if (filters.party && filters.party.trim() !== "") {
      sql += ` AND political_party = @party`;
      params.party = filters.party.trim();
    }

    // === Turnout General Score ===
    if (filters.turnout && filters.turnout.trim() !== "") {
      const score = parseInt(filters.turnout.trim());
      if (!isNaN(score)) {
        sql += ` AND turnout_score_general = @turnout`;
        params.turnout = score;
      }
    }

    // === Turnout Primary Score ===
    if (filters.turnout && filters.turnout.trim() !== "") {
      const score = parseInt(filters.turnout.trim());
      if (!isNaN(score)) {
        sql += ` AND turnout_score_primary = @turnout`;
        params.turnout = score;
      }
    }

    // === Age Group ===
    if (filters.ageGroup && filters.ageGroup.trim() !== "") {
      sql += ` AND age_group = @ageGroup`;
      params.ageGroup = filters.ageGroup.trim();
    }

    // === Sex ===
    if (filters.sex && filters.sex.trim() !== "") {
      sql += ` AND sex = @sex`;
      params.sex = filters.sex.trim();
    }

    // === Birth Day ===
    if (filters.birthDay && filters.birthDay.trim() !== "") {
      sql += ` AND date_of_birth LIKE @dobPattern`;
      params.dobPattern = `%${filters.birthDay.trim()}%`;
    }

    // NEW: Handle the specific logic for Drop-off voters
    // Logic: Voted in 2025 Primary (gn_pr_11_04_25) but NOT in 2024 General (gn_11_05_24)
    if (filters.dropoffOnly === true) {
      sql += ` AND gn_11_05_24 IS NOT NULL 
               AND gn_pr_11_04_25 IS NULL 
               AND political_party = 'R'`;
    }

    if (filters.party && filters.party.trim() !== "" && !filters.dropoffOnly) {
      sql += ` AND political_party = @party`;
      params.party = filters.party.trim();
    }

    // === General Election Day Voters 2025 ===
    if (filters.gn_pr_11_04_25 && filters.gn_pr_11_04_25.trim() !== "") {
      sql += ` AND gn_pr_11_04_25 = @v25`;
      params.v25 = filters.gn_pr_11_04_25.trim();
    }

    // === General Election Day Voters 2024 ===
    if (filters.gn_11_05_24 && filters.gn_11_05_24.trim() !== "") {
      sql += ` AND gn_11_05_24 = @v24`;
      params.v24 = filters.gn_11_05_24.trim();
    }

    if (filters.hardGopSuper === true) {
      sql += ` 
    AND modeled_party = '1 - Hard Republican' 
    AND GN_11_05_24 = 'R' 
    AND GN_PR_11_04_25 = 'R' 
  `;
    }

    // === Mail Ballot ===
    if (
      filters.mailBallot !== undefined &&
      filters.mailBallot !== null &&
      filters.mailBallot !== ""
    ) {
      // Convert string "true"/"false" to actual boolean
      const isMailBallot = String(filters.mailBallot).toLowerCase() === "true";

      if (isMailBallot) {
        sql += ` AND has_mail_ballot IS TRUE`;
      } else {
        sql += ` AND has_mail_ballot IS NOT TRUE`;
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

    sql += ` AND voter_status = 'A' ORDER BY 
        REGEXP_REPLACE(address, r'^[0-9]+\\s+', '') ASC,
        house_int ASC,
        full_name ASC `;

    logger.log("Final SQL:", sql);
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
  },
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
    // Defensive check for political_party (Mapping 'R' to 'Republican' if necessary
    // should ideally happen on frontend, but we handle it here too)
    const partyValue =
      data.political_party === "R"
        ? "Republican"
        : data.political_party === "D"
          ? "Democratic"
          : data.political_party;

    // Helper to safely apply OR filters
    const applyOrFilter = (queryRef, field, value) => {
      if (!value || value === "all") return queryRef;

      // We use Filter directly (not admin.firestore.Filter)
      return queryRef.where(
        Filter.or(
          Filter.where(field, "==", value),
          Filter.where(field, "==", null),
        ),
      );
    };

    // Apply filters
    query = applyOrFilter(query, "age_group", data.ageGroup);
    query = applyOrFilter(query, "political_party", partyValue);
    query = applyOrFilter(query, "turnout_score_general", data.turnout);
    query = applyOrFilter(query, "has_mail_ballot", data.mailBallot);
    query = applyOrFilter(query, "sex", data.gender);

    const snapshot = await query.limit(96).get();

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
      error.message || "Failed to fetch templates.",
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
    // 1. Authentication Guard
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }
    const uid = request.auth.uid;

    try {
      // 2. Fetch Base Identity & Active Roles in parallel
      const [userDoc, rolesSnap] = await Promise.all([
        db.collection("users").doc(uid).get(),
        db
          .collection("org_roles")
          .where("uid", "==", uid)
          .where("is_vacant", "==", false)
          .where("active", "==", true)
          .get(),
      ]);

      const userData = userDoc.data() || {};

      // 3. Initialize Access Sets
      const counties = new Set();
      const districts = new Set(); // NEW
      const areas = new Set();
      const precincts = new Set();
      const roles = new Set();
      const groupIds = new Set();

      // 4. Aggregate raw access from all assigned roles
      rolesSnap.forEach((doc) => {
        const d = doc.data();
        if (d.role) roles.add(d.role);
        if (d.group_id) groupIds.add(d.group_id);
        if (d.county_id) counties.add(d.county_id);
        if (d.district_id) districts.add(d.district_id); // NEW
        if (d.area_id) areas.add(d.area_id);
        if (d.precinct_id) precincts.add(d.precinct_id);
      });

      // 5. Determine Primary Role (using priority mapping)
      const primaryRole = ROLE_PRIORITY.find((r) => roles.has(r)) || "base";
      const permissions = getPermissionsForRole(primaryRole);

      // 6. WILDCARD EXPANSION (The Hierarchy Logic)
      // This ensures that 'ALL' filters down correctly based on the role rank
      if (primaryRole === "developer" || primaryRole === "state_admin") {
        counties.add("ALL");
        districts.add("ALL");
        areas.add("ALL");
        precincts.add("ALL");
      } else if (primaryRole === "county_chair") {
        // County Chairs unlock all Districts, Areas, and Precincts in their county
        districts.add("ALL");
        areas.add("ALL");
        precincts.add("ALL");
      } else if (primaryRole === "state_rep_district") {
        // District Leaders unlock all Areas and Precincts in their District
        areas.add("ALL");
        precincts.add("ALL");
      } else if (primaryRole === "area_chair" || primaryRole === "candidate") {
        // Area Chairs unlock all Precincts in their Area
        precincts.add("ALL");
      }

      // 7. Format & Clean final arrays
      const finalAccess = {
        counties: Array.from(counties).filter(Boolean),
        districts: Array.from(districts).filter(Boolean),
        areas: Array.from(areas).filter(Boolean),
        precincts: Array.from(precincts).filter(Boolean),
      };

      logger.info(
        `✅ [getUserProfile] UID: ${uid} | Role: ${primaryRole} | Districts: ${finalAccess.districts.length}`,
      );

      // 8. Return computed profile
      return {
        profile: {
          uid,
          display_name: userData.display_name || null,
          email: userData.email || request.auth.token.email || null,
          role: primaryRole,
          permissions: permissions,
          group_id: Array.from(groupIds)[0] || null,
          access: finalAccess,
          last_synced: Date.now(),
        },
      };
    } catch (error) {
      logger.error("❌ Error in getUserProfile:", error);
      throw new HttpsError(
        "internal",
        error.message || "Internal server error.",
      );
    }
  },
);

// ================================================================
//  SYNC ORG ROLES — CENTRALIZED & CLEAN
//  CLOUD TRIGGERED FUNCTION ONLY
// ================================================================

export const syncOrgRolesToClaims = onDocumentWritten(
  "org_roles/{docId}",
  async (event) => {
    const snapshotAfter = event.data?.after;
    const snapshotBefore = event.data?.before;

    const data = snapshotAfter ? snapshotAfter.data() : null;
    const prevData = snapshotBefore ? snapshotBefore.data() : null;

    // Use either the new owner or the previous owner to ensure the correct user is synced
    const uid = data?.uid || prevData?.uid;

    if (!uid) {
      logger.info("No UID found for role change, skipping.");
      return null;
    }

    try {
      // 1. Fetch all active roles assigned to this specific UID
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

      // 2. Resolve the Primary Role based on your priority constants
      const primaryRole = ROLE_PRIORITY.find((r) => roles.has(r)) || "base";
      const permissions = getPermissionsForRole(primaryRole);

      // 3. APPLY HIERARCHICAL EXPANSION (Wildcard Logic)
      // This is the core fix for the "Only seeing one area" issue
      if (primaryRole === "developer" || primaryRole === "state_admin") {
        counties.add("ALL");
        areas.add("ALL");
        precincts.add("ALL");
      } else if (primaryRole === "county_chair") {
        // Keeps the specific county, but unlocks all areas/precincts within it
        areas.add("ALL");
        precincts.add("ALL");
      } else if (
        primaryRole === "area_chair" ||
        primaryRole === "state_rep_district" ||
        primaryRole === "candidate"
      ) {
        // Keeps specific area, but unlocks all precincts within it
        precincts.add("ALL");
      }

      // 4. Clean Data: Remove nulls/undefined and convert to Arrays
      const finalCounties = Array.from(counties).filter((c) => !!c);
      const finalAreas = Array.from(areas).filter((a) => !!a);
      const finalPrecincts = Array.from(precincts).filter((p) => !!p);

      // 5. SET CUSTOM CLAIMS (For Security Rules & Immediate Auth State)
      const claims = {
        role: primaryRole,
        permissions: permissions,
        counties: finalCounties,
        areas: finalAreas,
        precincts: finalPrecincts,
        group_id: Array.from(groupIds)[0] || null,
      };

      await auth.setCustomUserClaims(uid, claims);

      // 6. SYNC FIRESTORE USER DOCUMENT
      // Crucial: This is what getUserProfile() reads in the syncReferenceData function
      await db
        .collection("users")
        .doc(uid)
        .set(
          {
            role: primaryRole,
            access: {
              counties: finalCounties,
              areas: finalAreas,
              precincts: finalPrecincts,
            },
            last_claims_sync: Date.now(),
            updated_at: Date.now(),
          },
          { merge: true },
        );

      console.log(
        `✅ Claims & Profile synced for UID: ${uid}. Role: ${primaryRole}. Areas: ${JSON.stringify(finalAreas)}`,
      );

      return null;
    } catch (error) {
      console.error("❌ Error in syncOrgRolesToClaims:", error);
      return null;
    }
  },
);

// ================================================================
//  Get Jurisdiction Access For Candidates
//  Helper: Calculates the specific precincts a candidate should have access to.
//  CLOUD TRIGGERED FUNCTION ONLY FROM adminCreateUser
// ================================================================

async function getJurisdictionAccess(countyId, type, value) {
  // 1. Handle Countywide & PA06 (The "ALL" Strategy)
  if (type === "countywide" || value === "PA06") {
    return {
      counties: [countyId],
      districts: ["ALL"],
      areas: ["ALL"],
      precincts: ["ALL"],
    };
  }

  // 2. Handle Specific House/Senate Districts
  // We determine which database column to query based on jurisdiction type
  const columnMap = {
    house: "house_district",
    senate: "senate_district",
  };
  const targetColumn = columnMap[type];

  // Query all precincts in the county that belong to this political district
  const precinctSnap = await db
    .collection("precincts")
    .where("county_id", "==", countyId)
    .where(targetColumn, "==", value)
    .get();

  if (precinctSnap.empty) {
    // Fallback: If no precincts found, restrict to empty to prevent accidental broad access
    return { counties: [countyId], districts: [], areas: [], precincts: [] };
  }

  const precinctIds = [];
  const areaIds = new Set();
  const districtIds = new Set();

  precinctSnap.forEach((doc) => {
    const data = doc.data();
    precinctIds.push(doc.id);
    if (data.area_id) areaIds.add(data.area_id);
    if (data.party_rep_district) districtIds.add(data.party_rep_district);
  });

  return {
    counties: [countyId],
    districts: Array.from(districtIds),
    areas: Array.from(areaIds),
    precincts: precinctIds,
  };
}

// ================================================================
//  SYNC DISTRICT LEADERSHIP ROLES — CENTRALIZED & CLEAN
//  CLOUD TRIGGERED FUNCTION ONLY
// ================================================================

export const updateDistrictLeadership = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");

  const { districtId, leaders } = request.data; // 'leaders' is now [{uid, name}, ...]
  const db = getFirestore();

  try {
    // Basic validation to ensure we don't exceed your 2-leader rule
    if (leaders && leaders.length > 2) {
      throw new HttpsError(
        "invalid-argument",
        "A district cannot have more than two leaders.",
      );
    }

    await db
      .collection("state_rep_districts")
      .doc(districtId)
      .update({
        district_leaders: leaders || [], // Save the array of maps
        updated_at: Date.now(),
      });

    return { success: true };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

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
      submitted_at: Date.now(),
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
  const cleanId = (data.id || "").trim();

  // 2. Basic input validation
  if (!cleanId || !data.name || !data.area_district) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: id, name, or area_district.",
    );
  }

  try {
    // Optional: Check if caller has permission (e.g., admin role)
    const caller = await getAuth().getUser(request.auth.uid);
    // Example: if (!caller.customClaims?.admin) throw ...

    await db
      .collection("areas")
      .doc(cleanId)
      .set(
        {
          ...data,
          id: cleanId,
          uid: cleanId, // Maintain consistency: doc.id = id = uid
          active: data.active ?? true,
          created_at: data.created_at || Date.now(),
          updated_at: Date.now(),
        },
        { merge: true },
      );

    logger.info(`Area created: ${data.id} by ${request.auth.uid}`);

    return { success: true, id: data.id };
  } catch (error) {
    logger.error("adminCreateArea failed:", error);
    throw new HttpsError("internal", error.message || "Failed to create area.");
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
      "Expected a non-empty array of areas.",
    );
  }

  const batch = db.batch();
  let successCount = 0;
  const errors = [];

  for (const area of areas) {
    const cleanId = String(area.id || area.area_id || "").trim();
    if (!cleanId || !area.name) continue;

    const docRef = db.collection("areas").doc(cleanId);

    batch.set(
      docRef,
      {
        ...area,
        id: cleanId,
        uid: cleanId,
        active: area.active !== undefined ? !!area.active : true,
        created_at: area.created_at || Date.now(),
        updated_at: Date.now(),
      },
      { merge: true },
    );

    successCount++;
    if (successCount >= 499) break;
  }

  try {
    await batch.commit();
    return { success: successCount, total: areas.length };
  } catch (error) {
    throw new HttpsError("internal", "Batch write failed");
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

  const docId = (data.id || "").trim();

  if (!docId) {
    throw new HttpsError("invalid-argument", "Precinct ID is required.");
  }

  try {
    // 2. Correct way to get user info in 2nd Gen
    const authUser = await getAuth().getUser(request.auth.uid);

    await db
      .collection("precincts")
      .doc(docId)
      .set(
        {
          ...data,
          id: docId || null,
          active: data.active ?? true,
          created_at: Date.now(),
          last_updated: Date.now(),
        },
        { merge: true },
      );

    return { success: true };
  } catch (error) {
    console.error("Admin Create Precint failed:", error);
    // 3. Throw a proper HttpsError for the frontend
    throw new HttpsError("internal", "Failed to create precinct record.");
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
    // Sanitize ID
    const rawId = precinct.id || precinct.precinct_id;
    const cleanId = (String(rawId) || "").trim();

    if (!cleanId) continue;

    const docRef = db.collection("precincts").doc(cleanId);

    batch.set(docRef, {
      ...precinct,
      id: cleanId,
      active: precinct.active ?? true,
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

    const existingDoc = await db
      .collection("message_templates")
      .doc(data.id)
      .get();

    const templateData = {
      id: data.id,
      subject_line: data.subject_line.trim(),
      body: body,
      category: data.category,
      // ANY Case: If frontend sends "all", store as null for query logic
      party: data.party === "all" ? null : data.party || null,
      age_group: data.age_group === "all" ? null : data.age_group || null,
      gender: data.gender === "all" ? null : data.gender,
      turnout_score_general:
        data.turnout_score_general === "all"
          ? null
          : data.turnout_score_general || null,
      has_mail_ballot:
        data.has_mail_ballot === "all" ? null : data.has_mail_ballot || null,
      tags: tagsArray,
      active: data.active ?? true,
      word_count: wordCount,
      favorite_count: existingDoc.exists
        ? existingDoc.data().favorite_count || 0
        : 0,
      copy_count: existingDoc.exists ? existingDoc.data().copy_count || 0 : 0,
      created_at: existingDoc.exists
        ? existingDoc.data().created_at
        : Date.now(),
      created_by_uid: request.auth.uid,
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
// functions/index.js

export const adminGenerateResourceUploadUrl = onCall(
  { cors: true },
  async (request) => {
    // ADD LOGGING HERE
    logger.info("Incoming Upload Request Data:", request.data);

    const {
      title,
      category,
      description,
      fileName,
      county_id,
      area_id,
      precinct_id,
      county_code,
      area_code,
      precinct_code,
      scope,
    } = request.data;

    if (!fileName.toLowerCase().endsWith(".pdf")) {
      throw new HttpsError("invalid-argument", "Only PDF files are allowed.");
    }

    logger.info("Incoming Upload Request Data:title", title);
    logger.info("Incoming Upload Request Data:category", category);
    logger.info("Incoming Upload Request Data:description", description);
    logger.info("Incoming Upload Request Data:fileName", fileName);
    logger.info("Incoming Upload Request Data:county_id ", county_id);
    logger.info("Incoming Upload Request Data:county_code ", county_code);
    logger.info("Incoming Upload Request Data:area_id ", area_id);
    logger.info("Incoming Upload Request Data:area_code ", area_code);
    logger.info("Incoming Upload Request Data:precinct_id", precinct_id);
    logger.info("Incoming Upload Request Data:precinct_code", precinct_code);
    logger.info("Incoming Upload Request Data:scope ", scope);

    const filePath = `resources/${category.toLowerCase()}/${Date.now()}-${fileName}`;
    const file = bucket.file(filePath);

    // SWITCH TO HYPHENS: GCS prefers hyphens over underscores in headers
    const extensionHeaders = {
      "x-goog-meta-title": title,
      "x-goog-meta-category": category,
      "x-goog-meta-description": description || "",
      "x-goog-meta-scope": scope,
      "x-goog-meta-county-id": county_id || "",
      "x-goog-meta-county-code": county_code || "",
      "x-goog-meta-area-id": area_id || "",
      "x-goog-meta-area-code": area_code || "",
      "x-goog-meta-precinct-id": precinct_id || "",
      "x-goog-meta-precinct-code": precinct_code || "",
    };

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType: "application/pdf",
      extensionHeaders,
    });

    return { uploadUrl: url, filePath, extensionHeaders };
  },
);

// ================================================================
//  SET RESOURCES DOWNLOADABLE TEMPLATES COLLECTION
// ================================================================

export const onResourceUploaded = onObjectFinalized(async (event) => {
  const fileData = event.data;
  const meta = fileData.metadata || {};

  if (!fileData.name.startsWith("resources/")) return;

  try {
    const rawTitle = meta.title || "Untitled";
    const rawScope = (meta.scope || "county").toLowerCase();
    const rawCategory = (meta.category || "General").toUpperCase();

    // 1. Extract values from hyphenated metadata (the "Handshake")
    const cId = meta["county-id"] || "PA-C-15";
    const cCode = meta["county-code"] || "15";
    const aId = meta["area-id"] || "";
    const aCode = meta["area-code"] || "";
    const pId = meta["precinct-id"] || "";
    const pCode = meta["precinct-code"] || "";

    // 2. Generate Custom ID Logic
    const codeForId = pCode || aCode || cCode;
    const titleSlug = rawTitle
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 8)
      .toUpperCase();

    const customDocId = `${rawScope.toUpperCase()}-${codeForId}-${rawCategory}-${titleSlug}`;

    // 3. Construct the nested resourceData object
    const resourceData = {
      id: customDocId,
      title: rawTitle,
      category: meta.category || "General",
      description: meta.description || "",
      scope: rawScope,

      // --- THE LOCATION MAP (Firestore Nested Object) ---
      location: {
        county: {
          id: cId,
          code: cCode,
        },
        area: aId
          ? {
              id: aId,
              code: aCode,
            }
          : null,
        precinct: pId
          ? {
              id: pId,
              code: pCode,
            }
          : null,
      },

      // File Metadata
      url: `https://firebasestorage.googleapis.com/v0/b/${fileData.bucket}/o/${encodeURIComponent(fileData.name)}?alt=media`,
      storagePath: fileData.name,
      active: true,
      created_at: Date.now(),
      verified_by_role: "county_chair",
    };

    // 4. Save to collection
    await db
      .collection("campaign_resources")
      .doc(customDocId)
      .set(resourceData);

    logger.info(
      `Successfully indexed ${customDocId} with nested location map.`,
    );
  } catch (error) {
    logger.error("Indexing failed", error);
  }
});

// ================================================================
//  DELETES RESOURCES TEMPLATES BUCKET FILES WHEN DOCUMENTS ARE DELETED
// ================================================================

// ================================================================
//  GET DOWNLOADABLE TEMPLATES
// ================================================================

export const getResourcesByLocation = onCall(
  { cors: true },
  async (request) => {
    const { county, area, precinct } = request.data;

    // 1. Validation: We need at least a County ID to start
    if (!county || !county.full) {
      throw new HttpsError(
        "invalid-argument",
        "A valid County selection is required.",
      );
    }

    try {
      const resourceRef = db.collection("campaign_resources");
      const queries = [];

      // QUERY A: Get County-wide resources
      // These are general assets like "Voter Registration Forms" or "County Slates"
      queries.push(
        resourceRef
          .where("location.county.id", "==", county.full)
          .where("scope", "==", "county")
          .where("active", "==", true)
          .get(),
      );

      // QUERY B: Get Area-specific resources (if an Area is selected)
      // These are assets like "Area 15 Poll Watcher Instructions"
      if (area && area.full) {
        queries.push(
          resourceRef
            .where("location.area.id", "==", area.full)
            .where("scope", "==", "area")
            .where("active", "==", true)
            .get(),
        );
      }

      // QUERY C: Get Precinct-specific resources (if a Precinct is selected)
      // This is where your "Highland Map" (PA15-P-005) lives!
      if (precinct && precinct.full) {
        queries.push(
          resourceRef
            .where("location.precinct.id", "==", precinct.full)
            .where("scope", "==", "precinct")
            .where("active", "==", true)
            .get(),
        );
      }

      // 2. Execute all queries in parallel for maximum speed
      const snapshots = await Promise.all(queries);

      // 3. Flatten the results into a single list
      const allResources = [];
      snapshots.forEach((snap) => {
        snap.forEach((doc) => {
          allResources.push({ id: doc.id, ...doc.data() });
        });
      });

      // 4. Group by Category for the DownloadCenter's UI logic
      // (Matches the 'categorized' logic in your DownloadCenter component)
      const categorized = allResources.reduce((acc, res) => {
        const cat = res.category || "General";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(res);
        return acc;
      }, {});

      logger.info(
        `Found ${allResources.length} resources for ${precinct?.name || area?.name || county.name}`,
      );

      return {
        success: true,
        categorized,
        total: allResources.length,
      };
    } catch (error) {
      logger.error("Error fetching resources:", error);
      throw new HttpsError(
        "internal",
        "Failed to retrieve campaign materials.",
      );
    }
  },
);

// ================================================================
//  CREATE NEW USERS THROUGH ADMIN
// ================================================================

export const adminCreateUser = onCall({ cors: true }, async (request) => {
  // 1. Authentication Guard
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Admin authentication required.");
  }

  const {
    email,
    display_name,
    preferred_name,
    phone,
    role,
    group_id,
    county_id,
    district_id,
    area_id,
    precinct_id,
    active,
    jurisdiction_type,
    jurisdiction_value,
    tempPassword,
  } = request.data;

  // 2. Data Validation
  const isCandidate = role === "candidate";
  if (!email || !display_name || !role || !phone) {
    throw new HttpsError(
      "invalid-argument",
      "Missing core user identity fields.",
    );
  }

  // 3. Authorization Check (Guards)
  const adminRole = request.auth.token.role || "base";
  const adminName = request.auth.token.name || "A Campaign Lead";

  // FIX: Using 'db' constant instead of 'auth.firestore()'
  const adminPermsDoc = await db
    .collection("config")
    .doc("roles_permissions")
    .get();

  const allowedRoles =
    adminPermsDoc.data()?.[adminRole]?.allowed_to_create || [];

  if (adminRole !== "developer" && !allowedRoles.includes(role)) {
    throw new HttpsError(
      "permission-denied",
      `Your role (${adminRole}) is not authorized to provision ${role}s.`,
    );
  }

  try {
    // 4. Phone Normalization (E.164 required for Firebase MFA)
    const formattedPhone = phone.startsWith("+")
      ? phone
      : `+1${phone.replace(/\D/g, "")}`;

    if (formattedPhone.length !== 12) {
      throw new HttpsError(
        "invalid-argument",
        "Valid 10-digit US mobile number required for MFA.",
      );
    }

    // 5. Build Access Hierarchy Object
    let access = {
      counties: [county_id],
      districts: [district_id],
      areas: [area_id].filter(Boolean),
      precincts: [precinct_id].filter(Boolean),
    };

    if (role === "developer") {
      access = {
        counties: ["ALL"],
        districts: ["ALL"],
        areas: ["ALL"],
        precincts: ["ALL"],
      };
    } else if (role === "county_chair") {
      access.districts = ["ALL"];
      access.areas = ["ALL"];
      access.precincts = ["ALL"];
    } else if (role === "state_rep_district") {
      access.areas = ["ALL"];
      access.precincts = ["ALL"];
    } else if (role === "area_chair") {
      access.precincts = ["ALL"];
    }

    // 6. CREATE AUTH ACCOUNT (Using 'auth' constant)
    const userRecord = await auth.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      displayName: display_name.trim(),
      emailVerified: true,
      multiFactor: {
        enrolledFactors: [
          {
            phoneNumber: formattedPhone,
            displayName: "Mobile Phone",
            factorId: "phone",
          },
        ],
      },
    });

    const uid = userRecord.uid;

    // 7. Atomic Firestore Updates (Using 'db' constant)
    const batch = db.batch();

    const userRef = db.collection("users").doc(uid);
    batch.set(userRef, {
      uid,
      email: email.toLowerCase().trim(),
      display_name: display_name.trim(),
      preferred_name: preferred_name || display_name.split(" ")[0],
      phone: formattedPhone,
      role,
      group_id,
      access,
      active: active ?? true,
      requires_password_update: true,
      has_agreed_to_terms: false,
      created_by: request.auth.uid,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    const roleDocId = `${role}_${uid}`.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const roleRef = db.collection("org_roles").doc(roleDocId);
    batch.set(roleRef, {
      id: roleDocId,
      uid,
      email: email.toLowerCase(),
      role,
      group_id,
      county_id,
      district_id: isCandidate ? "CANDIDATE" : district_id,
      area_id: area_id || null,
      precinct_id: precinct_id || null,
      active: true,
      is_vacant: false,
      updated_at: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // 8. Set Custom Claims (Using 'auth' constant)
    await auth.setCustomUserClaims(uid, {
      role,
      group_id,
      permissions: adminPermsDoc.data()?.[role]?.permissions || {},
      counties: access.counties,
      areas: access.areas,
      districts: access.districts,
      precincts: access.precincts,
    });

    logger.info(`Successfully provisioned ${role} with MFA: ${email}`);

    return {
      success: true,
      uid,
      email,
      tempPassword: tempPassword,
      created_by: adminName,
    };
  } catch (error) {
    logger.error("Provisioning critical failure:", error);
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "This email is already in use.");
    }
    if (error.code === "auth/invalid-phone-number") {
      throw new HttpsError("invalid-argument", "Invalid phone number format.");
    }
    throw new HttpsError("internal", error.message);
  }
});

// ================================================================
//  RESET USER PASSWORD FROM ADMIN USERS MODULE
// ================================================================

export const adminResetUserPassword = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.token?.permissions?.can_create_users) {
      throw new HttpsError("permission-denied", "Unauthorized.");
    }

    const { uid, email, display_name, phone } = request.data;

    // Generate new temp password
    const tempPassword = `Reset-${Math.random().toString(36).slice(-6)}!`;

    try {
      // 1. Update Auth with new password
      await admin.auth().updateUser(uid, {
        password: tempPassword,
      });

      // 2. Set the flag in Firestore to force them to the update screen
      await admin.firestore().collection("users").doc(uid).update({
        requires_password_update: true,
        updated_at: Date.now(),
      });

      return {
        success: true,
        tempPassword,
        email,
        display_name,
        created_by: request.auth.token.name || "Campaign Admin",
      };
    } catch (error) {
      throw new HttpsError("internal", error.message);
    }
  },
);

// ================================================================
//  CREATE GOALS THROUGH APP
// ================================================================

export const adminSetGoal = onCall({ cors: true }, async (request) => {
  // 1. Security check: Ensure authenticated admin
  // Note: In production, consider adding a custom claim check: request.auth.token.admin
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be an admin to set goals.",
    );
  }

  // 2. Destructure data from request.data
  const {
    precinct_id,
    precinct_name,
    targets,
    ai_narratives,
    cycle,
    county_id,
    area_id,
  } = request.data;

  // Validation
  if (!precinct_id || !targets) {
    throw new HttpsError("invalid-argument", "Missing precinct_id or targets.");
  }

  try {
    const goalRef = db.collection("goals").doc(precinct_id);

    // 3. Document structure following the refined AI-integrated interface
    const goalData = {
      precinct_id,
      precinct_name: precinct_name || "",
      cycle: cycle || "2026_GENERAL",
      county_id: county_id || "PA-C-15", // Default to Chester County
      area_id: area_id || "",

      // Target benchmarks derived from BigQuery or Admin override
      targets: {
        registrations: Number(targets.registrations) || 0,
        mail_in: Number(targets.mail_in) || 0,
        volunteers: Number(targets.volunteers) || 0,
        user_activity: Number(targets.user_activity) || 0,
      },

      // AI Strategy Briefing tiers
      ai_narratives: {
        summary: ai_narratives?.summary || "No summary provided.",
        positive:
          ai_narratives?.positive || "No positive trends identified yet.",
        immediate: ai_narratives?.immediate || "No immediate risks flagged.",
        actionable:
          ai_narratives?.actionable || "No specific actions assigned.",
      },

      // Metadata for auditing
      updated_at: FieldValue.serverTimestamp(),
      updated_by: request.auth.uid,
    };

    // 4. Upsert using merge: true
    // This creates the doc if it doesn't exist, or updates it if it does.
    // We use set() with merge so we don't accidentally overwrite 'created_at'
    // if it's already there, or we can use a conditional check.

    await goalRef.set(
      {
        ...goalData,
        created_at: FieldValue.serverTimestamp(), // Only sets if doc is new
        created_by: request.auth.uid,
      },
      { merge: true },
    );

    return {
      success: true,
      precinct_id: precinct_id,
      message: "Goal and AI narratives successfully synchronized.",
    };
  } catch (error) {
    console.error("Error setting goal for precinct", precinct_id, ":", error);
    throw new HttpsError("internal", error.message);
  }
});

// ================================================================
//  GET USER BY PHONE_NUMBER THROUGH APP FOR DNC
// ================================================================

export const searchVotersByPhoneV2 = onCall(
  {
    cors: [/localhost:\d+$/, /127\.0\.0\.1:\d+$/, "https://groundgame26.com"],
    region: "us-central1",
    timeoutSeconds: 30,
  },
  async (request) => {
    // 1. Authentication Check
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const { phone } = request.data || {};

    // 2. Input Validation & Normalization
    // Strip all non-digits from input (e.g., "(610) 555-1212" -> "6105551212")
    if (!phone || typeof phone !== "string") {
      throw new HttpsError("invalid-argument", "Phone number is required");
    }

    const normalizedPhone = phone.replace(/\D/g, "");

    if (normalizedPhone.length < 10) {
      throw new HttpsError(
        "invalid-argument",
        "Please enter at least a 10-digit phone number",
      );
    }

    const table = VOTER_TABLE;

    // 3. SQL Query with Normalization
    // Use REGEXP_REPLACE to remove non-digits from the stored phone field for comparison
    const sql = `
      SELECT 
        voter_id,
        full_name,
        age,
        political_party,
        precinct,
        address,
        phone_mobile,
        modeled_party
      FROM \`${table}\`
      WHERE REGEXP_REPLACE(phone_mobile, r'[^0-9]', '') LIKE @phoneQuery
      LIMIT 100
    `;

    try {
      const [rows] = await bigquery.query({
        query: sql,
        params: { phoneQuery: `%${normalizedPhone}%` }, // Supports partial matches
        location: "US",
      });

      console.log(
        `Phone search for "${normalizedPhone}" returned ${rows.length} results`,
      );
      return { voters: rows };
    } catch (error) {
      console.error("Phone search BigQuery error:", error);
      throw new HttpsError("internal", "Search failed — please try again");
    }
  },
);

// ================================================================
//  ASSIGN A USER TO A ROLE THROUGH ADMIN
// ================================================================

export const adminCreateOrgRole = onCall({ cors: true }, async (request) => {
  // 1. Auth Check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { role, county_id, area_id, precinct_id, group_id } = request.data;

  // 2. Data Validation
  if (!role || !county_id || !group_id) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: role, county_id, or group_id.",
    );
  }

  try {
    // 3. Generate a Deterministic Document ID
    // We replace spaces/special chars to ensure a valid Firestore path
    const parts = [
      role,
      county_id,
      area_id || "general",
      precinct_id || "none",
    ].map((p) =>
      String(p)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-"),
    );

    const docId = parts.join("_");

    // CRITICAL FIX: Ensure docId is a valid non-empty string
    if (!docId || docId.length === 0) {
      throw new Error("Generated document ID is invalid.");
    }

    logger.info(`Creating OrgRole: ${docId}`);

    const roleRef = db.collection("org_roles").doc(docId);

    // 4. Use a Transaction to check for duplicates
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(roleRef);

      if (snap.exists) {
        throw new Error("This organizational position already exists.");
      }

      const newRole = {
        id: docId,
        role,
        group_id,
        county_id,
        area_id: area_id || null,
        precinct_id: precinct_id || null,
        uid: null,
        is_vacant: true,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        created_by: request.auth.uid,
      };

      transaction.set(roleRef, newRole);
    });

    return { success: true, id: docId };
  } catch (error) {
    logger.error("Admin Create Org_Role failed:", error);
    throw new HttpsError(
      "internal",
      error.message || "Failed to create position.",
    );
  }
});

// ================================================================
//  ASSIGN USER TO ROLE THROUGH ADMIN
// ================================================================

export const adminAssignUserToRole = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

  const { roleDocId, targetUid } = request.data;

  try {
    return await db.runTransaction(async (transaction) => {
      const roleRef = db.collection("org_roles").doc(roleDocId);
      const userRef = db.collection("users").doc(targetUid);

      const [roleSnap, userSnap] = await Promise.all([
        transaction.get(roleRef),
        transaction.get(userRef),
      ]);

      if (!roleSnap.exists) throw new Error("Role document not found.");
      if (!userSnap.exists) throw new Error("User document not found.");

      const roleData = roleSnap.data();
      const userData = userSnap.data();

      // 1. Update Role Position
      transaction.update(roleRef, {
        uid: targetUid,
        is_vacant: false,
        updated_at: Date.now(),
      });

      // 2. Merge Access (Prevent duplicates with Set)
      const newAccess = {
        counties: [
          ...new Set([
            ...(userData.access?.counties || []),
            roleData.county_id,
          ]),
        ],
        areas: [
          ...new Set([...(userData.access?.areas || []), roleData.area_id]),
        ].filter(Boolean),
        precincts: [
          ...new Set([
            ...(userData.access?.precincts || []),
            roleData.precinct_id,
          ]),
        ].filter(Boolean),
      };

      transaction.update(userRef, {
        role: roleData.role, // Update primary role
        group_id: roleData.group_id,
        access: newAccess,
        last_claims_sync: FieldValue.serverTimestamp(), // Signal AuthContext to refresh
      });

      // 3. Set Custom Claims (Security Layer)
      await auth.setCustomUserClaims(targetUid, {
        role: roleData.role,
        group_id: roleData.group_id,
        counties: newAccess.counties,
        areas: newAccess.areas,
        precincts: newAccess.precincts,
      });

      return { success: true };
    });
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

// ================================================================
//  VACATE USER TO ROLE THROUGH ADMIN
// ================================================================

export const adminVacateOrgRole = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

  const { roleDocId } = request.data;

  try {
    return await db.runTransaction(async (transaction) => {
      const roleRef = db.collection("org_roles").doc(roleDocId);
      const roleSnap = await transaction.get(roleRef);

      if (!roleSnap.exists) throw new Error("Role position not found.");
      const roleData = roleSnap.data();
      const targetUid = roleData.uid;

      // 1. Clear the position
      transaction.update(roleRef, {
        uid: null,
        is_vacant: true,
        updated_at: Date.now(),
      });

      // 2. If someone was in the seat, update their profile
      if (targetUid) {
        const userRef = db.collection("users").doc(targetUid);

        // Find ALL other roles this user still holds
        const otherRolesSnap = await db
          .collection("org_roles")
          .where("uid", "==", targetUid)
          .get();

        // Filter out the one we just vacated in this transaction
        const remainingRoles = otherRolesSnap.docs
          .map((d) => d.data())
          .filter((r) => r.id !== roleDocId);

        // Recalculate access arrays from remaining roles
        const newAccess = {
          counties: [...new Set(remainingRoles.map((r) => r.county_id))],
          areas: [...new Set(remainingRoles.map((r) => r.area_id))].filter(
            Boolean,
          ),
          precincts: [
            ...new Set(remainingRoles.map((r) => r.precinct_id)),
          ].filter(Boolean),
        };

        // Determine new primary role (usually the highest rank or 'base' if none left)
        const newRoleLabel =
          remainingRoles.length > 0 ? remainingRoles[0].role : "base";

        transaction.update(userRef, {
          role: newRoleLabel,
          access: newAccess,
          last_claims_sync: FieldValue.serverTimestamp(),
        });

        // 3. Update Custom Claims to reflect the loss of access
        await auth.setCustomUserClaims(targetUid, {
          role: newRoleLabel,
          counties: newAccess.counties,
          areas: newAccess.areas,
          precincts: newAccess.precincts,
        });
      }

      return { success: true };
    });
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

// ================================================================
//  TOGGLE ACTIVE/DEACTIVE ROLE THROUGH ADMIN
// ================================================================

export const adminToggleRoleActive = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

  const { roleDocId, active } = request.data;

  try {
    const roleRef = db.collection("org_roles").doc(roleDocId);
    const roleSnap = await roleRef.get();

    if (!roleSnap.exists) throw new Error("Role not found.");
    const roleData = roleSnap.data();

    // 1. Update the Role status
    await roleRef.update({
      active: active,
      updated_at: Date.now(),
    });

    // 2. If the role has a user, we need to refresh their claims
    if (roleData.uid) {
      const userRef = db.collection("users").doc(roleData.uid);

      // Fetch all ACTIVE roles for this user to rebuild claims
      const activeRolesSnap = await db
        .collection("org_roles")
        .where("uid", "==", roleData.uid)
        .where("active", "==", true)
        .get();

      const activeRoles = activeRolesSnap.docs.map((d) => d.data());

      const newAccess = {
        counties: [...new Set(activeRoles.map((r) => r.county_id))],
        areas: [...new Set(activeRoles.map((r) => r.area_id))].filter(Boolean),
        precincts: [...new Set(activeRoles.map((r) => r.precinct_id))].filter(
          Boolean,
        ),
      };

      await userRef.update({
        access: newAccess,
        last_claims_sync: FieldValue.serverTimestamp(),
      });

      await auth.setCustomUserClaims(roleData.uid, {
        counties: newAccess.counties,
        areas: newAccess.areas,
        precincts: newAccess.precincts,
      });
    }

    return { success: true };
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

// ================================================================
//  CREATE SURVEY META THROUGH ADMIN
// ================================================================

export const adminCreateSurvey = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const data = request.data;

  if (!data.survey_id || !data.name || !data.jsonPath) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  try {
    await db
      .collection("surveys")
      .doc(data.survey_id)
      .set({
        survey_id: data.survey_id.trim(),
        name: data.name.trim(),
        description: data.description?.trim() || null,
        jsonPath: data.jsonPath?.trim() || null,
        demographics: data.demographics || {},
        active: data.active ?? true,
        created_at: Date.now(),
        updated_at: Date.now(),
        created_by: request.auth.uid,
      });

    return { success: true };
  } catch (error) {
    throw new HttpsError(
      "internal",
      error.message || "Failed to create survey",
    );
  }
});

// ================================================================
//  EDIT SURVEY META THROUGH ADMIN
// ================================================================

export const adminUpdateSurvey = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const data = request.data;

  if (!data.id || !data.updates) {
    throw new HttpsError("invalid-argument", "Missing id or updates");
  }

  const { id, updates } = data;

  // Optional: extra validation on updates
  if (!updates.survey_id || !updates.name || !updates.jsonPath) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields in updates",
    );
  }

  try {
    await db
      .collection("surveys")
      .doc(id) // ← uses the Firestore document ID (not survey_id)
      .update({
        ...updates,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        // Optional: updated_by: request.auth.uid,
      });

    return { success: true, message: "Survey updated" };
  } catch (error) {
    console.error("Update error:", error);
    throw new HttpsError(
      "internal",
      error.message || "Failed to update survey",
    );
  }
});

// ================================================================
//  CREATE OR EDIT SURVEY META THROUGH ADMIN
// ================================================================

export const adminCreateOrUpdateSurvey = onCall(
  { cors: true },
  async (request) => {
    // 1. Auth Check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const data = request.data;

    // 2. Strict Validation
    // Ensure the ID exists and isn't just whitespace
    const rawId = data.survey_id?.toString().trim();
    if (!rawId || !data.name?.trim() || !data.jsonPath?.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: survey_id, name, or jsonPath.",
      );
    }

    const surveyId = rawId; // This is now guaranteed to be a non-empty string

    const payload = {
      survey_id: surveyId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      jsonPath: data.jsonPath.trim(),
      demographics: data.demographics || {},
      active: data.active ?? true,
      updated_at: FieldValue.serverTimestamp(), // Better than Date.now()
    };

    try {
      const docRef = db.collection("surveys").doc(surveyId);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        await docRef.update(payload);
        logger.info(`Survey ${surveyId} updated`);
        return { success: true, message: `Survey ${surveyId} updated` };
      } else {
        await docRef.set({
          ...payload,
          created_at: FieldValue.serverTimestamp(),
          created_by: request.auth.uid,
        });
        logger.info(`Survey ${surveyId} created`);
        return { success: true, message: `Survey ${surveyId} created` };
      }
    } catch (error) {
      logger.error("Survey operation failed:", error);
      throw new HttpsError("internal", error.message || "Operation failed");
    }
  },
);

// ================================================================
//  HANDLES NOTIFICATION PREFERENCES FROM USER SETTINGS CHANGES
// ================================================================

export const syncFCMTopics = onDocumentUpdated("users/{uid}", async (event) => {
  const before = event.data.before.data().notification_preferences || {};
  const after = event.data.after.data().notification_preferences || {};
  const uid = event.params.uid;

  // 1. Get user's device tokens
  const tokensSnap = await getFirestore()
    .collection(`users/${uid}/fcmTokens`)
    .get();
  const tokens = tokensSnap.docs.map((d) => d.id);

  if (tokens.length === 0) {
    logger.info(
      `User ${uid} updated preferences but has no active device tokens.`,
    );
    return;
  }

  // 2. Determine which keys changed
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    // 🛡️ SKIP METADATA: Ignore last_updated or other non-topic fields
    if (key === "last_updated") continue;

    const wasSubscribed = before[key] === true;
    const isSubscribed = after[key] === true;

    // Only act if the toggle actually changed
    if (wasSubscribed !== isSubscribed) {
      try {
        if (isSubscribed) {
          await getMessaging().subscribeToTopic(tokens, key);
          logger.info(`✅ Subscribed ${uid} to topic: ${key}`);
        } else {
          await getMessaging().unsubscribeFromTopic(tokens, key);
          logger.info(`❌ Unsubscribed ${uid} from topic: ${key}`);
        }
      } catch (error) {
        logger.error(`FCM Sync Error for topic ${key}:`, error);
      }
    }
  }
});

// ================================================================
//  HANDLES CHRON CLEAN UP OF EXPIRED INTERACTIONS WITH VOTERS
//  PREVENTS VOTERS FROM BEING OVER CONTACTED FROM DIFFERENT VOLUNTEERS
// ================================================================

export const cleanupExpiredInteractions = onSchedule(
  {
    schedule: "0 0 * * *", // Runs every day at midnight
    region: "us-central1", // Match your other functions for latency consistency
    memory: "256MiB", // Lightweight task
    retryCount: 3, // Optional: Automatically retries on failure
  },
  async (event) => {
    const now = Date.now();
    const collectionRef = db.collection("voter_interactions");

    try {
      // Query all docs where expires_at has passed
      const expiredQuery = collectionRef.where("expires_at", "<", now);
      const snapshot = await expiredQuery.get();

      if (snapshot.empty) {
        logger.info("No expired interactions to clean up.");
        return;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      // Using v2 logger for better structured logging
      logger.info(
        `Successfully deleted ${snapshot.size} expired interactions.`,
        {
          executionTime: event.scheduleTime,
          count: snapshot.size,
        },
      );
    } catch (error) {
      logger.error("Cleanup job failed:", error);
      throw error; // Throwing ensures the scheduler registers a failure
    }
  },
);

// ================================================================
//  HANDLES VOTER NAME OR ADDRESS SEARCHES FROM APP
// ================================================================

export const searchVotersUniversal = onCall(
  {
    cors: [/localhost:\d+$/, /127\.0\.0\.1:\d+$/, "https://groundgame26.com"],
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth?.uid)
      throw new HttpsError("unauthenticated", "Authentication required");

    const filters = request.data || {};
    const table = VOTER_TABLE;

    let sql = `SELECT voter_id, full_name, address, political_party, sex, age, precinct, email, phone_mobile, phone_home 
             FROM \`${table}\` WHERE 1=1`;

    const params = {};

    // --- LOGGING INPUT ---
    logger.info("Search Request Received", {
      term: filters.term,
      precinct: filters.precinct,
      area: filters.area,
      uid: request.auth.uid,
    });

    // 1. Enforce Geographic Permissions
    if (filters.area && filters.area.trim() !== "") {
      sql += ` AND area_district = @area`;
      params.area = filters.area.trim();
    }
    if (filters.precinct && filters.precinct.trim() !== "") {
      const normalized = filters.precinct.trim().replace(/^0+/, "") || "0";
      logger.log("Params: precinct", normalized);
      sql += ` AND precinct = @precinct`;
      params.precinct = normalized;
    }

    // 2. Smart Search Logic
    if (filters.term) {
      const cleanTerm = filters.term.trim().toLowerCase();

      if (/^\d/.test(cleanTerm)) {
        // Address Match
        sql += ` AND LOWER(address) LIKE @addr`;
        params.addr = `${cleanTerm}%`;
      } else {
        // Name Match: Split into tokens (e.g., "Daniel Keane" -> ["daniel", "keane"])
        const tokens = cleanTerm.split(/\s+/).filter((t) => t.length > 0);

        if (tokens.length > 1) {
          // Case: "Daniel Keane" - ensures BOTH tokens exist in full_name
          tokens.forEach((token, idx) => {
            const pName = `token${idx}`;
            sql += ` AND LOWER(full_name) LIKE @${pName}`;
            params[pName] = `%${token}%`;
          });
        } else {
          // Case: "DanielKeane" - matches against actual name OR name with spaces removed
          sql += ` AND (LOWER(full_name) LIKE @name OR LOWER(REPLACE(full_name, ' ', '')) LIKE @name)`;
          params.name = `%${cleanTerm}%`;
        }
      }
    }

    sql += ` AND voter_status = 'A' ORDER BY 
        REGEXP_REPLACE(address, r'^[0-9]+\\s+', '') ASC,
        house_int ASC,
        full_name ASC LIMIT 100`;

    try {
      const [rows] = await bigquery.query({
        query: sql,
        params,
        location: "US",
      });
      logger.info("Query successful", { count: rows.length });
      return { voters: rows };
    } catch (error) {
      logger.error("BigQuery Search Error", { error: error.message, sql });
      throw new HttpsError("internal", "Query failed — check server logs");
    }
  },
);
