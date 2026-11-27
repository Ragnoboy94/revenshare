import { NextResponse } from "next/server";
import {
  ensureOutreachScheduler,
  runOutreachTick,
} from "@/lib/outreach-scheduler";

/**
 * Внешний cron: POST /api/cron/outreach
 * Header: Authorization: Bearer <OUTREACH_CRON_SECRET или ADMIN_PASSWORD>
 */
function authorized(request: Request): boolean {
  const secret =
    process.env.OUTREACH_CRON_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    "";
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  const query = new URL(request.url).searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  await ensureOutreachScheduler();
  // Без force: если расписание выключено в UI — cron ничего не делает.
  const result = await runOutreachTick();
  return NextResponse.json({ ok: result.ok, result });
}

export async function GET(request: Request) {
  return POST(request);
}
