import { NextResponse } from "next/server";
import { isAdminRequest, verifyAdminPath } from "@/lib/admin-auth";
import { listLeads, updateLeadStatus, type LeadStatus } from "@/lib/leads-store";

const STATUSES: LeadStatus[] = ["new", "in_progress", "done"];

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { slug } = await context.params;
  if (!verifyAdminPath(slug)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const leads = await listLeads();
  return NextResponse.json({ ok: true, leads });
}

export async function PATCH(request: Request, context: Ctx) {
  const { slug } = await context.params;
  if (!verifyAdminPath(slug)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; status?: string };
  try {
    body = (await request.json()) as { id?: string; status?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const status = body.status as LeadStatus;
  if (!id || !STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: "Нужны id и status" }, { status: 400 });
  }

  const lead = await updateLeadStatus(id, status);
  if (!lead) {
    return NextResponse.json({ ok: false, error: "Заявка не найдена" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lead });
}
