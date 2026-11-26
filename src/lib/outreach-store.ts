import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type OutreachContactStatus =
  | "pending_enrich"
  | "has_email"
  | "no_email"
  | "sent"
  | "failed"
  | "skipped";

export type OutreachContact = {
  id: string;
  ogrn: string;
  inn?: string;
  name: string;
  shortName?: string;
  url: string;
  email?: string;
  emails: string[];
  phone?: string;
  status: OutreachContactStatus;
  registeredAt?: string;
  scannedAt: string;
  enrichedAt?: string;
  lastSentAt?: string;
  lastError?: string;
};

export type OutreachSendLog = {
  id: string;
  contactId: string;
  to: string;
  /** Фактический адрес доставки (если override / test). */
  deliveredTo?: string;
  companyName?: string;
  subject: string;
  sentAt: string;
  ok: boolean;
  error?: string;
  testMode: boolean;
};

export type OutreachContactFilter =
  | "all"
  | "email"
  | "no_email"
  | "pending"
  | "sent"
  | "failed";

type StoreFile = {
  contacts: OutreachContact[];
  sends: OutreachSendLog[];
  lastScanAt?: string;
  lastEnrichAt?: string;
  lastScanMeta?: {
    from?: string;
    to?: string;
    found?: number;
    added?: number;
    error?: string;
  };
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "outreach.json");

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || !Array.isArray(parsed.contacts)) {
      return { contacts: [], sends: [] };
    }
    return {
      contacts: parsed.contacts,
      sends: Array.isArray(parsed.sends) ? parsed.sends : [],
      lastScanAt: parsed.lastScanAt,
      lastEnrichAt: parsed.lastEnrichAt,
      lastScanMeta: parsed.lastScanMeta,
    };
  } catch {
    return { contacts: [], sends: [] };
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function listOutreachContacts(): Promise<OutreachContact[]> {
  const store = await readStore();
  return store.contacts;
}

function matchContactQuery(c: OutreachContact, q: string): boolean {
  if (!q) return true;
  return `${c.name} ${c.shortName ?? ""} ${c.email ?? ""} ${c.ogrn} ${c.inn ?? ""}`
    .toLowerCase()
    .includes(q);
}

function matchContactFilter(
  c: OutreachContact,
  filter: OutreachContactFilter,
): boolean {
  switch (filter) {
    case "email":
      return Boolean(c.email);
    case "no_email":
      return !c.email || c.status === "no_email";
    case "pending":
      return c.status === "pending_enrich";
    case "sent":
      return c.status === "sent";
    case "failed":
      return c.status === "failed";
    default:
      return true;
  }
}

export async function queryOutreachContacts(options?: {
  q?: string;
  filter?: OutreachContactFilter;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: OutreachContact[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const store = await readStore();
  const q = options?.q?.trim().toLowerCase() || "";
  const filter = options?.filter || "all";
  const pageSize = Math.min(
    100,
    Math.max(1, options?.pageSize ?? 50),
  );
  const page = Math.max(1, options?.page ?? 1);

  const filtered = store.contacts.filter(
    (c) => matchContactFilter(c, filter) && matchContactQuery(c, q),
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export async function getOutreachMeta(): Promise<{
  lastScanAt?: string;
  lastEnrichAt?: string;
  lastScanMeta?: StoreFile["lastScanMeta"];
  counts: {
    all: number;
    withEmail: number;
    pending: number;
    sent: number;
  };
}> {
  const store = await readStore();
  const withEmail = store.contacts.filter((c) => c.email).length;
  return {
    lastScanAt: store.lastScanAt,
    lastEnrichAt: store.lastEnrichAt,
    lastScanMeta: store.lastScanMeta,
    counts: {
      all: store.contacts.length,
      withEmail,
      pending: store.contacts.filter((c) => c.status === "pending_enrich").length,
      sent: store.contacts.filter((c) => c.status === "sent").length,
    },
  };
}

export async function upsertScanResults(
  rows: Array<{
    ogrn: string;
    inn?: string;
    name: string;
    shortName?: string;
    url: string;
    registeredAt?: string;
  }>,
  meta: { from?: string; to?: string },
): Promise<{ added: number; total: number }> {
  const store = await readStore();
  const byOgrn = new Map(store.contacts.map((c) => [c.ogrn, c]));
  let added = 0;
  const scannedAt = nowIso();

  for (const row of rows) {
    const ogrn = row.ogrn.trim();
    if (!ogrn) continue;
    const existing = byOgrn.get(ogrn);
    if (existing) {
      existing.name = row.name || existing.name;
      existing.shortName = row.shortName || existing.shortName;
      existing.url = row.url || existing.url;
      existing.inn = row.inn || existing.inn;
      existing.registeredAt = row.registeredAt || existing.registeredAt;
      continue;
    }
    const contact: OutreachContact = {
      id: randomUUID(),
      ogrn,
      inn: row.inn,
      name: row.name || ogrn,
      shortName: row.shortName,
      url: row.url,
      emails: [],
      status: "pending_enrich",
      registeredAt: row.registeredAt,
      scannedAt,
    };
    store.contacts.unshift(contact);
    byOgrn.set(ogrn, contact);
    added += 1;
  }

  store.lastScanAt = scannedAt;
  store.lastScanMeta = {
    from: meta.from,
    to: meta.to,
    found: rows.length,
    added,
  };
  await writeStore(store);
  return { added, total: store.contacts.length };
}

export async function applyEnrichResults(
  results: Array<{
    ogrn?: string;
    url?: string;
    email?: string;
    emails?: string[];
    phone?: string;
    name?: string;
    shortName?: string;
  }>,
): Promise<{ updated: number; withEmail: number }> {
  const store = await readStore();
  let updated = 0;
  let withEmail = 0;
  const enrichedAt = nowIso();

  for (const result of results) {
    const contact = store.contacts.find((c) => {
      if (result.ogrn && c.ogrn === result.ogrn) return true;
      if (result.url && (c.url === result.url || c.url.includes(result.url))) {
        return true;
      }
      return false;
    });
    if (!contact) continue;

    const emails = (result.emails ?? [])
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const email = (result.email ?? emails[0] ?? "").trim().toLowerCase() || undefined;

    contact.emails = emails.length ? emails : email ? [email] : [];
    contact.email = email;
    contact.phone = result.phone || contact.phone;
    if (result.name) contact.name = result.name;
    if (result.shortName) contact.shortName = result.shortName;
    contact.enrichedAt = enrichedAt;
    contact.status = email ? "has_email" : "no_email";
    contact.lastError = undefined;
    updated += 1;
    if (email) withEmail += 1;
  }

  store.lastEnrichAt = enrichedAt;
  await writeStore(store);
  return { updated, withEmail };
}

export async function listPendingEnrich(limit = 12): Promise<OutreachContact[]> {
  const store = await readStore();
  return store.contacts
    .filter((c) => c.status === "pending_enrich" && c.url)
    .slice(0, Math.max(1, Math.min(limit, 25)));
}

export async function getContactsByIds(ids: string[]): Promise<OutreachContact[]> {
  const set = new Set(ids);
  const store = await readStore();
  return store.contacts.filter((c) => set.has(c.id));
}

export async function markContactsSent(
  contactIds: string[],
  payload: {
    to: string;
    deliveredTo?: string;
    companyName?: string;
    subject: string;
    ok: boolean;
    error?: string;
    testMode: boolean;
  },
): Promise<void> {
  const store = await readStore();
  const set = new Set(contactIds);
  const sentAt = nowIso();

  for (const contact of store.contacts) {
    if (!set.has(contact.id)) continue;
    if (payload.ok) {
      contact.status = "sent";
      contact.lastSentAt = sentAt;
      contact.lastError = undefined;
    } else {
      contact.status = "failed";
      contact.lastError = payload.error || "send failed";
    }
    store.sends.unshift({
      id: randomUUID(),
      contactId: contact.id,
      to: payload.to,
      deliveredTo: payload.deliveredTo,
      companyName:
        payload.companyName || contact.shortName || contact.name,
      subject: payload.subject,
      sentAt,
      ok: payload.ok,
      error: payload.error,
      testMode: payload.testMode,
    });
  }

  store.sends = store.sends.slice(0, 500);
  await writeStore(store);
}

export async function listRecentSends(limit = 50): Promise<OutreachSendLog[]> {
  const store = await readStore();
  return store.sends.slice(0, limit);
}

export async function getContactById(
  id: string,
): Promise<OutreachContact | undefined> {
  const store = await readStore();
  return store.contacts.find((c) => c.id === id);
}
