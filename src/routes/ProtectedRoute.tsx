import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { multiFactor } from "firebase/auth";

interface ProtectedRouteProps {
  // We use keyof to ensure only valid permission strings are passed
  requiredPermission?: string;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredPermission,
}) => {
  const { user, claims, isLoaded } = useAuth();
  const location = useLocation();

  // 1. Wait for Auth to load to prevent "false" redirects
  if (!isLoaded) return null;

  // 2. No User? Redirect to Login and save the path they tried to hit
  if (!user) {
    console.log("ProtectedRoute: No user found, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Logged in but no MFA? Redirect to Enrollment
  const mfaUser = multiFactor(user);
  if (mfaUser.enrolledFactors.length === 0) {
    return <Navigate to="/enroll-mfa" replace />;
  }

  // 4. Check specific permissions (e.g., can_manage_team)
  const permissions = claims?.permissions as Record<string, any>;
  if (requiredPermission && !permissions?.[requiredPermission]) {
    console.warn("ProtectedRoute: Missing permission", requiredPermission);
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
