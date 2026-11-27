import fs from "fs";
import path from "path";

/** Единый путь к браузерам Playwright — в папке проекта, не в профиле/sandbox. */
export function playwrightBrowsersPath(): string {
  const projectPath = path.join(process.cwd(), ".playwright-browsers");
  const fromEnv = process.env.PLAYWRIGHT_BROWSERS_PATH?.trim();
  // Cursor sandbox cache часто пустой/битый — не доверяем ему.
  if (fromEnv && /cursor-sandbox-cache/i.test(fromEnv)) {
    return projectPath;
  }
  // Если в проекте уже стоит chromium — всегда его (стабильнее для Next/admin).
  if (fs.existsSync(projectPath)) {
    return projectPath;
  }
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }
  return projectPath;
}

/** Есть ли реально запускаемый chromium (не просто папка). */
export function resolvePlaywrightChromePath(
  browsersPath = playwrightBrowsersPath(),
): string | undefined {
  const candidates: string[] = [];
  try {
    for (const entry of fs.readdirSync(browsersPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("chromium-")) {
        candidates.push(
          path.join(browsersPath, entry.name, "chrome-win64", "chrome.exe"),
          path.join(browsersPath, entry.name, "chrome-linux64", "chrome"),
        );
      }
      if (entry.name.startsWith("chromium_headless_shell-")) {
        candidates.push(
          path.join(
            browsersPath,
            entry.name,
            "chrome-headless-shell-win64",
            "chrome-headless-shell.exe",
          ),
          path.join(
            browsersPath,
            entry.name,
            "chrome-headless-shell-linux64",
            "chrome-headless-shell",
          ),
        );
      }
    }
  } catch {
    /* empty / missing */
  }
  return candidates.find((p) => fs.existsSync(p));
}

export function playwrightBrowsersInstalled(): boolean {
  if (process.env.OUTREACH_CHECKO_CHANNEL?.trim()) return true;
  return Boolean(resolvePlaywrightChromePath());
}

/** Выставить env до import('playwright') / launch. */
export function ensurePlaywrightBrowsersEnv(): string {
  const browsersPath = playwrightBrowsersPath();
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
  return browsersPath;
}

export function playwrightEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath(),
  };
}
