import { execFile, spawn, type ChildProcess } from "child_process";
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

type Pm2Proc = {
  name?: string;
  pid?: number;
  pm2_env?: {
    status?: string;
    pm_uptime?: number;
    PORT?: string | number;
    pm_err_log_path?: string;
    env?: { PORT?: string | number };
  };
};

type LiveProc = {
  child: ChildProcess;
  port: number;
  startedAt: string;
  status: DemoStatus;
  error: string | null;
};

type PersistedRow = {
  slug: string;
  port: number;
  pid: number;
  startedAt: string;
};

const PORT_MIN = 4100;
const PORT_MAX = 4199;
const STATE_FILE = path.join(process.cwd(), "data", "demo-runtime.json");
const live = new Map<string, LiveProc>();
let hydrated = false;
let pm2Cached: boolean | null = null;

function pm2Bin(): string {
  return process.platform === "win32" ? "pm2.cmd" : "pm2";
}

function pm2Path(): string {
  const current = process.env.PATH ? process.env.PATH.split(path.delimiter) : [];
  const extra =
    process.platform === "win32" ? [] : ["/usr/local/bin", "/usr/bin"];
  return [...current, ...extra]
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .join(path.delimiter);
}

function pm2Env(extra?: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: pm2Path(),
    NODE_ENV: process.env.NODE_ENV || "production",
  };
  for (const key of ["HOME", "USER", "PM2_HOME", "LANG", "LC_ALL"] as const) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  if (!env.HOME && process.platform !== "win32") env.HOME = "/root";
  if (extra) Object.assign(env, extra);
  return env;
}

function pm2Name(slug: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(slug)) {
    throw new Error("Некорректное имя демо");
  }
  return `demo-${slug}`;
}

function assertScript(script: string): string {
  if (!/^[a-zA-Z0-9:_-]{1,40}$/.test(script)) {
    throw new Error("Некорректный npm-скрипт");
  }
  return script;
}

