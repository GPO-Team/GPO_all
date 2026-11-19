import { Navigate, useLocation } from "react-router-dom";
import { AUTH_REQUIRED } from "../../lib/runtimeConfig";
import { getSession, hasDemo } from "../../lib/auth/authSession";

// Demo access is available only when server authentication is not required.
export default function RequireAuth({ children, required = AUTH_REQUIRED }) {
  const location = useLocation();
  if (getSession() || (!required && hasDemo())) return children;
  return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
}
