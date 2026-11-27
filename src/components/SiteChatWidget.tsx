"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import styles from "./SiteChatWidget.module.css";

type Turn = { role: "user" | "assistant"; content: string };
type UiMsg = Turn | { role: "error"; content: string };

const GREETING =
  "Здравствуйте! Я ИИ-помощник RevenShare. Могу объяснить модель без предоплаты за разработку, 10% с заявок или помочь понять, подойдёт ли она вашему бизнесу. Что хотите узнать?";

const DISCLAIMER =
  "Переписка носит информационный характер и не является офертой или юридической консультацией. Условия фиксируются в договоре.";

const MAX_CHARS = 300;
const SEND_COOLDOWN_MS = 1000;
const SESSION_KEY = "rs_chat_session";

function mentionsLeadCta(text: string): boolean {
  return /обсудить проект|оставьте заявку|оставить заявку|форм[аеуы].{0,24}(заявк|проект)/i.test(
    text,
  );
}

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `s_${Date.now().toString(36)}`;
  }
}

export function SiteChatWidget() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [messages, setMessages] = useState<UiMsg[]>([
    { role: "assistant", content: GREETING },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>("");
  const lastSendRef = useRef(0);

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    inputRef.current?.focus();
  }, [open, messages, busy]);

  function goToLeadForm() {
    setOpen(false);
    const el = document.getElementById("lead");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", "#lead");
      return;
    }
    window.location.hash = "lead";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim().slice(0, MAX_CHARS);
    if (!text || busy || cooldown) return;

    const now = Date.now();
    if (now - lastSendRef.current < SEND_COOLDOWN_MS) {
      setCooldown(true);
      window.setTimeout(() => setCooldown(false), SEND_COOLDOWN_MS - (now - lastSendRef.current));
      return;
    }
    lastSendRef.current = now;
    setCooldown(true);
    window.setTimeout(() => setCooldown(false), SEND_COOLDOWN_MS);

    const nextUser: Turn = { role: "user", content: text };
    const history = messages
      .filter((m): m is Turn => m.role === "user" || m.role === "assistant")
      .concat(nextUser);

    setInput("");
    setMessages((prev) => [...prev, nextUser]);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current || getOrCreateSessionId(),
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        error?: string;
        sessionId?: string;
      };
      if (data.sessionId) {
        sessionIdRef.current = data.sessionId;
        try {
          sessionStorage.setItem(SESSION_KEY, data.sessionId);
        } catch {
          /* ignore */
        }
      }
      if (!res.ok || !data.ok || !data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            content:
              data.error ||
              "Сейчас не получилось ответить. Напишите на info@revenshare.ru или оставьте заявку на сайте.",
          },
        ]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          content: "Связь прервалась. Напишите на info@revenshare.ru или оставьте заявку на сайте.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const sendDisabled = busy || cooldown || !input.trim();

  return (
    <div className={styles.wrap}>
      <div
        className={styles.panel}
        id={panelId}
        role="dialog"
        aria-label="Справка RevenShare"
        hidden={!open}
      >
        <div className={styles.head}>
          <p className={styles.headTitle}>RevenShare</p>
          <button
            type="button"
            className={styles.close}
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>

        <div className={styles.messages} ref={listRef} aria-live="polite">
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={m.role === "user" ? styles.msgUser : styles.msgBot}
            >
              <div
                className={
                  m.role === "user"
                    ? `${styles.bubble} ${styles.bubbleUser}`
                    : m.role === "error"
                      ? `${styles.bubble} ${styles.bubbleErr}`
                      : `${styles.bubble} ${styles.bubbleBot}`
                }
              >
                {m.content}
              </div>
              {m.role === "assistant" && mentionsLeadCta(m.content) ? (
                <button type="button" className={styles.leadBtn} onClick={goToLeadForm}>
                  Обсудить проект
                </button>
              ) : null}
            </div>
          ))}
          {busy ? <div className={`${styles.bubble} ${styles.bubbleBot} ${styles.typing}`}>Минутку…</div> : null}
        </div>

        <p className={styles.disclaimer}>{DISCLAIMER}</p>

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.inputWrap}>
            <input
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Спросите про условия…"
              maxLength={MAX_CHARS}
              disabled={busy}
              aria-label="Ваш вопрос"
              autoComplete="off"
            />
            <span className={styles.charCount} aria-hidden="true">
              {input.length}/{MAX_CHARS}
            </span>
          </div>
          <button className={styles.send} type="submit" disabled={sendDisabled}>
            Отправить
          </button>
        </form>
      </div>

      <button
        type="button"
        className={styles.fab}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Скрыть справку" : "Открыть справку"}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-3.8 3.2c-.5.4-1.2.05-1.2-.6V6.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
