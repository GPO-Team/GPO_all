import { useState } from "react";
import { Eye } from "lucide-react";
import { normalizeIdentifier, validateAuth } from "../../../shared/auth-validation";
import { AUTH_ERROR_CODES, register, requestPasswordReset, resetPassword } from "../../lib/auth/authApi";

const cardCls = "rounded-2xl bg-white/95 backdrop-blur border border-stone-200 p-6";
const inputCls = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-stone-50 aria-[invalid=true]:border-rose-300";
const titles = { login: "Вход", register: "Регистрация", forgot: "Восстановление пароля", reset: "Новый пароль" };

export default function LoginForm({ onSubmit, hint = null, onDemo = null, resetToken = "", api = { register, requestPasswordReset, resetPassword } }) {
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [token] = useState(resetToken);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [visiblePassword, setVisiblePassword] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");

  const changeMode = (next) => { setMode(next); setPassword(""); setConfirmPassword(""); setErrors({}); setMessage(""); };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    const input = { identifier, email, displayName, password, token };
    const invalid = validateAuth(mode, input);
    if ((mode === "register" || mode === "reset") && password !== confirmPassword) invalid.confirmPassword = "Пароли не совпадают.";
    if (Object.keys(invalid).length) { setErrors(invalid); setMessage(""); return; }
    setErrors({}); setMessage(""); setLoading(true);
    try {
      if (mode === "login") await onSubmit({ identifier: normalizeIdentifier(identifier), password });
      else if (mode === "register") { await api.register(input); setPassword(""); setConfirmPassword(""); setMessage("Заявка на регистрацию отправлена."); }
      else if (mode === "forgot") { await api.requestPasswordReset(email); setMessage("Если аккаунт с такой почтой существует, инструкция придёт на почту."); }
      else { await api.resetPassword(token, password); setPassword(""); setConfirmPassword(""); setMessage("Пароль изменён. Теперь можно войти."); }
    } catch (error) {
      const messageText = error?.code === AUTH_ERROR_CODES.invalidCredentials ? "Неверная почта, логин или пароль." : error?.code === AUTH_ERROR_CODES.badRequest ? "Запрос отклонён. Проверьте данные." : "Сервис авторизации сейчас недоступен. Попробуйте позже.";
      setErrors({ form: messageText });
      if (error?.code === AUTH_ERROR_CODES.invalidCredentials) setPassword("");
    } finally { setLoading(false); }
  };
  const field = (name, label, value, setValue, type, autoComplete) => <div>
    <label className="mt-3 block text-xs font-semibold text-stone-600" htmlFor={`auth-${name}`}>{label}</label>
    <div className={type === "password" ? "auth-password-wrap" : undefined}>
    <input id={`auth-${name}`} name={name} type={type === "password" && visiblePassword === name ? "text" : type} autoComplete={autoComplete} value={value} onChange={event => setValue(event.target.value)} disabled={loading} aria-invalid={errors[name] ? "true" : undefined} aria-describedby={errors[name] ? `error-${name}` : undefined} className={`${inputCls} mt-1`} />
    {type === "password" && <button type="button" className="auth-password-reveal" aria-label={`Показать ${label.toLowerCase()}`} onMouseEnter={() => setVisiblePassword(name)} onMouseLeave={() => setVisiblePassword(null)} onFocus={() => setVisiblePassword(name)} onBlur={() => setVisiblePassword(null)}><Eye size={17} aria-hidden="true" /></button>}
    </div>
    {errors[name] && <p id={`error-${name}`} className="auth-field-error">{errors[name]}</p>}
  </div>;
  return <form className={`${cardCls} login-card`} onSubmit={handleSubmit} noValidate aria-busy={loading || undefined}>
    <div className="auth-tabs" aria-label="Авторизация">
      <button type="button" className={mode === "login" ? "auth-tab-active" : ""} aria-pressed={mode === "login"} onClick={() => changeMode("login")}>Вход</button>
      <button type="button" className={mode === "register" ? "auth-tab-active" : ""} aria-pressed={mode === "register"} onClick={() => changeMode("register")}>Регистрация</button>
    </div>
    <h1 className="text-xl font-semibold text-stone-900">{titles[mode]}</h1>
    {mode === "login" && field("identifier", "Почта или логин", identifier, setIdentifier, "text", "username")}
    {(mode === "register" || mode === "forgot") && field("email", "Электронная почта", email, setEmail, "email", "email")}
    {mode === "register" && field("displayName", "Логин для входа и отображения", displayName, setDisplayName, "text", "nickname")}
    {mode !== "forgot" && field("password", "Пароль", password, setPassword, "password", mode === "login" ? "current-password" : "new-password")}
    {(mode === "register" || mode === "reset") && field("confirmPassword", "Повторите пароль", confirmPassword, setConfirmPassword, "password", "new-password")}
    {mode === "login" && <button type="button" className="auth-link" onClick={() => changeMode("forgot")}>Забыли пароль?</button>}
    {errors.form && <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{errors.form}</div>}
    {errors.token && <div role="alert" className="auth-field-error">{errors.token}</div>}
    {message && <p role="status" className="auth-notice">{message}</p>}
    <button type="submit" disabled={loading} className="mt-5 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-950 disabled:cursor-wait disabled:opacity-60">{loading ? "Подождите…" : { login: "Войти", register: "Зарегистрироваться", forgot: "Отправить сообщение", reset: "Сохранить пароль" }[mode]}</button>
    {(mode === "forgot" || mode === "reset") && <button type="button" className="auth-link" onClick={() => changeMode("login")}>Вернуться ко входу</button>}
    {hint && mode === "login" && <p className="mt-3 text-xs text-stone-500">{hint}</p>}
    {onDemo && <div className="login-demo"><p>Регистрация и почтовый сервис пока не подключены.</p><button type="button" onClick={onDemo}>Открыть проект в тестовом режиме</button></div>}
  </form>;
}