function runPm2(
  args: string[],
  extra?: Record<string, string>,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      pm2Bin(),
      args,
      {
        env: pm2Env(extra),
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 8 * 1024 * 1024,
        shell: process.platform === "win32",
      },
      (err, stdout, stderr) => {
        if (err) {
          const text = `${stderr || stdout || err.message}`.trim();
          reject(new Error(text || "pm2 завершился с ошибкой"));
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

async function pm2Available(): Promise<boolean> {
  if (pm2Cached !== null) return pm2Cached;
  try {
    await runPm2(["-v"]);
    pm2Cached = true;
  } catch {
    pm2Cached = false;
  }
  return pm2Cached;
}

async function pm2List(): Promise<Pm2Proc[]> {
  if (!(await pm2Available())) return [];
  try {
    const { stdout } = await runPm2(["jlist"]);
    const start = stdout.indexOf("[");
    if (start < 0) return [];
    const parsed = JSON.parse(stdout.slice(start)) as Pm2Proc[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findProc(list: Pm2Proc[], slug: string): Pm2Proc | undefined {
  return list.find((proc) => proc.name === pm2Name(slug));
}

function portOf(proc: Pm2Proc | undefined): number | null {
  const raw = proc?.pm2_env?.PORT ?? proc?.pm2_env?.env?.PORT;
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 ? port : null;
}

function mapPm2Status(proc: Pm2Proc | undefined): DemoStatus {
  const status = proc?.pm2_env?.status;
  if (!proc || status === "stopped" || status === "stopping") return "stopped";
  if (status === "online") return "running";
  if (status === "launching" || status === "waiting restart") return "starting";
  if (status === "errored") return "error";
  return "stopped";
}

function isPidAlive(pid: number): boolean {
  if (!pid || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
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

async function findFreePort(usedExtra: number[] = []): Promise<number> {
  const used = new Set(usedExtra);
  for (const proc of live.values()) used.add(proc.port);
  for (const proc of await pm2List()) {
    const port = portOf(proc);
    if (port) used.add(port);
  }
  for (let port = PORT_MIN; port <= PORT_MAX; port++) {
    if (used.has(port)) continue;
    if (!(await canConnect(port))) return port;
  }
  throw new Error("Нет свободных портов 4100–4199");
}

async function waitForPort(port: number, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await canConnect(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
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
  await writeFile(STATE_FILE, JSON.stringify({ processes }, null, 2), "utf8");
}

async function hydrateFromDisk() {
  if (hydrated) return;
  hydrated = true;
  const rows = await loadPersisted();
  for (const row of rows) {
    if (live.has(row.slug)) continue;
    if (!isPidAlive(row.pid)) continue;
    if (!(await canConnect(row.port))) continue;
    live.set(row.slug, {
      child: { pid: row.pid } as ChildProcess,
      port: row.port,
      startedAt: row.startedAt,
      status: "running",
      error: null,
    });
  }
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

async function pm2Delete(name: string): Promise<void> {
  if (!(await pm2Available())) return;
  try {
    await runPm2(["delete", name]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/not found|doesn't exist|does not exist|ENOENT/i.test(message)) {
      throw err;
    }
  }
}

async function pm2Save(): Promise<void> {
  if (!(await pm2Available())) return;
  try {
    await runPm2(["save"]);
  } catch {
    /* ignore save errors in local fallback mode */
  }
}

async function errorTail(proc: Pm2Proc | undefined): Promise<string> {
  const file = proc?.pm2_env?.pm_err_log_path;
  if (!file) return "";
  try {
    const text = await readFile(file, "utf8");
    return text.trim().slice(-400);
  } catch {
    return "";
  }
}

function toLocalRuntime(meta: DemoMeta): DemoRuntime {
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

function toPm2Runtime(meta: DemoMeta, proc: Pm2Proc | undefined): DemoRuntime {
  const status = mapPm2Status(proc);
  const uptime = proc?.pm2_env?.pm_uptime;
  return {
    slug: meta.slug,
    status,
    port: status === "stopped" ? null : portOf(proc),
    pid: status === "stopped" ? null : proc?.pid ?? null,
    startedAt:
      status !== "stopped" && uptime ? new Date(uptime).toISOString() : null,
    error: status === "error" ? "PM2 не смог удержать процесс" : null,
    url: demoPublicUrl(meta.slug),
  };
}

export async function listDemoRuntimes(): Promise<
  (DemoMeta & DemoRuntime)[]
> {
  await hydrateFromDisk();
  const [demos, procs] = await Promise.all([
    listWorkspaceDemos(),
    pm2List(),
  ]);
  return demos.map((meta) => {
    const local = live.get(meta.slug);
    if (local) return { ...meta, ...toLocalRuntime(meta) };
    return { ...meta, ...toPm2Runtime(meta, findProc(procs, meta.slug)) };
  });
}

export async function getDemoRuntime(
  slug: string,
): Promise<(DemoMeta & DemoRuntime) | null> {
  await hydrateFromDisk();
  const meta = await getWorkspaceDemo(slug);
  if (!meta) return null;
  if (live.has(slug)) return { ...meta, ...toLocalRuntime(meta) };
  const proc = findProc(await pm2List(), slug);
  return { ...meta, ...toPm2Runtime(meta, proc) };
}

export async function getRunningPort(slug: string): Promise<number | null> {
  await hydrateFromDisk();
  const local = live.get(slug);
  if (local) {
    if (local.status === "error" || local.status === "stopped") return null;
    if (local.child.pid && !isPidAlive(local.child.pid)) {
      if (await canConnect(local.port)) return local.port;
      live.delete(slug);
      void savePersisted();
      return null;
    }
    return local.port;
  }

  const proc = findProc(await pm2List(), slug);
  const status = mapPm2Status(proc);
  if (status !== "running" && status !== "starting") return null;
  return portOf(proc);
}

async function startWithPm2(
  meta: DemoMeta,
  script: string,
): Promise<DemoMeta & DemoRuntime> {
  const name = pm2Name(meta.slug);
  const existing = findProc(await pm2List(), meta.slug);
  const existingPort = portOf(existing);
  if (
    mapPm2Status(existing) === "running" &&
    existingPort &&
    (await canConnect(existingPort))
  ) {
    return { ...meta, ...toPm2Runtime(meta, existing) };
  }

  if (existing) await pm2Delete(name);

  const port = await findFreePort();
  await runPm2(
    [
      "start",
      "npm",
      "--name",
      name,
      "--cwd",
      meta.dir,
      "--update-env",
      "--",
      "run",
      script,
    ],
    { PORT: String(port), HOST: "127.0.0.1" },
  );

  const ready = await waitForPort(port, 20_000);
  if (!ready) {
    const failed = findProc(await pm2List(), meta.slug);
    const tail = await errorTail(failed);
    await pm2Delete(name);
    await pm2Save();
    throw new Error(
      tail
        ? `Не поднялся порт ${port}: ${tail}`
        : `Не поднялся порт ${port} за 20с`,
    );
  }

  await pm2Save();
  const proc = findProc(await pm2List(), meta.slug);
  return { ...meta, ...toPm2Runtime(meta, proc) };
}

async function startLocal(
  meta: DemoMeta,
  script: string,
): Promise<DemoMeta & DemoRuntime> {
  await hydrateFromDisk();
  const existing = live.get(meta.slug);
  if (existing && (existing.status === "running" || existing.status === "starting")) {
    if (existing.child.pid && isPidAlive(existing.child.pid)) {
      return { ...meta, ...toLocalRuntime(meta) };
    }
    live.delete(meta.slug);
  }

  const port = await findFreePort();
  const startedAt = new Date().toISOString();
  const child = spawn("npm", ["run", script], {
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
  live.set(meta.slug, entry);

  let stderr = "";
  child.stderr?.on("data", (buf: Buffer) => {
    stderr += buf.toString("utf8").slice(-2000);
  });
  child.stdout?.on("data", () => {
    /* drain */
  });

  child.on("exit", (code) => {
    const cur = live.get(meta.slug);
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
    live.delete(meta.slug);
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
  return { ...meta, ...toLocalRuntime(meta) };
}

export async function startDemo(
  slug: string,
): Promise<DemoMeta & DemoRuntime> {
  const meta = await getWorkspaceDemo(slug);
  if (!meta) throw new Error("Демо не найдено");
  if (!meta.hasPackageJson) {
    throw new Error("Нужен package.json со скриптом start");
  }
  const script = assertScript(meta.script);

  if (await pm2Available()) {
    return startWithPm2(meta, script);
  }
  return startLocal(meta, script);
}

export async function stopDemo(
  slug: string,
): Promise<DemoMeta & DemoRuntime> {
  await hydrateFromDisk();
  const meta = await getWorkspaceDemo(slug);
  if (!meta) throw new Error("Демо не найдено");

  const local = live.get(slug);
  if (local) {
    const pid = local.child.pid;
    if (pid) killPid(pid);
    live.delete(slug);
    await savePersisted();
  } else {
    const rows = await loadPersisted();
    const row = rows.find((item) => item.slug === slug);
    if (row?.pid) killPid(row.pid);
    await savePersisted();
  }

  if (await pm2Available()) {
    await pm2Delete(pm2Name(slug));
    await pm2Save();
  }

  return { ...meta, ...toLocalRuntime(meta) };
}

/** Resolve proxy target for a running demo. */
export async function resolveDemoTarget(
  slug: string,
): Promise<{ port: number } | { error: string; status: number }> {
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
