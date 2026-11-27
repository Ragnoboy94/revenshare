import { NextResponse } from "next/server";
import { appendChatTurn, isSessionId } from "@/lib/chat-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { answerLocally, MAX_MESSAGE_CHARS, normalizeMessages } from "@/lib/support-bot";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = clientIp(request);

  const burst = rateLimit(`chat-burst:${ip}`, 1, 1000);
  if (!burst.ok) {
    return NextResponse.json(
      { ok: false, error: "Подождите секунду перед следующим сообщением." },
      {
        status: 429,
        headers: { "Retry-After": String(burst.retryAfterSec) },
      },
    );
  }

  const limited = rateLimit(`chat:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Слишком много вопросов подряд. Подождите минуту." },
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

  const messages = normalizeMessages(body.messages);
  if ("error" in messages) {
    return NextResponse.json({ ok: false, error: messages.error }, { status: 400 });
  }

  const lastUser = messages[messages.length - 1]!;
  if (lastUser.content.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { ok: false, error: `Сообщение слишком длинное (макс. ${MAX_MESSAGE_CHARS} символов).` },
      { status: 400 },
    );
  }

  const sessionId = isSessionId(body.sessionId) ? body.sessionId : undefined;

  try {
    const answered = await answerLocally(messages);
    const session = await appendChatTurn({
      sessionId,
      ip,
      userText: lastUser.content,
      assistantText: answered.reply,
      weak: answered.weak,
    });

    return NextResponse.json({
      ok: true,
      reply: answered.reply,
      weak: answered.weak,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("chat route:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Сейчас не получилось ответить. Напишите на info@revenshare.ru.",
      },
      { status: 500 },
    );
  }
}
