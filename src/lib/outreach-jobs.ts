import {
  getNewRegistrationsRange,
  ruDateToIso,
  scanCheckoNewRegistrations,
  enrichCheckoCompanyEmails,
} from "@/lib/outreach/checko";
import { getOutreachConfig } from "@/lib/outreach-config";
import {
  applyEnrichResults,
  listPendingEnrich,
  upsertScanResults,
} from "@/lib/outreach-store";

export async function runOutreachScan(options?: {
  maxItems?: number;
  maxPages?: number;
}): Promise<{
  ok: boolean;
  added: number;
  found: number;
  total: number;
  from: string;
  to: string;
  error?: string;
}> {
  const range = getNewRegistrationsRange();
  const from = ruDateToIso(range.from);
  const to = ruDateToIso(range.to);
  const cfg = await getOutreachConfig();

  try {
    const scan = await scanCheckoNewRegistrations({
      dateFrom: from,
      dateTo: to,
      listOnly: true,
      maxItems: options?.maxItems ?? 100,
      maxPages: options?.maxPages ?? cfg.maxPages,
      delayMs: cfg.delayMs,
    });

    const rows = (scan.declarations ?? []).map((d) => ({
      ogrn: d.applicant?.ogrn || String(d.id || ""),
      inn: d.applicant?.inn,
      name: d.applicant?.fullName || d.applicant?.shortName || d.productName || "",
      shortName: d.applicant?.shortName,
      url: d.registryUrl || "",
      registeredAt: d.registrationDate,
    })).filter((r) => r.ogrn && r.url);

    const { added, total } = await upsertScanResults(rows, { from, to });
    return {
      ok: true,
      added,
      found: rows.length,
      total,
      from,
      to,
    };
  } catch (err) {
    return {
      ok: false,
      added: 0,
      found: 0,
      total: 0,
      from,
      to,
      error: err instanceof Error ? err.message : "Ошибка скана",
    };
  }
}

export async function runOutreachEnrich(limit?: number): Promise<{
  ok: boolean;
  processed: number;
  withEmail: number;
  error?: string;
}> {
  const cfg = await getOutreachConfig();
  const pending = await listPendingEnrich(limit ?? cfg.enrichPerJob);
  if (pending.length === 0) {
    return { ok: true, processed: 0, withEmail: 0 };
  }

  try {
    const urls = pending.map((c) => c.url);
    const results = await enrichCheckoCompanyEmails(urls);

    const mapped = results.map((row, index) => {
      const company = row.company;
      return {
        ogrn: company?.ogrn || pending[index]?.ogrn,
        url: company?.url || row.url || pending[index]?.url,
        email: company?.email,
        emails: company?.emails,
        phone: company?.phone,
        name: company?.fullName || company?.shortName,
        shortName: company?.shortName,
      };
    });

    const { updated, withEmail } = await applyEnrichResults(mapped);
    const blocked = results.some((r) => r.blocked);
    if (blocked) {
      return {
        ok: false,
        processed: updated,
        withEmail,
        error: "Checko ограничил доступ (капча/лимит)",
      };
    }
    return {
      ok: true,
      processed: updated,
      withEmail,
    };
  } catch (err) {
    return {
      ok: false,
      processed: 0,
      withEmail: 0,
      error: err instanceof Error ? err.message : "Ошибка enrich",
    };
  }
}
