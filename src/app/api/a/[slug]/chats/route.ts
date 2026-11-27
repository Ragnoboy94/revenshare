import { NextResponse } from "next/server";
import { isAdminRequest, verifyAdminPath } from "@/lib/admin-auth";
import { getChatSession, listChatSessions } from "@/lib/chat-store";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: Ctx) {
  const { slug } = await context.params;
  if (!verifyAdminPath(slug)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const session = await getChatSession(id);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Чат не найден" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, session });
  }

  const sessions = await listChatSessions();
  const summary = sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    ip: s.ip,
    messageCount: s.messages.length,
    preview:
      [...s.messages].reverse().find((m) => m.role === "user")?.content.slice(0, 120) ||
      "—",
  }));

  return NextResponse.json({ ok: true, sessions: summary });
}
