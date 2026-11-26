import { createHmac, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
function outreachPublicBaseUrl(): string {
  const raw =
    process.env.OUTREACH_SITE_URL?.trim() ||
    "https://revenshare.ru";
  return raw.replace(/\/$/, "");
}

export type OutreachUnsubRecord = {
  id: string;
  email: string;
  companyName?: string;
  unsubscribedAt: string;
};

const DATA_FILE = path.join(process.cwd(), "data", "outreach-unsubscribed.json");

function getSecret(): string {
  return (
    process.env.OUTREACH_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    "outreach-unsub-dev-secret"
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function readUnsubRecords(): Promise<OutreachUnsubRecord[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as OutreachUnsubRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeUnsubRecords(records: OutreachUnsubRecord[]): Promise<void> {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export async function isUnsubscribed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const records = await readUnsubRecords();
  return records.some((item) => item.email === normalized);
}

export function createUnsubscribeToken(
  email: string,
  companyName?: string,
): string {
  const payload = {
    email: normalizeEmail(email),
    companyName: companyName?.trim() || undefined,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyUnsubscribeToken(
  token: string,
): { email: string; companyName?: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as { email?: string; companyName?: string };
    if (!parsed.email) return null;
    return {
      email: normalizeEmail(parsed.email),
      companyName: parsed.companyName,
    };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(
  email: string,
  companyName?: string,
): string {
  const token = createUnsubscribeToken(email, companyName);
  return `${outreachPublicBaseUrl()}/outreach/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function addUnsubscribe(
  email: string,
  companyName?: string,
): Promise<OutreachUnsubRecord> {
  const normalized = normalizeEmail(email);
  const records = await readUnsubRecords();
  const existing = records.find((item) => item.email === normalized);
  if (existing) return existing;

  const record: OutreachUnsubRecord = {
    id: randomUUID(),
    email: normalized,
    companyName: companyName?.trim() || undefined,
    unsubscribedAt: new Date().toISOString(),
  };
  records.unshift(record);
  await writeUnsubRecords(records.slice(0, 5000));
  return record;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
