import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

// Auth & Public Pages
import LoginPage from "../pages/auth/LoginPage";
import LegalPage from "../pages/legal/LegalPage";
import AboutPage from "../pages/public/AboutPage";
import ContactPage from "../pages/public/ContactPage";
import VolunteerPage from "../pages/public/VolunteerPage";
import SurveysPage from "../pages/public/SurveysPage";

// Private Page Imports
import Dashboard from "../app/dashboard/Dashboard";
import AnalysisPage from "../app/analysis/AnalysisPage";
import ResourcesPage from "../app/resources/ResourcesPage";
import VoterListPage from "../app/voters/VoterListPage";
import WalkListPage from "../app/walk/WalkListPage";
import NameSearchPage from "../app/voters/NameSearchPage";
import SettingsPage from "../app/settings/SettingsPage";
import HowToUsePage from "../app/guide/HowToUsePage";
import RewardsRedemptionPage from "../app/rewards/RewardsRedemptionPage";
import ManageTeamPage from "../app/precincts/ManageTeamPage";

// Admin Imports
import AdminDashboard from "../app/admin/AdminDashboard";
import UsersManagement from "../app/admin/users/UsersManagement";
import AreasManagement from "../app/admin/areas/AreasManagement";
import PrecinctsManagement from "../app/admin/precincts/PrecinctsManagement";
import MessagesManagement from "../app/admin/messages/MessagesManagement";
import EngagementCenterPage from "../app/admin/engagement/EngagementCenterPage";
import ResourcesManagement from "../app/admin/resources/ResourcesManagement";
import GroupsManagement from "../app/admin/groups/GroupsManagement";
import NotificationsManagement from "../app/admin/notifications/NotificationsManagement";
import AnalyticsManagement from "../app/admin/analytics/AnalyticsManagement";
import GoalsManagement from "../app/admin/goals/GoalsManagement";
import RolesManagement from "../app/admin/roles/RolesManagement";
import DncManagement from "../app/admin/dnc/DncManagement";
import SurveysManagement from "../app/admin/surveys/SurveysManagement";
import SurveyResults from "../app/admin/surveys/SurveyResults";
import DistrictsManagement from "../app/admin/districts/DistrictsManagement";
import SystemGovernance from "../app/admin/system/SystemGovernance";

export default function AppRouter() {
  const { user, role } = useAuth();

  console.log("AppRouter: Auth State - User exists:", !!user);

  const getHomePath = () => {
    if (role === "volunteer") return "/voters";
    return "/dashboard";
  };

  return (
    <Routes>
      {/* 1. PUBLIC ROUTES
          Accessible to everyone, regardless of login status.
      */}
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/volunteer" element={<VolunteerPage />} />
      <Route path="/surveys/:id" element={<SurveysPage />} />

      {/* 2. AUTHENTICATION ENTRY POINT
          If NO user: Show LoginPage at both "/" and "/login"
          If USER: Redirect to "/dashboard"
      */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      {/* 3. PROTECTED USER ROUTES
          These routes require the user to be logged in and MFA verified via ProtectedRoute.
      */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/voters" element={<VoterListPage />} />
        <Route path="/walk-lists" element={<WalkListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/how-to-use" element={<HowToUsePage />} />
        <Route path="/rewards" element={<RewardsRedemptionPage />} />
      </Route>

      {/* 4. BUCKET 2: LEADERSHIP PROTECTED ROUTES
          Accessible to Candidates, Area Chairs, and higher (HIDDEN FROM VOLUNTEERS).
      */}
      <Route
        element={
          <ProtectedRoute
            allowedRoles={[
              "developer",
              "state_admin",
              "county_chair",
              "state_rep_district",
              "area_chair",
              "candidate",
            ]}
          />
        }
      >
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/name-search" element={<NameSearchPage />} />
        <Route path="/manage-team" element={<ManageTeamPage />} />
      </Route>

      {/* 5. BUCKET 3: ADMIN PROTECTED ROUTES
          Requires dynamic 'can_manage_team' permission from Firestore.
      */}
      <Route element={<ProtectedRoute requiredPermission="can_manage_team" />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UsersManagement />} />
        <Route path="/admin/areas" element={<AreasManagement />} />
        <Route path="/admin/precincts" element={<PrecinctsManagement />} />
        <Route path="/admin/messages" element={<MessagesManagement />} />
        <Route path="/admin/resources" element={<ResourcesManagement />} />
        <Route path="/admin/groups" element={<GroupsManagement />} />
        <Route path="/admin/engagement" element={<EngagementCenterPage />} />
        <Route
          path="/admin/notifications"
          element={<NotificationsManagement />}
        />
        <Route path="/admin/analytics" element={<AnalyticsManagement />} />
        <Route path="/admin/goals" element={<GoalsManagement />} />
        <Route path="/admin/roles" element={<RolesManagement />} />
        <Route path="/admin/dnc" element={<DncManagement />} />
        <Route path="/admin/surveys" element={<SurveysManagement />} />
        <Route
          path="/admin/surveys/:survey_id/results"
          element={<SurveyResults />}
        />
        <Route path="/admin/districts" element={<DistrictsManagement />} />
        <Route path="/admin/system" element={<SystemGovernance />} />
      </Route>

      {/* 6. DYNAMIC ROOT */}
      <Route
        path="/"
        element={user ? <Navigate to={getHomePath()} replace /> : <LoginPage />}
      />

      {/* 7. DYNAMIC ROOT & CATCH-ALL */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
