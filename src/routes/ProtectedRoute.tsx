import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  // We use keyof to ensure only valid permission strings are passed
  requiredPermission?: string;
  redirectTo?: string;
}

const ProtectedRoute = ({
  requiredPermission,
  redirectTo = "/dashboard",
}: ProtectedRouteProps) => {
  const { claims } = useAuth();

  // TypeScript fix: Cast permissions to any or use a string index check
  const permissions = claims?.permissions as Record<string, any>;

  if (requiredPermission && !permissions?.[requiredPermission]) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
