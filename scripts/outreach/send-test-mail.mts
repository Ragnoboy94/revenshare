import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const { buildRevenShareOutreachLetter } = await import(
  "../../src/lib/outreach-letter.ts"
);
const { sendMail, getMailConfigStatus } = await import("../../src/lib/mail-send.ts");

console.log("mail config:", getMailConfigStatus());

const letter = buildRevenShareOutreachLetter({
  companyName: "ООО «Пример»",
  recipientEmail: "client@example.com",
});

console.log("subject:", letter.subject);
console.log("--- text ---");
console.log(letter.text);

const result = await sendMail({
  to: "client@example.com",
  subject: letter.subject,
  text: letter.text,
  html: letter.html,
});

console.log("result:", result);
if (!result.ok) process.exit(1);
