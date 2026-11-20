import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientBoard } from "@/components/ClientBoard";
import { getBoardByToken, toClientBoard } from "@/lib/boards-store";

export const metadata: Metadata = {
  title: "Доска проекта",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ClientBoardPage({ params }: Props) {
  const { token } = await params;
  const board = await getBoardByToken(token);
  if (!board) notFound();

  return <ClientBoard token={token} initialBoard={toClientBoard(board)} />;
}
