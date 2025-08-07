import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";

function getInitialTheme(): "dark" | "light" {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() => getInitialTheme());
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === "dark";
    root.classList.toggle("dark", isDark);
    localStorage.setItem("theme", theme);
  }, [theme]);

  function startViewTransition(x: number, y: number, next: () => void) {
    const root = document.documentElement as any;
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    // Apply transition name to the whole document so the color wave reveals across the page
    root.classList.add("theme-transition");
    const docAny = document as unknown as { startViewTransition?: (cb: () => void) => void };
    if (docAny.startViewTransition) {
      docAny.startViewTransition(() => {
        next();
      });
      // Remove the helper class after the next animation frame to keep layout clean
      requestAnimationFrame(() => {
        setTimeout(() => root.classList.remove("theme-transition"), 0);
      });
    } else {
      next();
      root.classList.remove("theme-transition");
    }
  }

  function handleToggle(ev: React.MouseEvent<HTMLButtonElement>) {
    const x = ev.clientX;
    const y = ev.clientY;
    startViewTransition(x, y, () => {
      setTheme((t) => (t === "dark" ? "light" : "dark"));
    });
  }

  const isDark = theme === "dark";

  return (
    <button
      ref={buttonRef}
      onClick={handleToggle}
      aria-label="Toggle theme"
      className={`theme-transition relative inline-flex h-8 w-14 items-center rounded-full border border-border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-secondary dark:bg-primary`}
      style={{ boxShadow: "var(--shadow)" }}
    >
      <span
        className={`absolute left-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-card text-foreground transition-all duration-300`}
        style={{
          transform: isDark ? "translateX(24px)" : "translateX(0)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {isDark ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </span>
    </button>
  );
}

