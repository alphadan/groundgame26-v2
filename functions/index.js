import * as functions from "firebase-functions/v1";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { BigQuery } from "@google-cloud/bigquery";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import axios from "axios";

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
        address, city, phone_mobile, phone_home, has_mail_ballot,
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
        role: "base", // Default starting role
        org_id: "pending", // Placeholder until syncOrgRolesToClaims runs
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
// 6. PERMISSIONS ENGINE — CENTRALIZED & CLEAN
// ================================================================

const getPermissionsForRole = (role) => {
  const base = {
    can_export_csv: false,
    can_manage_team: false,
    can_view_phone: false,
    can_view_full_address: false,
    can_cut_turf: false,
  };

  switch (role?.toLowerCase()) {
    case "county_chair":
    case "state_admin":
    case "state_chair":
    case "state_rep":
      return {
        ...base,
        can_export_csv: true,
        can_manage_team: true,
        can_view_phone: true,
        can_view_full_address: true,
        can_cut_turf: true,
      };

    case "area_chair":
    case "area chairman":
      return {
        ...base,
        can_export_csv: true,
        can_manage_team: true,
        can_view_phone: true,
        can_view_full_address: true,
        can_cut_turf: true,
      };

    case "candidate":
      return {
        ...base,
        can_export_csv: true,
        can_view_phone: true,
        can_view_full_address: false,
      };

    case "ambassador":
      return {
        ...base,
        can_export_csv: true,
        can_view_phone: true,
        can_view_full_address: false,
      };

    case "committeeperson":
    case "committeeman":
    case "committeewoman":
      return {
        ...base,
        can_export_csv: true,
        can_view_phone: true,
        can_view_full_address: false,
      };

    default:
      return base;
  }
};

// ================================================================
//  SYNC ORG ROLES — CENTRALIZED & CLEAN
// ================================================================

export const syncOrgRolesToClaims = functions.firestore
  .document("org_roles/{docId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    if (!after || after.is_vacant || !after.uid) {
      if (before?.uid)
        await getAuth().setCustomUserClaims(before.uid, { role: "admin" });
      return;
    }

    const uid = after.uid;

    logger.info("[syncOrgRolesToClaims]uid :", uid);

    const snap = await db
      .collection("org_roles")
      .where("uid", "==", uid)
      .where("is_vacant", "==", false)
      .get();

    if (snap.empty) {
      await getAuth().setCustomUserClaims(uid, { role: "admin" });
      logger.info("[syncOrgRolesToClaims]setCustomUserClaims:uid :", uid);
      return;
    }

    const precincts = [];
    const counties = new Set();
    const areas = new Set();
    const orgIds = new Set();
    const roles = new Set();

    snap.forEach((doc) => {
      const d = doc.data();
      roles.add(d.role);
      if (d.org_id) orgIds.add(d.org_id);
      if (d.county_code) counties.add(d.county_code);
      if (d.area_district) areas.add(d.area_district);
      if (d.precinct_code) precincts.push(d.precinct_code);
    });

    logger.info("[syncOrgRolesToClaims]roles :", roles);

    const primaryRole = [...roles][0] || "base";
    logger.info("[syncOrgRolesToClaims]primaryRole :", primaryRole);
    const permissions = getPermissionsForRole(primaryRole);

    const claims = {
      role: primaryRole,
      roles: [...roles],
      counties: [...counties],
      areas: [...areas],
      precincts,
      org_id: [...orgIds][0] || null,
      permissions,
      scope: [
        ...[...counties].map((c) => `county:${c}`),
        ...[...areas].map((a) => `area:${a}`),
        ...precincts.map((p) => `precinct:${p}`),
        ...[...orgIds].map((o) => `org:${o}`),
      ],
    };

    logger.info("[syncOrgRolesToClaims]claims :", claims);

    await getAuth().setCustomUserClaims(uid, claims);

    await db.doc(`users/${uid}`).set(
      {
        primary_county: claims.counties[0] || null,
        primary_precinct: precincts[0] || null,
        role: primaryRole,
        permissions,
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

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
      precinct: precinct || null,
      full_name: full_name || "Unknown",
      address: address || "Unknown",
      note: note.trim(),
      created_by_uid: request.auth.uid,
      created_by_name: authUser.displayName || authUser.email || "Unknown",
      created_at: new Date(),
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to save voter note:", error);
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
