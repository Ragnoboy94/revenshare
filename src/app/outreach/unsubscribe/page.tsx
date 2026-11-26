import type { Metadata } from "next";
import { UnsubscribeClient } from "./UnsubscribeClient";

export const metadata: Metadata = {
  title: "Отписка от рассылки",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;
  return <UnsubscribeClient token={typeof token === "string" ? token : ""} />;
}
