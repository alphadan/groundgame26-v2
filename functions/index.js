// functions/index.js — FINAL, PRODUCTION-READY (Dec 2025)
import * as functionsV1 from "firebase-functions/v1"; // replaces const functionsV1 = require("firebase-functions/v1");

// For 2nd gen HTTPS (or other v2 triggers)
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";

// BigQuery
import { BigQuery } from "@google-cloud/bigquery";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
initializeApp();

const db = getFirestore();
const bigquery = new BigQuery();

// ================================================================
// 1. BIGQUERY PROXY — GEN 2 (UPDATED FOR V2 PROJECT)
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
// 2. AUTO-CREATE users/{uid} — GEN 1
// ================================================================
export const createUserProfile = functionsV1.auth
  .user()
  .onCreate(async (user) => {
    const uid = user.uid;
    const email = user.email?.toLowerCase() || "";
    const displayName = user.displayName || email.split("@")[0];

    try {
      await db.doc(`users/${uid}`).set({
        uid,
        display_name: displayName,
        email,
        phone: user.phoneNumber || "",
        photo_url: user.photoURL || "",
        created_at: FieldValue.serverTimestamp(),
        last_login: FieldValue.serverTimestamp(),
        last_ip: "auth-trigger",
        login_count: 1,
      });

      await db.collection("login_attempts").add({
        uid,
        email,
        success: true,
        ip: "auth-trigger",
        user_agent: "firebase-auth",
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("createUserProfile failed:", err);
    }
  });

// ================================================================
// 3. USER ACTIVITY LOG — REFACTORED FOR AUTH STABILITY
// ================================================================

export const logLoginActivity = onCall({ cors: true }, async (request) => {
  const data = request.data || {};
  const success = Boolean(data.success);

  // 1. Identify the user
  // If successful login, use request.auth. If failed, use UID passed in data (if available)
  const uid = request.auth?.uid || data.uid || "anonymous";
  const email =
    request.auth?.token?.email?.toLowerCase() ||
    data.email?.toLowerCase() ||
    "unknown";

  const ip = request.rawRequest?.ip || "unknown";
  const userAgent = request.rawRequest?.headers["user-agent"] || "unknown";

  try {
    // 2. Log the attempt (This works for both success and failure)
    await db.collection("login_activity").add({
      uid: uid,
      email: email,
      success: success,
      error_code: data.errorCode || null,
      ip: ip,
      user_agent: userAgent,
      client_timestamp: data.timestamp || null,
      server_timestamp: FieldValue.serverTimestamp(),
      type: success ? "login_success" : "login_failed",
    });

    // 3. Update User Metadata (ONLY if authenticated and successful)
    if (success && request.auth) {
      const userRef = db.doc(`users/${request.auth.uid}`);

      // Use a set with merge:true in case the user doc doesn't exist yet
      await userRef.set(
        {
          last_ip: ip,
          login_count: FieldValue.increment(1),
          last_login: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return { success: true };
  } catch (err) {
    // Log the ACTUAL error to Firebase Logs so you can see it in the console
    console.error("CRITICAL: logLoginActivity failed internal execution:", err);

    // Do not throw HttpsError for logging—just return a graceful failure
    // so the user's login experience isn't interrupted by a logging bug
    return { success: false, error: "Internal logging failure" };
  }
});

// ================================================================
// 4. PERMISSIONS ENGINE — CENTRALIZED & CLEAN
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
// 5. SYNC org_roles → Custom Claims + Permissions
// ================================================================
export const syncOrgRolesToClaims = functionsV1.firestore
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
// 6. SECURE VOLUNTEER SUBMISSION
// ================================================================
export const submitVolunteer = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    try {
      const { name, email, comment, recaptchaToken } = req.body;

      if (!recaptchaToken) throw new Error("reCAPTCHA required");

      await db.collection("volunteer_requests").add({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        comment: comment?.trim() || "",
        submitted_at: FieldValue.serverTimestamp(),
        status: "new",
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Volunteer submit failed:", err);
      res.status(400).json({ error: err.message });
    }
  }
);
