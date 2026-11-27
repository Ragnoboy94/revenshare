import { getMailConfigStatus, sendMail } from "@/lib/mail-send";
import { getOutreachConfig } from "@/lib/outreach-config";
import { buildRevenShareOutreachLetterAsync } from "@/lib/outreach-letter";
import { contactEmailList } from "@/lib/outreach-emails";
import {
  getContactsByIds,
  listOutreachContacts,
  markContactsSent,
} from "@/lib/outreach-store";
import { isUnsubscribed } from "@/lib/outreach-unsubscribe";

export type SendBatchResult = {
  sent: number;
  failed: number;
  skipped: number;
  capped: boolean;
  errors: string[];
};

async function activeEmailsForContact(
  emails: string[],
): Promise<string[]> {
  const active: string[] = [];
  for (const email of emails) {
    if (await isUnsubscribed(email)) continue;
    active.push(email);
  }
  return active;
}

/** Кандидаты для автоотправки: статус has_email, есть хотя бы один не-отписанный email. */
export async function listAutoSendCandidates(limit: number): Promise<string[]> {
  const contacts = await listOutreachContacts();
  const ids: string[] = [];
  for (const c of contacts) {
    const emails = contactEmailList(c);
    if (emails.length === 0) continue;
    if (c.status !== "has_email") continue;
    const active = await activeEmailsForContact(emails);
    if (active.length === 0) continue;
    ids.push(c.id);
    if (ids.length >= limit) break;
  }
  return ids;
}

export async function sendOutreachBatch(
  contactIds: string[],
  options?: { respectBatchLimit?: boolean },
): Promise<SendBatchResult> {
  const cfg = await getOutreachConfig();
  const mailCfg = getMailConfigStatus();
  let ids = contactIds.filter(Boolean);
  const respect = options?.respectBatchLimit !== false;
  let capped = false;
  if (respect && ids.length > cfg.sendBatchLimit) {
    capped = true;
    ids = ids.slice(0, cfg.sendBatchLimit);
  }

  const contacts = (await getContactsByIds(ids)).filter(
    (c) => contactEmailList(c).length > 0,
  );
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < contacts.length; i += 1) {
    const contact = contacts[i]!;
    const all = contactEmailList(contact);
    const recipients = await activeEmailsForContact(all);
    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    // Одно письмо сразу на все активные адреса (To: a, b, …)
    const to = recipients.join(", ");
    const letter = await buildRevenShareOutreachLetterAsync({
      companyName: contact.shortName || contact.name || "",
      recipientEmail: recipients[0]!,
    });

    const result = await sendMail({
      to,
      subject: letter.subject,
      text: letter.text,
      html: letter.html,
    });

    await markContactsSent([contact.id], {
      to,
      deliveredTo: result.ok ? result.deliveredTo : undefined,
      companyName: contact.shortName || contact.name,
      subject: letter.subject,
      ok: result.ok,
      error: result.ok ? undefined : result.error,
      testMode: mailCfg.testMode || Boolean(mailCfg.overrideTo),
    });

    if (result.ok) sent += 1;
    else {
      failed += 1;
      errors.push(`${to}: ${result.error}`);
    }

    if (cfg.sendDelayMs > 0 && i < contacts.length - 1) {
      await new Promise((r) => setTimeout(r, cfg.sendDelayMs));
    }
  }

  return { sent, failed, skipped, capped, errors };
}
