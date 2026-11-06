import { execFile } from "child_process";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
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

const PORT_MIN = 4100;
const PORT_MAX = 4199;

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

/** Only demo-* processes. Never parovoz, the site, or the webhook listener. */
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
          reject(
            new Error(
              /ENOENT/.test(text)
                ? "На сервере не найден pm2"
                : text || "pm2 завершился с ошибкой",
            ),
          );
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

async function pm2List(): Promise<Pm2Proc[]> {
  const { stdout } = await runPm2(["jlist"]);
  const start = stdout.indexOf("[");
  if (start < 0) return [];
  const parsed = JSON.parse(stdout.slice(start)) as Pm2Proc[];
  return Array.isArray(parsed) ? parsed : [];
}

function findProc(list: Pm2Proc[], slug: string): Pm2Proc | undefined {
  const name = pm2Name(slug);
  return list.find((proc) => proc.name === name);
}

function portOf(proc: Pm2Proc | undefined): number | null {
  const raw = proc?.pm2_env?.PORT ?? proc?.pm2_env?.env?.PORT;
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 ? port : null;
}

function mapStatus(proc: Pm2Proc | undefined): DemoStatus {
  const status = proc?.pm2_env?.status;
  if (!proc || status === "stopped" || status === "stopping") return "stopped";
  if (status === "online") return "running";
  if (status === "launching" || status === "waiting restart") return "starting";
  if (status === "errored") return "error";
  return "stopped";
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

async function findFreePort(list: Pm2Proc[]): Promise<number> {
  const used = new Set(
    list.map((proc) => portOf(proc)).filter((port): port is number => port !== null),
  );
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

async function pm2Delete(name: string): Promise<void> {
  try {
    await runPm2(["delete", name]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/not found|doesn't exist|does not exist/i.test(message)) throw err;
  }
}

async function pm2Save(): Promise<void> {
  await runPm2(["save"]);
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

function toRuntime(meta: DemoMeta, proc: Pm2Proc | undefined): DemoRuntime {
  const status = mapStatus(proc);
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
  const [demos, procs] = await Promise.all([
    listWorkspaceDemos(),
    pm2List(),
  ]);
  return demos.map((meta) => ({ ...meta, ...toRuntime(meta, findProc(procs, meta.slug)) }));
}

export async function getDemoRuntime(
  slug: string,
): Promise<(DemoMeta & DemoRuntime) | null> {
  const meta = await getWorkspaceDemo(slug);
  if (!meta) return null;
  const proc = findProc(await pm2List(), slug);
  return { ...meta, ...toRuntime(meta, proc) };
}

export async function getRunningPort(slug: string): Promise<number | null> {
  const proc = findProc(await pm2List(), slug);
  if (mapStatus(proc) !== "running" && mapStatus(proc) !== "starting") return null;
  return portOf(proc);
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
  const name = pm2Name(slug);

  const existing = findProc(await pm2List(), slug);
  const existingPort = portOf(existing);
  if (
    mapStatus(existing) === "running" &&
    existingPort &&
    (await canConnect(existingPort))
  ) {
    return { ...meta, ...toRuntime(meta, existing) };
  }

  if (existing) await pm2Delete(name);

  const port = await findFreePort(await pm2List());
  await runPm2(
    ["start", "npm", "--name", name, "--cwd", meta.dir, "--update-env", "--", "run", script],
    { PORT: String(port), HOST: "127.0.0.1" },
  );

  const ready = await waitForPort(port, 20_000);
  if (!ready) {
    const failed = findProc(await pm2List(), slug);
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
  const proc = findProc(await pm2List(), slug);
  return { ...meta, ...toRuntime(meta, proc) };
}

export async function stopDemo(
  slug: string,
): Promise<DemoMeta & DemoRuntime> {
  const meta = await getWorkspaceDemo(slug);
  if (!meta) throw new Error("Демо не найдено");
  await pm2Delete(pm2Name(slug));
  await pm2Save();
  return { ...meta, ...toRuntime(meta, undefined) };
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
