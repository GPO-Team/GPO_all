export const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
export const validEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email || email.length > 254) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..") || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every(label => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
};
export const normalizeIdentifier = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.includes("@") ? normalizeEmail(trimmed) : trimmed;
};
export const validDisplayName = (value) => typeof value === "string" && /^[\p{L}\p{N}_.-]{2,64}$/u.test(value.trim());
export const validIdentifier = (value) => {
  const identifier = normalizeIdentifier(value);
  return identifier.includes("@") ? validEmail(identifier) : validDisplayName(identifier);
};
export const validPassword = (value) => typeof value === "string" && [...value].length >= 8 && new TextEncoder().encode(value).length <= 1024;
export const validateAuth = (kind, body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { form: "Некорректные данные." };
  const errors = {};
  if (kind === "login" && !validIdentifier(body.identifier)) errors.identifier = "Введите почту или логин: от 2 до 64 букв и цифр, можно использовать . _ -";
  if ((kind === "register" || kind === "forgot") && !validEmail(body.email)) errors.email = "Введите корректную электронную почту.";
  if (kind === "register" && !validDisplayName(body.displayName)) errors.displayName = "Логин: от 2 до 64 букв и цифр, можно использовать . _ -";
  if (kind === "login" && (typeof body.password !== "string" || !body.password || new TextEncoder().encode(body.password).length > 1024)) errors.password = "Введите пароль.";
  if ((kind === "register" || kind === "reset") && !validPassword(body.password)) errors.password = "Пароль должен содержать от 8 символов и не более 1024 байт.";
  if (kind === "reset" && (typeof body.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.token))) errors.token = "Ссылка восстановления недействительна.";
  return errors;
};
