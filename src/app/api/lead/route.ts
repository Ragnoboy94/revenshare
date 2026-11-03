import { NextResponse } from "next/server";
import { validateLeadPayload } from "@/lib/lead-validate";
import { addLead } from "@/lib/leads-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`lead:${ip}`, 8, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Слишком много заявок. Попробуйте чуть позже." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const validated = validateLeadPayload({
    name: typeof body.name === "string" ? body.name : "",
    contact: typeof body.contact === "string" ? body.contact : "",
    niche: typeof body.niche === "string" ? body.niche : "",
    comment: typeof body.comment === "string" ? body.comment : "",
    company: typeof body.company === "string" ? body.company : "",
    formStartedAt: typeof body.formStartedAt === "number" ? body.formStartedAt : undefined,
  });

  if (!validated.ok) {
    // Honeypot / too-fast: pretend success so bots don't learn
    if (validated.silent) {
      return NextResponse.json({ ok: true, via: "ignored" });
    }
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const { name, contact, niche, comment } = validated.data;

  let leadId: string;
  try {
    const lead = await addLead({ name, contact, niche, comment });
    leadId = lead.id;
  } catch (err) {
    console.error("Failed to store lead:", err);
    return NextResponse.json(
      { ok: false, error: "Не удалось сохранить заявку" },
      { status: 500 },
    );
  }

  const text = [
    "Новая заявка RevenShare",
    `ID: ${leadId}`,
    `Имя: ${name}`,
    `Контакт: ${contact}`,
    `Ниша: ${niche}`,
    comment ? `Комментарий: ${comment}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (token && chatId) {
    try {
      const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (!tg.ok) {
        console.error("Telegram send failed:", await tg.text());
        return NextResponse.json({ ok: true, id: leadId, via: "store" });
      }
      return NextResponse.json({ ok: true, id: leadId, via: "telegram+store" });
    } catch (err) {
      console.error("Telegram error:", err);
      return NextResponse.json({ ok: true, id: leadId, via: "store" });
    }
  }

  console.info("[lead]", text);
  return NextResponse.json({ ok: true, id: leadId, via: "store" });
}
