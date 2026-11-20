"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CARD_STATUS_LABEL,
  CARD_STATUSES,
  type Board,
  type BoardCard,
  type CardStatus,
} from "@/lib/boards-shared";
import styles from "./AdminPanel.module.css";

type Props = {
  apiBase: string;
  boards: Board[];
  query: string;
  openBoardId?: string | null;
  onBoardsChange: (boards: Board[]) => void;
  onOpenBoardHandled?: () => void;
};

export function AdminBoards({
  apiBase,
  boards,
  query,
  openBoardId = null,
  onBoardsChange,
  onOpenBoardHandled,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!openBoardId) return;
    setActiveId(openBoardId);
    onOpenBoardHandled?.();
  }, [openBoardId, onOpenBoardHandled]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter((board) =>
      `${board.title} ${board.clientName} ${board.token}`
        .toLowerCase()
        .includes(q),
    );
  }, [boards, query]);

  const active = boards.find((board) => board.id === activeId) ?? null;

  function clientUrl(token: string): string {
    if (typeof window === "undefined") return `/c/${token}`;
    return `${window.location.origin}/c/${token}`;
  }

  async function refreshBoards() {
    const res = await fetch(`${apiBase}/boards`);
    const json = (await res.json()) as { ok?: boolean; boards?: Board[] };
    if (res.ok && json.boards) onBoardsChange(json.boards);
  }

  async function onDeleteBoard(id: string) {
    if (!window.confirm("Удалить доску и все карточки?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/boards`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Не удалось удалить");
      onBoardsChange(boards.filter((board) => board.id !== id));
      if (activeId === id) setActiveId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(board: Board) {
    const url = clientUrl(board.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(board.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === board.id ? null : cur)), 1600);
    } catch {
      window.prompt("Скопируйте ссылку клиенту:", url);
    }
  }

  function replaceCard(boardId: string, card: BoardCard) {
    onBoardsChange(
      boards.map((board) =>
        board.id !== boardId
          ? board
          : {
              ...board,
              cards: board.cards.map((item) =>
                item.id === card.id ? card : item,
              ),
              updatedAt: card.updatedAt,
            },
      ),
    );
  }

  function removeCard(boardId: string, cardId: string) {
    onBoardsChange(
      boards.map((board) =>
        board.id !== boardId
          ? board
          : {
              ...board,
              cards: board.cards.filter((card) => card.id !== cardId),
            },
      ),
    );
  }

  async function onCardStatus(card: BoardCard, status: CardStatus) {
    if (!active) return;
    const prev = card.status;
    replaceCard(active.id, { ...card, status });
    const res = await fetch(`${apiBase}/boards/${active.id}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: card.id, status }),
    });
    if (!res.ok) {
      replaceCard(active.id, { ...card, status: prev });
      await refreshBoards();
    } else {
      const json = (await res.json()) as { card?: BoardCard };
      if (json.card) replaceCard(active.id, json.card);
    }
  }

  async function onSaveReply(card: BoardCard) {
    if (!active) return;
    const reply = replyDrafts[card.id] ?? card.reply;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/boards/${active.id}/cards`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, reply }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        card?: BoardCard;
      };
      if (!res.ok || !json.ok || !json.card) {
        throw new Error(json.error || "Не удалось сохранить ответ");
      }
      replaceCard(active.id, json.card);
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[card.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteCard(cardId: string) {
    if (!active) return;
    if (!window.confirm("Удалить карточку?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/boards/${active.id}/cards`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cardId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Не удалось удалить");
      removeCard(active.id, cardId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (active) {
    return (
      <div className={styles.boardWrap}>
        <div className={styles.boardToolbar}>
          <button type="button" className={styles.btn} onClick={() => setActiveId(null)}>
            ← К списку
          </button>
          <div className={styles.boardHeading}>
            <strong>{active.title}</strong>
            {active.clientName ? (
              <span className={styles.sub}>{active.clientName}</span>
            ) : null}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={() => copyLink(active)}>
              {copiedId === active.id ? "Скопировано" : "Ссылка клиенту"}
            </button>
            <a href={clientUrl(active.token)} target="_blank" rel="noreferrer">
              Открыть
            </a>
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => onDeleteBoard(active.id)}
            >
              Удалить
            </button>
          </div>
        </div>

        {error ? <p className={styles.error} style={{ padding: "0 0.75rem" }}>{error}</p> : null}

        <div className={styles.kanban}>
          {CARD_STATUSES.map((status) => {
            const cards = active.cards.filter((card) => card.status === status);
            return (
              <section key={status} className={styles.kanbanCol}>
                <header className={styles.kanbanHead}>
                  <span>{CARD_STATUS_LABEL[status]}</span>
                  <span className={styles.navCount}>{cards.length}</span>
                </header>
                <div className={styles.kanbanList}>
                  {cards.map((card) => (
                    <article key={card.id} className={styles.kanbanCard}>
                      <div className={styles.kanbanCardTop}>
                        <strong>{card.title}</strong>
                        <span className={styles.faint}>
                          {card.author === "client" ? "Клиент" : "RevenShare"}
                        </span>
                      </div>
                      {card.body ? <p className={styles.kanbanBody}>{card.body}</p> : null}
                      <select
                        className={styles.statusSelect}
                        value={card.status}
                        aria-label={`Статус ${card.title}`}
                        onChange={(e) =>
                          onCardStatus(card, e.target.value as CardStatus)
                        }
                      >
                        {CARD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {CARD_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <label className={styles.replyField}>
                        <span>Ответ клиенту</span>
                        <textarea
                          rows={2}
                          value={replyDrafts[card.id] ?? card.reply}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({
                              ...prev,
                              [card.id]: e.target.value,
                            }))
                          }
                          maxLength={2000}
                          placeholder="Короткий ответ…"
                        />
                      </label>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          disabled={busy}
                          onClick={() => onSaveReply(card)}
                        >
                          Сохранить ответ
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy}
                          onClick={() => onDeleteCard(card.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.boardWrap}>
      {error ? <p className={styles.error} style={{ padding: "0 0.75rem" }}>{error}</p> : null}

      {visible.length === 0 ? (
        <p className={styles.empty}>
          {boards.length === 0
            ? "Досок пока нет — открой демо → Заявки"
            : "Ничего не найдено"}
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Проект</th>
              <th className={styles.colNiche}>Клиент</th>
              <th className={styles.colPort}>Карт.</th>
              <th className={styles.colWhen}>Обновлено</th>
              <th className={`${styles.right} ${styles.colActions}`}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((board) => (
              <tr key={board.id}>
                <td>
                  <span className={styles.strong}>{board.title}</span>
                  <span className={`${styles.sub} ${styles.mono}`}>{board.token}</span>
                </td>
                <td className={styles.muted}>{board.clientName || "—"}</td>
                <td className={styles.mono}>{board.cards.length}</td>
                <td className={styles.faint}>
                  <time dateTime={board.updatedAt}>
                    {formatDate(board.updatedAt)}
                  </time>
                </td>
                <td className={styles.right}>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => setActiveId(board.id)}
                    >
                      Открыть
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => copyLink(board)}
                    >
                      {copiedId === board.id ? "Скопировано" : "Ссылка"}
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => onDeleteBoard(board.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
