import { existsSync } from "fs";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";

export type DemoMeta = {
  slug: string;
  title: string;
  niche: string;
  note?: string;
  /** npm script to run (default: start) */
  script: string;
  dir: string;
  hasPackageJson: boolean;
};

type DemoJson = {
  title?: string;
  niche?: string;
  note?: string;
  script?: string;
};

export function demoWorkspaceRoot(): string {
  const fromEnv = process.env.DEMO_WORKSPACE?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }
  return path.join(process.cwd(), "demo-workspace");
}

export function demoPublicUrl(slug: string, origin?: string): string {
  const demoHost = process.env.NEXT_PUBLIC_DEMO_HOST ?? "demo.localhost";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3040";
  let base = origin;
  if (!base) {
    try {
      const u = new URL(site);
      const port = u.port ? `:${u.port}` : "";
      base = `${u.protocol}//${demoHost}${port}`;
    } catch {
      base = `http://${demoHost}:3040`;
    }
  }
  return `${base.replace(/\/$/, "")}/${slug}/`;
}

export async function listWorkspaceDemos(): Promise<DemoMeta[]> {
  const root = demoWorkspaceRoot();
  if (!existsSync(root)) return [];

  const names = await readdir(root);
  const out: DemoMeta[] = [];

  for (const name of names) {
    if (name.startsWith(".") || name === "README.md") continue;
    const dir = path.join(root, name);
    const st = await stat(dir).catch(() => null);
    if (!st?.isDirectory()) continue;

    const pkgPath = path.join(dir, "package.json");
    const hasPackageJson = existsSync(pkgPath);
    if (!hasPackageJson && !existsSync(path.join(dir, "index.html"))) {
      continue;
    }

    let meta: DemoJson = {};
    const metaPath = path.join(dir, "demo.json");
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(await readFile(metaPath, "utf8")) as DemoJson;
      } catch {
        meta = {};
      }
    }

    if (!meta.title && hasPackageJson) {
      try {
        const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
          name?: string;
        };
        if (pkg.name) meta.title = pkg.name;
      } catch {
        /* ignore */
      }
    }

    out.push({
      slug: name,
      title: meta.title?.trim() || name,
      niche: meta.niche?.trim() || "",
      note: meta.note?.trim() || undefined,
      script: meta.script?.trim() || "start",
      dir,
      hasPackageJson,
    });
  }

  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function getWorkspaceDemo(
  slug: string,
): Promise<DemoMeta | null> {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(slug)) return null;
  const list = await listWorkspaceDemos();
  return list.find((d) => d.slug === slug) ?? null;
}
