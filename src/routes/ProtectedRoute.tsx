import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { multiFactor } from "firebase/auth";

interface ProtectedRouteProps {
  // We use keyof to ensure only valid permission strings are passed
  requiredPermission?: string;
  allowedRoles?: string[];
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredPermission,
  allowedRoles,
}) => {
  const { user, permissions, role, isLoaded } = useAuth();
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

  // 4. ROLE CHECK (NEW)
  // If we defined specific allowed roles for this route, check them here
  if (allowedRoles && !allowedRoles.includes(role)) {
    console.warn(
      `ProtectedRoute: Role ${role} not authorized for ${location.pathname}`,
    );
    // Redirect to the appropriate home page based on role
    const homePath = role === "volunteer" ? "/voters" : "/dashboard";
    return <Navigate to={homePath} replace />;
  }

  // 5. Check specific permissions (e.g., can_manage_team)
  if (
    requiredPermission &&
    !permissions[requiredPermission as keyof typeof permissions]
  ) {
    console.warn("ProtectedRoute: Missing permission", requiredPermission);
    const homePath = role === "volunteer" ? "/voters" : "/dashboard";
    return <Navigate to={homePath} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
