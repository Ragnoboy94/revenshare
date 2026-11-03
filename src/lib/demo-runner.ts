import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import net from "net";
import path from "path";
import {
  demoPublicUrl,
  demoWorkspaceRoot,
  getWorkspaceDemo,
  listWorkspaceDemos,
  type DemoMeta,
} from "@/lib/demo-workspace";

export type DemoStatus = "stopped" | "starting" | "running" | "error";

export type DemoRuntime = {
  slug: string;
  status: DemoStatus;
  port: number | null;
  pid: number | null;
  startedAt: string | null;
  error: string | null;
  url: string;
};

type PersistedRow = {
  slug: string;
  port: number;
  pid: number;
  startedAt: string;
};

type LiveProc = {
  child: ChildProcess;
  port: number;
  startedAt: string;
  status: DemoStatus;
  error: string | null;
};

const PORT_MIN = 4100;
const PORT_MAX = 4199;
const STATE_FILE = path.join(process.cwd(), "data", "demo-runtime.json");

const live = new Map<string, LiveProc>();
let hydrated = false;

function isPidAlive(pid: number): boolean {
  if (!pid || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function ensureDataDir() {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
}

async function loadPersisted(): Promise<PersistedRow[]> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as { processes?: PersistedRow[] };
    return Array.isArray(parsed.processes) ? parsed.processes : [];
  } catch {
    return [];
  }
}

async function savePersisted() {
  await ensureDataDir();
  const processes: PersistedRow[] = [];
  for (const [slug, proc] of live) {
    if (proc.child.pid && (proc.status === "running" || proc.status === "starting")) {
      processes.push({
        slug,
        port: proc.port,
        pid: proc.child.pid,
        startedAt: proc.startedAt,
      });
    }
  }
  await writeFile(
    STATE_FILE,
    JSON.stringify({ processes }, null, 2),
    "utf8",
  );
}

async function hydrateFromDisk() {
  if (hydrated) return;
  hydrated = true;
  const rows = await loadPersisted();
  for (const row of rows) {
    if (live.has(row.slug)) continue;
    if (!isPidAlive(row.pid)) continue;
    // Adopt only port/pid bookkeeping — child handle is gone after restart.
    // Mark as running if port answers; otherwise clear.
    const up = await canConnect(row.port);
    if (!up) continue;
    live.set(row.slug, {
      child: { pid: row.pid } as ChildProcess,
      port: row.port,
      startedAt: row.startedAt,
      status: "running",
      error: null,
    });
  }
}

function canConnect(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(400, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function findFreePort(): Promise<number> {
  const used = new Set(
    [...live.values()].map((p) => p.port).filter(Boolean),
  );
  for (let port = PORT_MIN; port <= PORT_MAX; port++) {
    if (used.has(port)) continue;
    const busy = await canConnect(port);
    if (!busy) return port;
  }
  throw new Error("Нет свободных портов 4100–4199");
}

function killPid(pid: number) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      process.kill(-pid, "SIGTERM");
    }
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* ignore */
    }
  }
}

function toRuntime(meta: DemoMeta): DemoRuntime {
  const proc = live.get(meta.slug);
  if (!proc) {
    return {
      slug: meta.slug,
      status: "stopped",
      port: null,
      pid: null,
      startedAt: null,
      error: null,
      url: demoPublicUrl(meta.slug),
    };
  }

  const pid = proc.child.pid ?? null;
  if (proc.status === "running" && pid && !isPidAlive(pid)) {
    live.delete(meta.slug);
    void savePersisted();
    return {
      slug: meta.slug,
      status: "stopped",
      port: null,
      pid: null,
      startedAt: null,
      error: null,
      url: demoPublicUrl(meta.slug),
    };
  }

  return {
    slug: meta.slug,
    status: proc.status,
    port: proc.port,
    pid,
    startedAt: proc.startedAt,
    error: proc.error,
    url: demoPublicUrl(meta.slug),
  };
}

export async function listDemoRuntimes(): Promise<
  (DemoMeta & DemoRuntime)[]
> {
  await hydrateFromDisk();
  const demos = await listWorkspaceDemos();
  return demos.map((meta) => ({ ...meta, ...toRuntime(meta) }));
}

