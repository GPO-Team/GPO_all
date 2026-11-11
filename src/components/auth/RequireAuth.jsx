import { Navigate, useLocation } from "react-router-dom";
import { AUTH_REQUIRED } from "../../lib/runtimeConfig";
import { getSession } from "../../lib/auth/authSession";

// Пока VITE_AUTH_REQUIRED не включён, маршруты открыты как раньше.
export default function RequireAuth({ children, required = AUTH_REQUIRED }) {
  const location = useLocation();
  if (!required || getSession()) return children;
  return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
}
