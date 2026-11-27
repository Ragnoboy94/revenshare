"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Board } from "@/lib/boards-shared";
import type { DemoPublic } from "@/lib/demo-public";
import type { Lead, LeadStatus } from "@/lib/leads-store";
import { AdminBoards } from "./AdminBoards";
import { AdminOutreach } from "./AdminOutreach";
import styles from "./AdminPanel.module.css";

type DemoRow = DemoPublic;
type SectionId = "leads" | "chats" | "demos" | "boards" | "outreach";

type ChatSummary = {
  id: string;
  createdAt: string;
  updatedAt: string;
  ip: string;
  messageCount: number;
  preview: string;
};

type ChatMessageRow = {
  role: "user" | "assistant";
  content: string;
  at: string;
  weak?: boolean;
};

type ChatSessionDetail = ChatSummary & {
  messages: ChatMessageRow[];
  weakStreak?: number;
};

type NavItem = {
  id: SectionId;
  label: string;
};

/** Add sections here — sidebar stays flat and short. */
const NAV: NavItem[] = [
  { id: "leads", label: "Заявки" },
  { id: "chats", label: "Чаты" },
  { id: "demos", label: "Демо" },
  { id: "boards", label: "Доски" },
  { id: "outreach", label: "Рассылка" },
];

type Props = {
  pathSlug: string;
  configured: boolean;
  initialAuthed: boolean;
  initialLeads: Lead[];
  initialDemos: DemoRow[];
  initialBoards: Board[];
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Закрыта",
};

const DEMO_STATUS_LABEL: Record<DemoRow["status"], string> = {
  stopped: "Стоп",
  starting: "Старт…",
  running: "Работает",
  error: "Ошибка",
};

const SEARCH_PLACEHOLDER: Record<SectionId, string> = {
  leads: "Имя, телефон, ниша…",
  chats: "Текст или IP…",
  demos: "Slug или название…",
  boards: "Проект или клиент…",
  outreach: "Компания, email, ОГРН…",
};

const SECTION_TITLE: Record<SectionId, string> = {
  leads: "Заявки",
  chats: "Чаты",
  demos: "Демо",
  boards: "Доски",
  outreach: "Рассылка",
};

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

