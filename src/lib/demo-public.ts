import type { DemoMeta } from "@/lib/demo-workspace";
import type { DemoRuntime } from "@/lib/demo-runner";

/** Safe payload for admin UI / API (no absolute paths). */
export type DemoPublic = {
  slug: string;
  title: string;
  niche: string;
  note?: string;
  status: DemoRuntime["status"];
  port: number | null;
  pid: number | null;
  startedAt: string | null;
  error: string | null;
  url: string;
};

export function toDemoPublic(
  row: DemoMeta & DemoRuntime,
): DemoPublic {
  return {
    slug: row.slug,
    title: row.title,
    niche: row.niche,
    note: row.note,
    status: row.status,
    port: row.port,
    pid: row.pid,
    startedAt: row.startedAt,
    error: row.error,
    url: row.url,
  };
}
