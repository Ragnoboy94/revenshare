import { NextResponse } from "next/server";
import { isAdminRequest, verifyAdminPath } from "@/lib/admin-auth";
import {
  createBoard,
  deleteBoard,
  ensureBoardForDemo,
  listBoards,
  updateBoard,
} from "@/lib/boards-store";

type Ctx = { params: Promise<{ slug: string }> };

async function guard(slug: string) {
  if (!verifyAdminPath(slug)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(_request: Request, context: Ctx) {
  const { slug } = await context.params;
  const denied = await guard(slug);
  if (denied) return denied;

  const boards = await listBoards();
  return NextResponse.json({ ok: true, boards });
}

export async function POST(request: Request, context: Ctx) {
  const { slug } = await context.params;
  const denied = await guard(slug);
  if (denied) return denied;

  let body: {
    title?: string;
    clientName?: string;
    demoSlug?: string;
    ensureDemo?: boolean;
  };
  try {
    body = (await request.json()) as {
      title?: string;
      clientName?: string;
      demoSlug?: string;
      ensureDemo?: boolean;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  try {
    if (body.ensureDemo) {
      const result = await ensureBoardForDemo({
        demoSlug: typeof body.demoSlug === "string" ? body.demoSlug : "",
        title: typeof body.title === "string" ? body.title : "",
      });
      return NextResponse.json({
        ok: true,
        board: result.board,
        created: result.created,
      });
    }

    const board = await createBoard({
      title: typeof body.title === "string" ? body.title : "",
      clientName: typeof body.clientName === "string" ? body.clientName : "",
      demoSlug: typeof body.demoSlug === "string" ? body.demoSlug : "",
    });
    return NextResponse.json({ ok: true, board, created: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Не удалось создать" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const { slug } = await context.params;
  const denied = await guard(slug);
  if (denied) return denied;

  let body: { id?: string; title?: string; clientName?: string };
  try {
    body = (await request.json()) as {
      id?: string;
      title?: string;
      clientName?: string;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "Нужен id" }, { status: 400 });
  }

  try {
    const board = await updateBoard(id, {
      title: typeof body.title === "string" ? body.title : undefined,
      clientName: typeof body.clientName === "string" ? body.clientName : undefined,
    });
    if (!board) {
      return NextResponse.json({ ok: false, error: "Доска не найдена" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, board });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Не удалось обновить" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const { slug } = await context.params;
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
    return NextResponse.json({ ok: false, error: "Нужен id" }, { status: 400 });
  }

  const ok = await deleteBoard(id);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Доска не найдена" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
