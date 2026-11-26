import nodemailer from "nodemailer";

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Не применять OUTREACH_MAIL_OVERRIDE_TO (тестовое себе). */
  skipOverride?: boolean;
};

export type MailConfigStatus = {
  configured: boolean;
  from: string;
  host: string;
  testMode: boolean;
  overrideTo: string;
};

export function getMailConfigStatus(): MailConfigStatus {
  const host = process.env.SMTP_HOST?.trim() || "";
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";
  const address =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "info@revenshare.ru";
  const fromName = process.env.OUTREACH_FROM_NAME?.trim() || "Сергей Махнев";
  const from = `${fromName} <${address}>`;
  const testMode = process.env.OUTREACH_MAIL_TEST === "1";
  const overrideTo = process.env.OUTREACH_MAIL_OVERRIDE_TO?.trim() || "";

  return {
    configured: Boolean(host && user && pass),
    from,
    host,
    testMode,
    overrideTo,
  };
}

export async function sendMail(
  payload: MailPayload,
): Promise<{ ok: true; deliveredTo: string } | { ok: false; error: string }> {
  const cfg = getMailConfigStatus();
  if (!cfg.configured) {
    return {
      ok: false,
      error: "SMTP не настроен (SMTP_HOST / SMTP_USER / SMTP_PASS)",
    };
  }

  const useOverride = Boolean(cfg.overrideTo) && !payload.skipOverride;
  const deliveredTo = useOverride ? cfg.overrideTo : payload.to;
  const subject = useOverride
    ? `[тест → ${payload.to}] ${payload.subject}`
    : payload.subject;
  const text = useOverride
    ? `Исходный получатель: ${payload.to}\n\n${payload.text}`
    : payload.text;
  const html = useOverride
    ? `<p><strong>Исходный получатель:</strong> ${payload.to}</p><hr/>${payload.html ?? `<pre>${payload.text}</pre>`}`
    : payload.html;

  if (cfg.testMode) {
    console.info("[mail-test]", {
      to: deliveredTo,
      originalTo: payload.to,
      subject,
      text: text.slice(0, 200),
    });
    return { ok: true, deliveredTo };
  }

  try {
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = process.env.SMTP_SECURE === "1" || port === 465;
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS!.trim(),
      },
    });

    await transporter.sendMail({
      from: cfg.from,
      to: deliveredTo,
      subject,
      text,
      html,
    });
    return { ok: true, deliveredTo };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ошибка SMTP",
    };
  }
}
