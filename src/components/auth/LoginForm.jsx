import { useState } from "react";
import { AUTH_ERROR_CODES } from "../../lib/auth/authApi";

const cardCls =
  "rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-[0_18px_40px_rgba(15,23,42,0.06)] p-6";
const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-stone-50 aria-[invalid=true]:border-rose-300";

const LOGIN_MESSAGES = Object.freeze({
  emptyBoth: "Введите логин и пароль.",
  emptyLogin: "Введите логин.",
  emptyPassword: "Введите пароль.",
  [AUTH_ERROR_CODES.invalidCredentials]: "Неверный логин или пароль.",
  [AUTH_ERROR_CODES.unavailable]: "Сервер недоступен. Проверьте подключение и попробуйте позже.",
  [AUTH_ERROR_CODES.badRequest]: "Сервер отклонил запрос входа.",
  [AUTH_ERROR_CODES.badResponse]: "Сервер вернул непонятный ответ.",
});

const validate = (login, password) => {
  if (!login && !password) return { message: LOGIN_MESSAGES.emptyBoth, fields: ["login", "password"] };
  if (!login) return { message: LOGIN_MESSAGES.emptyLogin, fields: ["login"] };
  if (!password) return { message: LOGIN_MESSAGES.emptyPassword, fields: ["password"] };
  return null;
};

export default function LoginForm({ onSubmit, hint = null }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    const trimmedLogin = login.trim();
    const invalid = validate(trimmedLogin, password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit({ login: trimmedLogin, password });
    } catch (submitError) {
      const message = LOGIN_MESSAGES[submitError?.code] || LOGIN_MESSAGES[AUTH_ERROR_CODES.unavailable];
      const fields = submitError?.code === AUTH_ERROR_CODES.invalidCredentials ? ["login", "password"] : [];
      setError({ message, fields });
      if (fields.length) setPassword("");
      setLoading(false);
    }
  };

  const invalid = (field) => (error?.fields.includes(field) ? "true" : undefined);

  return (
    <form className={cardCls} onSubmit={handleSubmit} noValidate aria-busy={loading || undefined}>
      <h1 className="text-xl font-semibold text-stone-900">Вход</h1>
      <p className="mt-1 text-sm text-stone-500">Планировщик маршрута робота</p>

      <label className="mt-5 block text-xs font-semibold text-stone-600" htmlFor="login-name">Логин</label>
      <input id="login-name" name="login" type="text" autoComplete="username" autoFocus
        value={login} onChange={(event) => setLogin(event.target.value)} disabled={loading}
        aria-invalid={invalid("login")} aria-describedby={error ? "login-error" : undefined}
        className={`${inputCls} mt-1`} />

      <label className="mt-3 block text-xs font-semibold text-stone-600" htmlFor="login-password">Пароль</label>
      <input id="login-password" name="password" type="password" autoComplete="current-password"
        value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading}
        aria-invalid={invalid("password")} aria-describedby={error ? "login-error" : undefined}
        className={`${inputCls} mt-1`} />

      {error && (
        <div id="login-error" role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error.message}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="mt-5 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-950 disabled:cursor-wait disabled:opacity-60">
        {loading ? "Входим…" : "Войти"}
      </button>

      {hint && <p className="mt-3 text-xs text-stone-500">{hint}</p>}
    </form>
  );
}
