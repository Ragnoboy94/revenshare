/**
 * Разовая отправка письма (минуя OUTREACH_MAIL_OVERRIDE_TO).
 * Usage: npx tsx scripts/outreach/send-one-off.mts
 */
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const to = "a.gromov@navicert-info.ru";
const cc = "still-1994@mail.ru";
const companyName = "Нависерт";

const { buildRevenShareOutreachLetter } = await import(
  "../../src/lib/outreach-letter.ts"
);

const letter = buildRevenShareOutreachLetter({
  companyName,
  recipientEmail: to,
});

const host = process.env.SMTP_HOST?.trim();
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.trim();
const address =
  process.env.SMTP_FROM?.trim() || user || "info@revenshare.ru";
const fromName = process.env.OUTREACH_FROM_NAME?.trim() || "Сергей Махнев";

if (!host || !user || !pass) {
  console.error("SMTP not configured");
  process.exit(1);
}

const port = Number(process.env.SMTP_PORT || 465);
const transporter = nodemailer.createTransport({
  host,
  port,
  secure: process.env.SMTP_SECURE === "1" || port === 465,
  auth: { user, pass },
});

const info = await transporter.sendMail({
  from: `${fromName} <${address}>`,
  to,
  cc,
  subject: letter.subject,
  text: letter.text,
  html: letter.html,
});

console.log("sent", {
  to,
  cc,
  subject: letter.subject,
  messageId: info.messageId,
});
