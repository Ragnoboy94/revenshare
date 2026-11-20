import { NextResponse } from "next/server";
import {
  addCard,
  getBoardByToken,
  toClientBoard,
} from "@/lib/boards-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { token } = await context.params;
  const board = await getBoardByToken(token);
  if (!board) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, board: toClientBoard(board) });
}

export async function POST(request: Request, context: Ctx) {
  const { token } = await context.params;
  const board = await getBoardByToken(token);
  if (!board) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const ip = clientIp(request);
  const limited = rateLimit(`board:${token}:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Слишком много запросов. Попробуйте чуть позже." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let body: { title?: string; body?: string };
  try {
    body = (await request.json()) as { title?: string; body?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  try {
    const card = await addCard(board.id, {
      title: typeof body.title === "string" ? body.title : "",
      body: typeof body.body === "string" ? body.body : "",
      author: "client",
      status: "wish",
    });
    if (!card) {
      return NextResponse.json({ ok: false, error: "Доска не найдена" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      card: {
        id: card.id,
        title: card.title,
        body: card.body,
        status: card.status,
        author: card.author,
        reply: card.reply,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Не удалось сохранить" },
      { status: 400 },
    );
  }
}
