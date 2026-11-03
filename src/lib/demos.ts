import {
  demoPublicUrl,
  listWorkspaceDemos,
  type DemoMeta,
} from "@/lib/demo-workspace";

export type DemoEntry = {
  slug: string;
  title: string;
  niche: string;
  path: string;
  note?: string;
};

export async function getDemoRegistry(): Promise<DemoEntry[]> {
  const list = await listWorkspaceDemos();
  return list.map((d) => toEntry(d));
}

export async function getDemo(slug: string): Promise<DemoEntry | null> {
  const list = await getDemoRegistry();
  return list.find((d) => d.slug === slug) ?? null;
}

export function demoUrl(entry: DemoEntry, origin?: string): string {
  return demoPublicUrl(entry.slug, origin);
}

function toEntry(d: DemoMeta): DemoEntry {
  return {
    slug: d.slug,
    title: d.title,
    niche: d.niche,
    path: `/${d.slug}/`,
    note: d.note,
  };
}
