"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CARD_STATUS_LABEL,
  CARD_STATUSES,
  type CardStatus,
} from "@/lib/boards-shared";
import styles from "./ClientBoard.module.css";

function ackStorageKey(token: string): string {
  return `rs-c-ack:${token}`;
}

export type ClientCard = {
  id: string;
  title: string;
  body: string;
  status: CardStatus;
  author: "client" | "admin";
  reply: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientBoardData = {
  title: string;
  clientName: string;
  cards: ClientCard[];
};

type Props = {
  token: string;
  initialBoard: ClientBoardData;
};

const COLUMN_TONE: Record<CardStatus, string> = {
  wish: styles.colWish,
  planned: styles.colPlanned,
  in_progress: styles.colProgress,
  done: styles.colDone,
};

export function ClientBoard({ token, initialBoard }: Props) {
  const [board, setBoard] = useState(initialBoard);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  /** loading → open (нужно подтверждение) → done */
  const [gate, setGate] = useState<"loading" | "open" | "done">("loading");

  useEffect(() => {
    try {
      setGate(
        window.localStorage.getItem(ackStorageKey(token)) === "1"
          ? "done"
          : "open",
      );
    } catch {
      setGate("open");
    }
  }, [token]);

  function confirmGate() {
    try {
      window.localStorage.setItem(ackStorageKey(token), "1");
    } catch {
      /* private mode — всё равно пускаем в этой сессии */
    }
    setGate("done");
  }

  const columns = useMemo(
    () =>
      CARD_STATUSES.map((status) => ({
        status,
        cards: board.cards.filter((card) => card.status === status),
      })),
    [board.cards],
  );

  const openCount = board.cards.filter((card) => card.status !== "done").length;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/c/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        card?: ClientCard;
      };
      if (!res.ok || !json.ok || !json.card) {
        throw new Error(json.error || "Не удалось отправить");
      }
      setBoard((prev) => ({
        ...prev,
        cards: [json.card!, ...prev.cards],
      }));
      setTitle("");
      setBody("");
      setOk("Пожелание отправлено");
      setComposeOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const locked = gate !== "done";

  return (
    <div className={styles.shell}>
      {gate === "open" ? (
        <div className={styles.gate} role="dialog" aria-modal="true" aria-labelledby="gate-title">
          <div className={styles.gateCard}>
            <p className={styles.gateBrand}>RevenShare</p>
            <h2 id="gate-title" className={styles.gateTitle}>
              Согласие на использование доски
            </h2>
            <p className={styles.gateLead}>
              Доступ к доске предоставляется для согласования правок по проекту с
              оператором RevenShare (ИП Махнев С. А.). Продолжая, вы подтверждаете:
            </p>
            <ul className={styles.gateList}>
              <li>
                Согласие на обработку персональных данных, которые вы указываете в
                карточках и сообщениях, в соответствии с{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  политикой обработки персональных данных
                </a>
                .
              </li>
              <li>
                Материалы на доске используются для исполнения работ / обсуждения
                проекта и не являются публичной офертой и не заменяют договор, если он
                заключён отдельно.
              </li>
              <li>
                Вы несёте ответственность за сохранность ссылки: передача третьим лицам
                означает доступ к содержанию доски от вашего имени.
              </li>
              <li>
                Запрещено размещать незаконный контент, чужие персональные данные без
                оснований и сведения, не относящиеся к проекту.
              </li>
            </ul>
            <button type="button" className={styles.gateBtn} onClick={confirmGate}>
              Согласен — открыть доску
            </button>
            <p className={styles.gateFine}>
              Нажимая кнопку, вы даёте согласие на условиях выше. Отозвать согласие на
              обработку ПДн можно письмом на info@revenshare.ru.
            </p>
          </div>
        </div>
      ) : null}

      <div aria-hidden={locked || undefined}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <p className={styles.brand}>RevenShare</p>
          <div className={styles.project}>
            <h1 className={styles.title}>{board.title}</h1>
            {board.clientName ? (
              <p className={styles.sub}>{board.clientName}</p>
            ) : null}
          </div>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.stat}>
            {openCount} в работе · {board.cards.length} всего
          </span>
          <button
            type="button"
            className={styles.addBtn}
            disabled={locked}
            onClick={() => {
              setComposeOpen((v) => !v);
              setOk("");
              setError("");
            }}
          >
            {composeOpen ? "Закрыть" : "Новое пожелание"}
          </button>
        </div>
      </header>

      {composeOpen && !locked ? (
        <section className={styles.compose} aria-labelledby="wish-title">
          <h2 id="wish-title" className={styles.composeTitle}>
            Что нужно сделать
          </h2>
          <form className={styles.form} onSubmit={onSubmit}>
            <input
              className={styles.titleInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={160}
              placeholder="Кратко: заменить телефон в шапке"
              autoFocus
            />
            <textarea
              className={styles.bodyInput}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Подробности: цвет, текст, ссылка — всё, что поможет"
            />
            <div className={styles.formActions}>
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? "Отправляем…" : "Отправить в «Пожелания»"}
              </button>
              {error ? <p className={styles.error}>{error}</p> : null}
              {ok ? <p className={styles.ok}>{ok}</p> : null}
            </div>
          </form>
        </section>
      ) : null}

      <section className={styles.board} aria-label="Статусы задач">
        {columns.map(({ status, cards }) => (
          <div
            key={status}
            className={`${styles.column} ${COLUMN_TONE[status]}`}
          >
            <header className={styles.columnHead}>
              <span className={styles.columnDot} aria-hidden />
              <span className={styles.columnLabel}>
                {CARD_STATUS_LABEL[status]}
              </span>
              <span className={styles.count}>{cards.length}</span>
            </header>
            <div className={styles.list}>
              {status === "wish" && !composeOpen ? (
                <button
                  type="button"
                  className={styles.quickAdd}
                  onClick={() => setComposeOpen(true)}
                >
                  + Добавить пожелание
                </button>
              ) : null}
              {cards.length === 0 ? (
                <p className={styles.emptyCol}>Пока пусто</p>
              ) : (
                cards.map((card) => (
                  <article key={card.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <h3 className={styles.cardTitle}>{card.title}</h3>
                      {card.author === "admin" ? (
                        <span className={styles.badgeAdmin}>RevenShare</span>
                      ) : null}
                    </div>
                    {card.body ? (
                      <p className={styles.cardBody}>{card.body}</p>
                    ) : null}
                    <p className={styles.meta}>{formatDate(card.updatedAt)}</p>
                    {card.reply ? (
                      <div className={styles.reply}>
                        <span>Ответ RevenShare</span>
                        <p>{card.reply}</p>
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
