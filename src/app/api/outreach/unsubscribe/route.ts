import { NextResponse } from "next/server";
import {
  addUnsubscribe,
  maskEmail,
  verifyUnsubscribeToken,
} from "@/lib/outreach-unsubscribe";

export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Ссылка недействительна" }, { status: 400 });
  }

  await addUnsubscribe(payload.email, payload.companyName);
  return NextResponse.json({
    ok: true,
    email: maskEmail(payload.email),
  });
}
