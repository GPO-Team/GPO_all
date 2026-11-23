import { useNavigate, useLocation } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import LoginForm from "../components/auth/LoginForm";
import ManipulatorIllustration from "../components/auth/ManipulatorIllustration";
import { login as requestLogin, MOCK_CREDENTIALS } from "../lib/auth/authApi";
import { saveSession, enterDemo } from "../lib/auth/authSession";
import { AUTH_MOCK, AUTH_REQUIRED } from "../lib/runtimeConfig";

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
    <div className="login-page flex min-h-screen w-full items-center justify-center px-4 text-stone-900">
      <div className="login-top"><span className="login-brand"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 26h19M7 25v-4l5-4 3-8 4 2-3 9 3 5M16 10l5-5 4 3-5 5M25 7l2-2m-1 5 3 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="15" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="18" cy="10" r="2" stroke="currentColor" strokeWidth="1.5"/></svg><span>GPO</span></span><ThemeToggle /></div>
      <div className="login-layout">
      <div className="login-form-column">
        <LoginForm onSubmit={handleSubmit} hint={hint} onDemo={!AUTH_REQUIRED ? () => { enterDemo(); navigate(safeRedirect(location.state?.from), { replace: true }); } : null} />
      </div>
      <div className="login-visual"><ManipulatorIllustration /></div>
      </div>
    </div>
  );
}
