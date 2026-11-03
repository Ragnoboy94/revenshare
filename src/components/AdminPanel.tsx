"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DemoPublic } from "@/lib/demo-public";
import type { Lead, LeadStatus } from "@/lib/leads-store";
import styles from "./AdminPanel.module.css";

type DemoRow = DemoPublic;
type SectionId = "leads" | "demos";

type NavItem = {
  id: SectionId;
  label: string;
};

/** Add sections here — sidebar stays flat and short. */
const NAV: NavItem[] = [
  { id: "leads", label: "Заявки" },
  { id: "demos", label: "Демо" },
];

type Props = {
  pathSlug: string;
  configured: boolean;
  initialAuthed: boolean;
  initialLeads: Lead[];
  initialDemos: DemoRow[];
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
  demos: "Slug или название…",
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
}: Props) {
  const [authed, setAuthed] = useState(initialAuthed);
  const [leads, setLeads] = useState(initialLeads);
  const [demos, setDemos] = useState(initialDemos);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const [demoError, setDemoError] = useState("");
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
    window.history.replaceState(null, "", `#${id}`);
  }

  const counts = useMemo(
    () => ({
      all: leads.length,
      new: leads.filter((l) => l.status === "new").length,
      in_progress: leads.filter((l) => l.status === "in_progress").length,
      done: leads.filter((l) => l.status === "done").length,
      demosRunning: demos.filter((d) => d.status === "running").length,
    }),
    [leads, demos],
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
    return demos.length;
  }

  async function refreshDemos() {
    const res = await fetch(`${apiBase}/demos`);
    const json = (await res.json()) as { ok?: boolean; demos?: DemoRow[] };
    if (res.ok && json.demos) setDemos(json.demos);
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
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Ошибка входа");

      const listRes = await fetch(`${apiBase}/leads`);
      const listJson = (await listRes.json()) as { ok?: boolean; leads?: Lead[] };
      setLeads(listJson.leads ?? []);
      await refreshDemos();
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
    setDemos([]);
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

  const title = section === "leads" ? "Заявки" : "Демо";

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

          <input
            ref={searchRef}
            className={styles.search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={SEARCH_PLACEHOLDER[section]}
            aria-label="Поиск"
          />

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
                : `${counts.demosRunning} online · ${visibleDemos.length}`}
            </span>
            {section === "demos" ? (
              <button type="button" className={styles.btn} onClick={() => refreshDemos()}>
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