export async function getDemoRuntime(
  slug: string,
): Promise<(DemoMeta & DemoRuntime) | null> {
  await hydrateFromDisk();
  const meta = await getWorkspaceDemo(slug);
  if (!meta) return null;
  return { ...meta, ...toRuntime(meta) };
}

export async function getRunningPort(slug: string): Promise<number | null> {
  await hydrateFromDisk();
  const proc = live.get(slug);
  if (!proc || proc.status === "error" || proc.status === "stopped") {
    return null;
  }
  if (proc.child.pid && !isPidAlive(proc.child.pid)) {
    // Orphaned bookkeeping after server restart — still allow proxy if port up
    if (await canConnect(proc.port)) return proc.port;
    live.delete(slug);
    void savePersisted();
    return null;
  }
  return proc.port;
}

export async function startDemo(
  slug: string,
): Promise<DemoMeta & DemoRuntime> {
  await hydrateFromDisk();
  const meta = await getWorkspaceDemo(slug);
  if (!meta) throw new Error("Демо не найдено");
  if (!meta.hasPackageJson) {
    throw new Error("Нужен package.json со скриптом start");
  }

  const existing = live.get(slug);
  if (existing && (existing.status === "running" || existing.status === "starting")) {
    if (existing.child.pid && isPidAlive(existing.child.pid)) {
      return { ...meta, ...toRuntime(meta) };
    }
    live.delete(slug);
  }

  const port = await findFreePort();
  const startedAt = new Date().toISOString();
  // Windows: spawning npm.cmd without shell → EINVAL on Node 20+
  const child = spawn("npm", ["run", meta.script], {
    cwd: meta.dir,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
    },
    stdio: "pipe",
    shell: true,
    windowsHide: true,
    detached: process.platform !== "win32",
  });

  const entry: LiveProc = {
    child,
    port,
    startedAt,
    status: "starting",
    error: null,
  };
  live.set(slug, entry);

  let stderr = "";
  child.stderr?.on("data", (buf: Buffer) => {
    stderr += buf.toString("utf8").slice(-2000);
  });
  child.stdout?.on("data", () => {
    /* drain */
  });

  child.on("exit", (code) => {
    const cur = live.get(slug);
    if (cur?.child !== child) return;
    if (cur.status === "starting" || cur.status === "running") {
      cur.status = "error";
      cur.error =
        code === 0
          ? "Процесс завершился"
          : `Exit ${code}${stderr ? `: ${stderr.trim().slice(-400)}` : ""}`;
    }
    void savePersisted();
  });

  const ready = await waitForPort(port, 20_000);
  if (!ready) {
    killPid(child.pid ?? 0);
    live.delete(slug);
    await savePersisted();
    throw new Error(
      stderr.trim()
        ? `Не поднялся порт ${port}: ${stderr.trim().slice(-400)}`
        : `Не поднялся порт ${port} за 20с`,
    );
  }

  entry.status = "running";
  entry.error = null;
  await savePersisted();
  return { ...meta, ...toRuntime(meta) };
}

async function waitForPort(port: number, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await canConnect(port)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

export async function stopDemo(
  slug: string,
): Promise<DemoMeta & DemoRuntime> {
  await hydrateFromDisk();
  const meta = await getWorkspaceDemo(slug);
  if (!meta) throw new Error("Демо не найдено");

  const proc = live.get(slug);
  if (proc) {
    const pid = proc.child.pid;
    if (pid) killPid(pid);
    // Also try persisted pid if child was adopted
    live.delete(slug);
    await savePersisted();
  } else {
    const rows = await loadPersisted();
    const row = rows.find((r) => r.slug === slug);
    if (row?.pid) killPid(row.pid);
    await savePersisted();
  }

  return { ...meta, ...toRuntime(meta) };
}

/** Resolve proxy target for a running demo. */
export async function resolveDemoTarget(
  slug: string,
): Promise<{ port: number } | { error: string; status: number }> {
  await hydrateFromDisk();
  const meta = await getWorkspaceDemo(slug);
  if (!meta) return { error: "Демо не найдено", status: 404 };

  const port = await getRunningPort(slug);
  if (!port) {
    return {
      error: `Демо «${slug}» не запущено. Старт в админке RevenShare.`,
      status: 503,
    };
  }
  return { port };
}

export function workspaceExists(): boolean {
  return existsSync(demoWorkspaceRoot());
}
