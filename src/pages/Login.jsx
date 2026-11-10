import { useNavigate, useLocation } from "react-router-dom";
import LoginForm from "../components/auth/LoginForm";
import { login as requestLogin, MOCK_CREDENTIALS } from "../lib/auth/authApi";
import { saveSession } from "../lib/auth/authSession";
import { AUTH_MOCK } from "../lib/runtimeConfig";

const safeRedirect = (from) => (typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && from !== "/login" ? from : "/dashboard");

export default function Login({ loginRequest = requestLogin, mock = AUTH_MOCK }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (credentials) => {
    const result = await loginRequest(credentials);
    saveSession(result);
    navigate(safeRedirect(location.state?.from), { replace: true });
  };

  const hint = mock
    ? `Тестовый режим без сервера. Логин: ${MOCK_CREDENTIALS.login}, пароль: ${MOCK_CREDENTIALS.password}.`
    : null;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-stone-100 via-white to-sky-50 px-4 text-stone-900">
      <div className="w-full max-w-sm">
        <LoginForm onSubmit={handleSubmit} hint={hint} />
      </div>
    </div>
  );
}
