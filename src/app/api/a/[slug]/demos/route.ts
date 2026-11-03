import { NextResponse } from "next/server";
import { isAdminRequest, verifyAdminPath } from "@/lib/admin-auth";
import {
  listDemoRuntimes,
  startDemo,
  stopDemo,
} from "@/lib/demo-runner";
import { toDemoPublic } from "@/lib/demo-public";

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

  const demos = (await listDemoRuntimes()).map(toDemoPublic);
  return NextResponse.json({ ok: true, demos });
}

export async function POST(request: Request, context: Ctx) {
  const { slug } = await context.params;
  const denied = await guard(slug);
  if (denied) return denied;

  let body: { action?: string; demo?: string };
  try {
    body = (await request.json()) as { action?: string; demo?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const action = body.action;
  const demoSlug = typeof body.demo === "string" ? body.demo.trim() : "";
  if (!demoSlug || (action !== "start" && action !== "stop")) {
    return NextResponse.json(
      { ok: false, error: "Нужны action: start|stop и demo" },
      { status: 400 },
    );
  }

  try {
    const raw =
      action === "start" ? await startDemo(demoSlug) : await stopDemo(demoSlug);
    return NextResponse.json({ ok: true, demo: toDemoPublic(raw) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
