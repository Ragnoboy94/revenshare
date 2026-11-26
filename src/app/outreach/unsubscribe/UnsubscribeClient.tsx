"use client";

import { useEffect, useState } from "react";

type Props = {
  token: string;
};

export function UnsubscribeClient({ token }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState(
    token ? "Отписываем…" : "Нет токена отписки",
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/outreach/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string; email?: string };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setStatus("error");
          setMessage(json.error || "Не удалось отписать");
          return;
        }
        setStatus("ok");
        setMessage(
          json.email
            ? `Адрес ${json.email} отписан от рассылки RevenShare.`
            : "Вы отписаны от рассылки RevenShare.",
        );
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Ошибка сети");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        fontFamily: "system-ui, sans-serif",
        background: "#e8f2f2",
        color: "#101f2d",
      }}
    >
      <div
        style={{
          width: "min(100%, 420px)",
          padding: "1.25rem",
          background: "#fff",
          border: "1px solid #c9d9d9",
          borderRadius: 12,
        }}
      >
        <p style={{ margin: "0 0 0.5rem", fontWeight: 700, color: "#066566" }}>
          RevenShare
        </p>
        <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.25rem" }}>
          Отписка от рассылки
        </h1>
        <p
          style={{
            margin: 0,
            color: status === "error" ? "#a33b2d" : "#3d5160",
            lineHeight: 1.5,
          }}
        >
          {status === "loading" ? "Отписываем…" : message}
        </p>
      </div>
    </main>
  );
}
