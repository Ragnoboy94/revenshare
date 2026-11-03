import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type LeadStatus = "new" | "in_progress" | "done";

export type Lead = {
  id: string;
  createdAt: string;
  name: string;
  contact: string;
  niche: string;
  comment: string;
  status: LeadStatus;
};

type StoreFile = {
  leads: Lead[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || !Array.isArray(parsed.leads)) return { leads: [] };
    return parsed;
  } catch {
    return { leads: [] };
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function addLead(input: {
  name: string;
  contact: string;
  niche: string;
  comment: string;
}): Promise<Lead> {
  const store = await readStore();
  const lead: Lead = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    name: input.name,
    contact: input.contact,
    niche: input.niche,
    comment: input.comment,
    status: "new",
  };
  store.leads.unshift(lead);
  await writeStore(store);
  return lead;
}

export async function listLeads(): Promise<Lead[]> {
  const store = await readStore();
  return store.leads;
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<Lead | null> {
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === id);
  if (!lead) return null;
  lead.status = status;
  await writeStore(store);
  return lead;
}
