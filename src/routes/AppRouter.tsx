import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

// Page Imports
import Dashboard from "../app/dashboard/Dashboard";
import AnalysisPage from "../app/analysis/AnalysisPage";
import ResourcesPage from "../app/resources/ResourcesPage";
import VoterListPage from "../app/voters/VoterListPage";
import WalkListPage from "../app/walk/WalkListPage";
import NameSearchPage from "../app/voters/NameSearchPage";
import SettingsPage from "../app/settings/SettingsPage";
import HowToUsePage from "../app/guide/HowToUsePage";
import RewardsRedemptionPage from "../app/rewards/RewardsRedemptionPage";
import LegalPage from "../pages/legal/LegalPage";
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

export default function AppRouter() {
  return (
    <Routes>
      {/* PUBLIC ROUTES 
          These are rendered inside MainLayout but accessible to any logged-in user.
          (Note: Login/EnrollMFA are handled in App.tsx BEFORE this router is reached)
      */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/analysis" element={<AnalysisPage />} />
      <Route path="/resources" element={<ResourcesPage />} />
      <Route path="/voters" element={<VoterListPage />} />
      <Route path="/walk-lists" element={<WalkListPage />} />
      <Route path="/name-search" element={<NameSearchPage />} />
      <Route path="/manage-team" element={<ManageTeamPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/how-to-use" element={<HowToUsePage />} />
      <Route path="/rewards" element={<RewardsRedemptionPage />} />
      <Route path="/legal" element={<LegalPage />} />

      {/* ADMIN PROTECTED ROUTES 
          The ProtectedRoute component acts as a gatekeeper. 
          If the user doesn't have 'can_manage_team', they are bounced to /dashboard.
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
      </Route>

      {/* Global Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
