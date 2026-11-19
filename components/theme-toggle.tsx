"use client";

import { useEffect, useState } from "react";
import { Moon, Palette, Sun } from "lucide-react";
import styles from "./theme-toggle.module.css";

type Theme = "dark" | "light" | "clean";

const THEME_KEY = "smart-crm-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const resolvedTheme: Theme = savedTheme === "light" || savedTheme === "clean" ? savedTheme : "dark";
    setTheme(resolvedTheme);
    document.documentElement.dataset.theme = resolvedTheme;
  }, []);

  function updateTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(THEME_KEY, nextTheme);
  }

  return (
    <div className={styles.toggleGroup} aria-label="Theme switcher">
      <button
        type="button"
        className={theme === "dark" ? styles.active : ""}
        onClick={() => updateTheme("dark")}
        aria-pressed={theme === "dark"}
      >
        <Moon size={16} strokeWidth={2} aria-hidden="true" />
        <span>Dark</span>
      </button>
      <button
        type="button"
        className={theme === "clean" ? styles.active : ""}
        onClick={() => updateTheme("clean")}
        aria-pressed={theme === "clean"}
      >
        <Palette size={16} strokeWidth={2} aria-hidden="true" />
        <span>Clean</span>
      </button>
      <button
        type="button"
        className={theme === "light" ? styles.active : ""}
        onClick={() => updateTheme("light")}
        aria-pressed={theme === "light"}
      >
        <Sun size={16} strokeWidth={2} aria-hidden="true" />
        <span>Light</span>
      </button>
    </div>
  );
}