function readSectionFromHash(): SectionId {
  if (typeof window === "undefined") return "leads";
  const raw = window.location.hash.replace(/^#/, "");
  if (NAV.some((n) => n.id === raw)) return raw as SectionId;
  return "leads";
}

function matchesQuery(haystack: string, q: string): boolean {
  if (!q) return true;
  return haystack.toLowerCase().includes(q.toLowerCase());
}

export function AdminPanel({
  pathSlug,
  configured,
  initialAuthed,
  initialLeads,
  initialDemos,
  initialBoards,
}: Props) {
  const [authed, setAuthed] = useState(initialAuthed);
  const [leads, setLeads] = useState(initialLeads);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [openChat, setOpenChat] = useState<ChatSessionDetail | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [demos, setDemos] = useState(initialDemos);
  const [boards, setBoards] = useState(initialBoards);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const [demoError, setDemoError] = useState("");
  const [boardBusy, setBoardBusy] = useState<string | null>(null);
  const [openBoardId, setOpenBoardId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");
  const [section, setSection] = useState<SectionId>("leads");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const apiBase = `/api/a/${pathSlug}`;

  useEffect(() => {
    setSection(readSectionFromHash());
    const onHash = () => setSection(readSectionFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.tagName === "SELECT" ||
        el?.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === "Escape" && menuOpen) setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function go(id: SectionId) {
    setSection(id);
    setQuery("");
    setMenuOpen(false);
    if (id !== "chats") setOpenChat(null);
    if (id === "chats") void refreshChats();
    window.history.replaceState(null, "", `#${id}`);
  }

  useEffect(() => {
    if (authed) void refreshChats();
    // только при входе / первой загрузке
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const counts = useMemo(
    () => ({
      all: leads.length,
      new: leads.filter((l) => l.status === "new").length,
      in_progress: leads.filter((l) => l.status === "in_progress").length,
      done: leads.filter((l) => l.status === "done").length,
      demosRunning: demos.filter((d) => d.status === "running").length,
      boards: boards.length,
      openWishes: boards.reduce(
        (sum, board) => sum + board.cards.filter((c) => c.status === "wish").length,
        0,
      ),
    }),
    [leads, demos, boards],
  );

  const visibleLeads = useMemo(() => {
    const q = query.trim();
    return leads.filter((lead) => {
      if (filter !== "all" && lead.status !== filter) return false;
      return matchesQuery(
        `${lead.name} ${lead.contact} ${lead.niche} ${lead.comment ?? ""}`,
        q,
      );
    });
  }, [leads, filter, query]);

  const visibleDemos = useMemo(() => {
    const q = query.trim();
    return demos.filter((demo) =>
      matchesQuery(
        `${demo.slug} ${demo.title} ${demo.niche} ${demo.note ?? ""}`,
        q,
      ),
    );
  }, [demos, query]);

  function navBadge(id: SectionId): number {
    if (id === "leads") return counts.new > 0 ? counts.new : counts.all;
    if (id === "chats") return chats.length;
    if (id === "boards") return counts.openWishes > 0 ? counts.openWishes : counts.boards;
    if (id === "outreach") return 0;
    return demos.length;
  }

  const visibleChats = useMemo(() => {
    const q = query.trim();
    return chats.filter((chat) =>
      matchesQuery(`${chat.preview} ${chat.ip} ${chat.id}`, q),
    );
  }, [chats, query]);

  async function refreshChats() {
    try {
      const res = await fetch(`${apiBase}/chats`);
      const json = await readJson<{ ok?: boolean; sessions?: ChatSummary[] }>(res);
      if (res.ok && json?.sessions) setChats(json.sessions);
    } catch {
      /* keep previous */
    }
  }

  async function openChatSession(id: string) {
    setChatBusy(true);
    try {
      const res = await fetch(`${apiBase}/chats?id=${encodeURIComponent(id)}`);
      const json = await readJson<{ ok?: boolean; session?: ChatSessionDetail }>(res);
      if (res.ok && json?.session) setOpenChat(json.session);
    } finally {
      setChatBusy(false);
    }
  }

  async function readJson<T>(res: Response): Promise<T | null> {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  async function refreshDemos() {
    try {
      const res = await fetch(`${apiBase}/demos`);
      const json = await readJson<{ ok?: boolean; demos?: DemoRow[] }>(res);
      if (res.ok && json?.demos) setDemos(json.demos);
    } catch {
      /* keep previous list */
    }
  }

  async function refreshBoards() {
    try {
      const res = await fetch(`${apiBase}/boards`);
      const json = await readJson<{ ok?: boolean; boards?: Board[] }>(res);
      if (res.ok && json?.boards) setBoards(json.boards);
    } catch {
      /* keep previous list — e.g. route not deployed yet */
    }
  }

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await readJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Ошибка входа");
      }

      const listRes = await fetch(`${apiBase}/leads`);
      const listJson = await readJson<{ ok?: boolean; leads?: Lead[] }>(listRes);
      setLeads(listJson?.leads ?? []);
      await refreshDemos();
      await refreshBoards();
      await refreshChats();
      setAuthed(true);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    await fetch(`${apiBase}/logout`, { method: "POST" });
    setAuthed(false);
    setLeads([]);
    setChats([]);
    setOpenChat(null);
    setDemos([]);
    setBoards([]);
    setMenuOpen(false);
  }

  async function onStatus(id: string, status: LeadStatus) {
    const prev = leads.find((l) => l.id === id)?.status;
    setLeads((list) =>
      list.map((lead) => (lead.id === id ? { ...lead, status } : lead)),
    );
    const res = await fetch(`${apiBase}/leads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok && prev) {
      setLeads((list) =>
        list.map((lead) => (lead.id === id ? { ...lead, status: prev } : lead)),
      );
    }
  }

  async function openDemoBoard(demo: DemoRow) {
    setBoardBusy(demo.slug);
    setDemoError("");
    try {
      const res = await fetch(`${apiBase}/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensureDemo: true,
          demoSlug: demo.slug,
          title: demo.title || demo.slug,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        board?: Board;
        created?: boolean;
      };
      if (!res.ok || !json.ok || !json.board) {
        throw new Error(json.error || "Не удалось открыть кабинет");
      }
      setBoards((prev) => {
        const exists = prev.some((board) => board.id === json.board!.id);
        return exists
          ? prev.map((board) => (board.id === json.board!.id ? json.board! : board))
          : [json.board!, ...prev];
      });
      setOpenBoardId(json.board.id);
      go("boards");
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBoardBusy(null);
    }
  }

  async function onDemoAction(demo: string, action: "start" | "stop") {
    setDemoBusy(demo);
    setDemoError("");
    try {
      const res = await fetch(`${apiBase}/demos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo, action }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        demo?: DemoRow;
      };
      if (!res.ok || !json.ok) throw new Error(json.error || "Не удалось");
      if (json.demo) {
        setDemos((prev) =>
          prev.map((d) => (d.slug === json.demo!.slug ? { ...d, ...json.demo! } : d)),
        );
        if (action === "start" && json.demo.url) {
          window.open(json.demo.url, "_blank", "noopener,noreferrer");
        }
      } else {
        await refreshDemos();
      }
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Ошибка");
      await refreshDemos();
    } finally {
      setDemoBusy(null);
    }
  }

  if (!configured) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1>Админка</h1>
          <p className={styles.hint}>
            Задайте <code>ADMIN_PATH</code> и <code>ADMIN_PASSWORD</code> в{" "}
            <code>.env.local</code>.
          </p>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className={styles.page}>
        <form className={styles.card} onSubmit={onLogin}>
          <h1>Вход</h1>
          <p className={styles.hint}>Кабинет RevenShare</p>
          <label className={styles.field}>
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              minLength={6}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Входим…" : "Войти"}
          </button>
          {error ? <p className={styles.error}>{error}</p> : null}
        </form>
      </main>
    );
  }

  const title = SECTION_TITLE[section];

  return (
    <div className={styles.shell}>
      {menuOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Закрыть"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
        aria-label="Разделы"
      >
        <p className={styles.brand}>RevenShare</p>
        <nav className={styles.nav}>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                section === item.id ? styles.navItemActive : styles.navItem
              }
              onClick={() => go(item.id)}
            >
              <span>{item.label}</span>
              <span className={styles.navCount}>{navBadge(item.id)}</span>
            </button>
          ))}
        </nav>
        <button type="button" className={styles.logout} onClick={onLogout}>
          Выйти
        </button>
      </aside>

      <div className={styles.main}>
        <header className={styles.bar}>
          <button
            type="button"
            className={`${styles.btn} ${styles.mobileToggle}`}
            onClick={() => setMenuOpen(true)}
          >
            Меню
          </button>
          <h1 className={styles.barTitle}>{title}</h1>

          {section !== "outreach" ? (
            <input
              ref={searchRef}
              className={styles.search}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={SEARCH_PLACEHOLDER[section]}
              aria-label="Поиск"
            />
          ) : null}

          {section === "leads" ? (
            <div className={styles.filters}>
              {(
                [
                  ["all", "Все", counts.all],
                  ["new", "Новые", counts.new],
                  ["in_progress", "В работе", counts.in_progress],
                  ["done", "Закрытые", counts.done],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  className={filter === key ? styles.chipOn : styles.chip}
                  onClick={() => setFilter(key)}
                >
                  {label} {n}
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.barRight}>
            <span className={styles.meta}>
              {section === "leads"
                ? `${visibleLeads.length} из ${leads.length}`
                : section === "chats"
                  ? `${visibleChats.length} из ${chats.length}`
                  : section === "demos"
                    ? `${counts.demosRunning} online · ${visibleDemos.length}`
                    : section === "boards"
                      ? `${counts.openWishes} пожеланий · ${boards.length}`
                      : "Checko → email → письмо"}
            </span>
            {section === "demos" ? (
              <button type="button" className={styles.btn} onClick={() => refreshDemos()}>
                Обновить
              </button>
            ) : null}
            {section === "chats" ? (
              <button type="button" className={styles.btn} onClick={() => refreshChats()}>
                Обновить
              </button>
            ) : null}
            {section === "boards" ? (
              <button type="button" className={styles.btn} onClick={() => refreshBoards()}>
                Обновить
              </button>
            ) : null}
          </div>
        </header>

        <div className={styles.body}>
          {section === "leads" ? (
            visibleLeads.length === 0 ? (
              <p className={styles.empty}>
                {leads.length === 0
                  ? "Заявок пока нет"
                  : "Ничего не найдено"}
              </p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.colWhen}>Когда</th>
                    <th>Имя</th>
                    <th className={styles.colContact}>Контакт</th>
                    <th className={styles.colNiche}>Ниша</th>
                    <th className={styles.colStatus}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td className={styles.faint}>
                        <time dateTime={lead.createdAt}>
                          {formatDate(lead.createdAt)}
                        </time>
                      </td>
                      <td>
                        <span className={styles.strong}>{lead.name}</span>
                        {lead.comment ? (
                          <span className={styles.sub} title={lead.comment}>
                            {lead.comment}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <a className={styles.link} href={contactHref(lead.contact)}>
                          {lead.contact}
                        </a>
                      </td>
                      <td className={styles.muted}>{lead.niche}</td>
                      <td>
                        <select
                          className={styles.statusSelect}
                          value={lead.status}
                          aria-label={`Статус ${lead.name}`}
                          onChange={(e) =>
                            onStatus(lead.id, e.target.value as LeadStatus)
                          }
                        >
                          {(Object.keys(STATUS_LABEL) as LeadStatus[]).map(
                            (s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}

          {section === "chats" ? (
            openChat ? (
              <div>
                <div className={styles.actions} style={{ marginBottom: "0.75rem" }}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => setOpenChat(null)}
                  >
                    ← К списку
                  </button>
                  <span className={styles.meta}>
                    {openChat.ip} · {openChat.messages.length} сообщ. ·{" "}
                    {formatDate(openChat.updatedAt)}
                  </span>
                </div>
                <div className={styles.chatThread}>
                  {openChat.messages.map((m, i) => (
                    <div
                      key={`${m.at}-${i}`}
                      className={
                        m.role === "user" ? styles.chatUser : styles.chatBot
                      }
                    >
                      <span className={styles.chatRole}>
                        {m.role === "user" ? "Посетитель" : "Бот"}
                        {m.weak ? " · слабый ответ" : ""}
                      </span>
                      <p className={styles.chatText}>{m.content}</p>
                      <time className={styles.faint} dateTime={m.at}>
                        {formatDate(m.at)}
                      </time>
                    </div>
                  ))}
                </div>
              </div>
            ) : visibleChats.length === 0 ? (
              <p className={styles.empty}>
                {chats.length === 0 ? "Чатов пока нет" : "Ничего не найдено"}
              </p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.colWhen}>Когда</th>
                    <th>Превью</th>
                    <th>IP</th>
                    <th className={styles.colStatus}>Сообщ.</th>
                    <th className={styles.right}> </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleChats.map((chat) => (
                    <tr key={chat.id}>
                      <td className={styles.faint}>
                        <time dateTime={chat.updatedAt}>
                          {formatDate(chat.updatedAt)}
                        </time>
                      </td>
                      <td>
                        <span className={styles.strong} title={chat.preview}>
                          {chat.preview}
                        </span>
                      </td>
                      <td className={styles.mono}>{chat.ip}</td>
                      <td className={styles.muted}>{chat.messageCount}</td>
                      <td className={styles.right}>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={chatBusy}
                          onClick={() => openChatSession(chat.id)}
                        >
                          Открыть
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}

          {section === "demos" ? (
            <>
              {demoError ? <p className={styles.error} style={{ padding: "0.75rem" }}>{demoError}</p> : null}
              {visibleDemos.length === 0 ? (
                <p className={styles.empty}>
                  {demos.length === 0
                    ? "demo-workspace пуста"
                    : "Ничего не найдено"}
                </p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Проект</th>
                      <th className={styles.colSlug}>Slug</th>
                      <th className={styles.colStatus}>Статус</th>
                      <th className={styles.colPort}>Порт</th>
                      <th className={`${styles.right} ${styles.colActions}`}>
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDemos.map((demo) => {
                      const busy = demoBusy === demo.slug;
                      const running =
                        demo.status === "running" || demo.status === "starting";
                      return (
                        <tr key={demo.slug}>
                          <td>
                            <span className={styles.strong}>{demo.title}</span>
                            {demo.niche ? (
                              <span className={styles.sub} title={demo.niche}>
                                {demo.niche}
                              </span>
                            ) : null}
                            {demo.status === "running" ? (
                              <a
                                className={`${styles.sub} ${styles.link}`}
                                href={demo.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {demo.url}
                              </a>
                            ) : null}
                            {demo.error ? (
                              <span className={styles.sub} style={{ color: "var(--danger)" }}>
                                {demo.error}
                              </span>
                            ) : null}
                          </td>
                          <td className={styles.mono}>{demo.slug}</td>
                          <td>
                            <span
                              className={
                                demo.status === "running"
                                  ? styles.dotOk
                                  : demo.status === "error"
                                    ? styles.dotErr
                                    : demo.status === "starting"
                                      ? styles.dotWarn
                                      : styles.dot
                              }
                            >
                              {DEMO_STATUS_LABEL[demo.status]}
                            </span>
                          </td>
                          <td className={styles.mono}>{demo.port ?? "—"}</td>
                          <td className={styles.right}>
                            <div className={styles.actions}>
                              {running ? (
                                <button
                                  type="button"
                                  className={styles.btn}
                                  disabled={busy || demo.status === "starting"}
                                  onClick={() => onDemoAction(demo.slug, "stop")}
                                >
                                  {busy ? "…" : "Стоп"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.btnPrimary}
                                  disabled={busy}
                                  onClick={() => onDemoAction(demo.slug, "start")}
                                >
                                  {busy ? "…" : "Старт"}
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.btn}
                                disabled={boardBusy === demo.slug}
                                onClick={() => openDemoBoard(demo)}
                              >
                                {boardBusy === demo.slug ? "…" : "Заявки"}
                              </button>
                              {demo.status === "running" ? (
                                <a href={demo.url} target="_blank" rel="noreferrer">
                                  Открыть
                                </a>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          ) : null}

          {section === "boards" ? (
            <AdminBoards
              apiBase={apiBase}
              boards={boards}
              query={query}
              openBoardId={openBoardId}
              onBoardsChange={setBoards}
              onOpenBoardHandled={() => setOpenBoardId(null)}
            />
          ) : null}

          {section === "outreach" ? (
            <AdminOutreach apiBase={apiBase} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function contactHref(contact: string): string {
  const digits = contact.replace(/[^\d+]/g, "");
  if (digits) return `tel:${digits}`;
  return "#";
}
