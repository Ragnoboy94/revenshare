import { NextResponse } from "next/server";
import { isAdminRequest, verifyAdminPath } from "@/lib/admin-auth";
import {
  addCard,
  CARD_STATUSES,
  deleteCard,
  type CardStatus,
  updateCard,
} from "@/lib/boards-store";

type Ctx = { params: Promise<{ slug: string; boardId: string }> };

async function guard(slug: string) {
  if (!verifyAdminPath(slug)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request, context: Ctx) {
  const { slug, boardId } = await context.params;
  const denied = await guard(slug);
  if (denied) return denied;

  let body: { title?: string; body?: string; status?: string };
  try {
    body = (await request.json()) as {
      title?: string;
      body?: string;
      status?: string;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const status =
    typeof body.status === "string" && CARD_STATUSES.includes(body.status as CardStatus)
      ? (body.status as CardStatus)
      : undefined;

  try {
    const card = await addCard(boardId, {
      title: typeof body.title === "string" ? body.title : "",
      body: typeof body.body === "string" ? body.body : "",
      author: "admin",
      status,
    });
    if (!card) {
      return NextResponse.json({ ok: false, error: "Доска не найдена" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, card });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Не удалось создать" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const { slug, boardId } = await context.params;
  const denied = await guard(slug);
  if (denied) return denied;

  let body: {
    id?: string;
    title?: string;
    body?: string;
    status?: string;
    reply?: string;
  };
  try {
    body = (await request.json()) as {
      id?: string;
      title?: string;
      body?: string;
      status?: string;
      reply?: string;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "Нужен id карточки" }, { status: 400 });
  }

  const status =
    typeof body.status === "string"
      ? (body.status as CardStatus)
      : undefined;
  if (status !== undefined && !CARD_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: "Некорректный статус" }, { status: 400 });
  }

  try {
    const card = await updateCard(boardId, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      body: typeof body.body === "string" ? body.body : undefined,
      status,
      reply: typeof body.reply === "string" ? body.reply : undefined,
    });
    if (!card) {
      return NextResponse.json({ ok: false, error: "Карточка не найдена" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, card });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Не удалось обновить" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const { slug, boardId } = await context.params;
  const denied = await guard(slug);
  if (denied) return denied;

  let body: { id?: string };
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "Нужен id карточки" }, { status: 400 });
  }

  const ok = await deleteCard(boardId, id);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Карточка не найдена" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
