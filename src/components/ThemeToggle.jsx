import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "gpo-theme";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === "dark"; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch { /* Storage is optional. */ }
  }, [dark]);

  return (
    <button type="button" className="theme-toggle" onClick={() => setDark((value) => !value)}
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}>
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>{dark ? "Светлая тема" : "Тёмная тема"}</span>
    </button>
  );
}
