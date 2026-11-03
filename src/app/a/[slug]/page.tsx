import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPanel } from "@/components/AdminPanel";
import {
  isAdminConfigured,
  isAdminRequest,
  verifyAdminPath,
} from "@/lib/admin-auth";
import { listDemoRuntimes } from "@/lib/demo-runner";
import { toDemoPublic } from "@/lib/demo-public";
import { listLeads } from "@/lib/leads-store";

export const metadata: Metadata = {
  title: "Кабинет",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function SecretAdminPage({ params }: Props) {
  const { slug } = await params;

  if (!verifyAdminPath(slug)) {
    notFound();
  }

  const configured = isAdminConfigured();
  const authed = configured ? await isAdminRequest() : false;
  const leads = authed ? await listLeads() : [];
  const demos = authed
    ? (await listDemoRuntimes()).map(toDemoPublic)
    : [];

  return (
    <AdminPanel
      pathSlug={slug}
      configured={configured}
      initialAuthed={authed}
      initialLeads={leads}
      initialDemos={demos}
    />
  );
}
