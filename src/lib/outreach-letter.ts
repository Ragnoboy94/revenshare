/**
 * Письма рассылки RevenShare.
 * Тема/текст берутся из data/outreach-config.json (общий шаблон для всех).
 */
import { IP } from "@/lib/ip";
import {
  applyLetterPlaceholders,
  DEFAULT_LETTER,
  getOutreachConfig,
  peekOutreachConfigSync,
  type OutreachLetterConfig,
} from "@/lib/outreach-config";
import { buildUnsubscribeUrl } from "@/lib/outreach-unsubscribe";

export type OutreachLetterInput = {
  companyName: string;
  recipientEmail: string;
};

export type OutreachLetter = {
  subject: string;
  text: string;
  html: string;
};

function outreachPhone(): string {
  return (
    process.env.OUTREACH_PHONE?.trim() ||
    process.env.NEXT_PUBLIC_PHONE?.trim() ||
    "+7 908 644-48-21"
  );
}

function outreachPhoneTelHref(): string {
  const digits = outreachPhone().replace(/\D/g, "");
  if (!digits) return "tel:+79086444821";
  return digits.startsWith("8") && digits.length === 11
    ? `tel:+7${digits.slice(1)}`
    : `tel:+${digits}`;
}

function outreachSiteUrl(): string {
  const raw =
    process.env.OUTREACH_SITE_URL?.trim() || "https://revenshare.ru";
  return raw.replace(/\/$/, "");
}

function siteHost(): string {
  try {
    return new URL(outreachSiteUrl()).host;
  } catch {
    return "revenshare.ru";
  }
}

function companyLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed || "вашей организации";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fromName(): string {
  return process.env.OUTREACH_FROM_NAME?.trim() || "Сергей Махнев";
}

function letterVars(company: string): Record<string, string> {
  return {
    company,
    site: outreachSiteUrl(),
    phone: outreachPhone(),
    fromName: fromName(),
    shortName: IP.shortName,
    brand: IP.brand,
  };
}

function textToHtmlBody(text: string): string {
  return text
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const withBreaks = escapeHtml(block).replace(/\n/g, "<br>");
      return `<p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#263247;">${withBreaks}</p>`;
    })
    .join("\n");
}

function wrapHtml(bodyHtml: string, siteUrl: string, unsubUrl: string): string {
  const site = escapeHtml(siteUrl);
  const host = escapeHtml(siteHost());
  const brand = escapeHtml(IP.brand);
  const unsub = escapeHtml(unsubUrl);
  const phone = escapeHtml(outreachPhone());
  const telHref = escapeHtml(outreachPhoneTelHref());

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Предложение по созданию сайта</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f5f8;">
  <div style="display:none; font-size:1px; color:#f3f5f8; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    Сначала демостенд и правки. Разработка сайта — без предоплаты.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#f3f5f8;">
    <tr>
      <td align="center" style="padding:34px 14px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td style="padding:0 4px 18px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="font-family:Arial, Helvetica, sans-serif; font-size:23px; line-height:28px; font-weight:700; color:#17243a;">
                    Reven<span style="color:#27856e;">Share</span>
                  </td>
                  <td align="right" style="font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:16px; font-weight:700; letter-spacing:1.2px; color:#778397;">
                    СОТРУДНИЧЕСТВО
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff; border:1px solid #e6eaf0; border-radius:16px; overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:38px 42px 36px 42px; font-family:Arial, Helvetica, sans-serif; color:#263247;">
                    <div style="font-size:11px; line-height:16px; font-weight:700; letter-spacing:1.2px; color:#27856e;">
                      ПРЕДЛОЖЕНИЕ ДЛЯ ВАШЕЙ КОМПАНИИ
                    </div>
                    <h1 style="margin:12px 0 24px 0; font-family:Arial, Helvetica, sans-serif; font-size:28px; line-height:34px; font-weight:700; color:#17243a;">
                      Сначала демоверсия.<br>Потом решение о сотрудничестве.
                    </h1>
                    ${bodyHtml}
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
                      <tr>
                        <td align="center" bgcolor="#27856e" style="border-radius:8px;">
                          <a href="${site}" target="_blank" style="display:inline-block; padding:14px 22px; border-radius:8px; font-family:Arial, Helvetica, sans-serif; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none;">
                            Посмотреть ${brand}
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0; font-size:13px; line-height:21px; color:#596579;">
                      Тел.: <a href="${telHref}" style="color:#27856e; text-decoration:none;">${phone}</a><br>
                      Сайт: <a href="${site}" target="_blank" style="color:#27856e; text-decoration:none;">${host}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 12px 0 12px; font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:17px; color:#8a94a5;">
              ${brand} · Предложение о возможном сотрудничестве<br>
              <a href="${unsub}" style="color:#8a94a5; text-decoration:underline;">Отписаться от рассылки</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildFromTemplates(
  input: OutreachLetterInput,
  letterCfg: OutreachLetterConfig,
): OutreachLetter {
  const company = companyLabel(input.companyName);
  const email = input.recipientEmail.trim().toLowerCase();
  const siteUrl = outreachSiteUrl();
  const unsubUrl = buildUnsubscribeUrl(email, input.companyName);
  const vars = letterVars(company);

  const subject = applyLetterPlaceholders(letterCfg.subjectTemplate, vars);
  let text = applyLetterPlaceholders(letterCfg.textTemplate, vars).trim();
  if (!text.includes(unsubUrl) && !/отпишитесь/i.test(text)) {
    text = `${text}\n\nЕсли вы не хотите получать подобные предложения, отпишитесь: ${unsubUrl}`;
  }

  const bodyForHtml = applyLetterPlaceholders(letterCfg.textTemplate, vars)
    .trim()
    .replace(/\n+$/, "");
  const html = wrapHtml(textToHtmlBody(bodyForHtml), siteUrl, unsubUrl);

  return { subject, text, html };
}

/** Sync: использует кэш конфига (или дефолт). */
export function buildRevenShareOutreachLetter(
  input: OutreachLetterInput,
  letterCfg?: OutreachLetterConfig,
): OutreachLetter {
  const cfg = letterCfg || peekOutreachConfigSync().letter || DEFAULT_LETTER;
  return buildFromTemplates(input, cfg);
}

export async function buildRevenShareOutreachLetterAsync(
  input: OutreachLetterInput,
): Promise<OutreachLetter> {
  const cfg = await getOutreachConfig();
  return buildFromTemplates(input, cfg.letter);
}

export async function previewRevenShareOutreachLetter(): Promise<OutreachLetter> {
  return buildRevenShareOutreachLetterAsync({
    companyName: "ООО «Пример»",
    recipientEmail: "preview@example.com",
  });
}
