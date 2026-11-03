import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminPath } from "@/lib/admin-auth";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, context: Ctx) {
  const { slug } = await context.params;
  if (!verifyAdminPath(slug)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
