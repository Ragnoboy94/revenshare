"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  OutreachContact,
  OutreachContactFilter,
  OutreachSendLog,
} from "@/lib/outreach-store";
import type { OutreachUnsubRecord } from "@/lib/outreach-unsubscribe";
import styles from "./AdminOutreach.module.css";

type MailStatus = {
  configured: boolean;
  from: string;
  host: string;
  testMode: boolean;
  overrideTo?: string;
};

type Meta = {
  lastScanAt?: string;
  lastEnrichAt?: string;
  lastScanMeta?: {
    from?: string;
    to?: string;
    found?: number;
    added?: number;
    error?: string;
  };
  counts: {
    all: number;
    withEmail: number;
    pending: number;
    sent: number;
  };
};

type SettingsView = {
  checko: {
    profileDirName: string;
    profileFound: boolean;
    browsersFound: boolean;
    delayMs: number;
    enrichDelayMs: number;
    enrichPerJob: number;
    maxPages: number;
    headed: boolean;
  };
  send: {
    sendDelayMs: number;
    sendBatchLimit: number;
  };
  smtp: {
    configured: boolean;
    host: string;
    from: string;
    testMode: boolean;
    overrideTo: string;
    operatorEmail: string;
  };
  letter: {
    subjectTemplate: string;
    textTemplate: string;
  };
  schedule: {
    enabled: boolean;
    intervalMinutes: number;
    autoScan: boolean;
    autoEnrich: boolean;
    autoSend: boolean;
    sendPerTick: number;
  };
  scheduleState: {
    lastTickAt?: string;
    nextTickAt?: string;
    lastOk?: boolean;
    lastSummary?: string;
    schedulerArmed: boolean;
    schedulerDisabledByEnv: boolean;
  };
  tickPreview?: TickPreview;
};

type JobStatus = {
  running: boolean;
  action?: string;
  startedAt?: string;
  message?: string;
  finishedAt?: string;
  lastError?: string;
};

type ContactIndexItem = {
  id: string;
  email?: string;
  status: OutreachContact["status"];
  shortName?: string;
  name: string;
};

type Letter = { subject: string; text: string; html?: string };

type ViewId =
  | "workspace"
  | "prep"
  | "history"
  | "unsub"
  | "schedule"
  | "settings";

type TickPreview = {
  schedulerArmed: boolean;
  schedulerDisabledByEnv: boolean;
  scheduleEnabled: boolean;
  intervalMinutes: number;
  steps: Array<{ id: string; label: string; enabled: boolean; detail: string }>;
  candidatesReady: number;
  sendPerTick: number;
  smtpConfigured: boolean;
  overrideTo: string;
  testMode: boolean;
  checkoProfileFound: boolean;
  browsersFound: boolean;
  lastTickAt?: string;
  nextTickAt?: string;
  warnings: string[];
};

type TickResult = {
  at: string;
  ok: boolean;
  skippedReason?: string;
  scan?: { ok: boolean; found: number; added: number; error?: string };
  enrich?: {
    ok: boolean;
    processed: number;
    withEmail: number;
    error?: string;
  };
  send?: {
    ok: boolean;
    sent: number;
    failed: number;
    skipped: number;
    errors: string[];
  };
  error?: string;
};

type Props = {
  apiBase: string;
};

const STATUS_UI: Record<
  OutreachContact["status"],
  { label: string; badge: string }
> = {
  pending_enrich: { label: "Ожидает email", badge: styles.badgeWarn },
  has_email: { label: "Email найден", badge: styles.badgeOk },
  no_email: { label: "Email не найден", badge: styles.badgeMute },
  sent: { label: "Отправлено", badge: styles.badgeOk },
  failed: { label: "Ошибка отправки", badge: styles.badgeDanger },
  skipped: { label: "Пропущен", badge: styles.badgeMute },
};

const NAV: { id: ViewId; label: string }[] = [
  { id: "workspace", label: "Рассылка" },
  { id: "prep", label: "Подготовка" },
  { id: "schedule", label: "Расписание" },
  { id: "history", label: "История" },
  { id: "unsub", label: "Отписки" },
  { id: "settings", label: "Настройки" },
];

function formatDate(iso?: string): string {
  if (!iso) return "—";
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

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function AdminOutreach({ apiBase }: Props) {
  const [view, setView] = useState<ViewId>("workspace");
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [contactIndex, setContactIndex] = useState<ContactIndexItem[]>([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filter, setFilter] = useState<OutreachContactFilter>("all");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [sends, setSends] = useState<OutreachSendLog[]>([]);
  const [unsubscribed, setUnsubscribed] = useState<OutreachUnsubRecord[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [mail, setMail] = useState<MailStatus | null>(null);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [letter, setLetter] = useState<Letter | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [processResult, setProcessResult] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendResult, setSendResult] = useState<{
    sent: number;
    failed: number;
    skipped: number;
  } | null>(null);
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "ok" | "fail" | "test"
  >("all");
  const [historyQ, setHistoryQ] = useState("");
  const [historyDetail, setHistoryDetail] = useState<string | null>(null);
  const [unsubQ, setUnsubQ] = useState("");
  const [editDelayMs, setEditDelayMs] = useState(1800);
  const [editEnrichDelayMs, setEditEnrichDelayMs] = useState(9000);
  const [editEnrichPerJob, setEditEnrichPerJob] = useState(12);
  const [editMaxPages, setEditMaxPages] = useState(40);
  const [editHeaded, setEditHeaded] = useState(false);
  const [editSendDelayMs, setEditSendDelayMs] = useState(1500);
  const [editSendBatchLimit, setEditSendBatchLimit] = useState(50);
  const [editOperatorEmail, setEditOperatorEmail] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editText, setEditText] = useState("");
  const [editScheduleEnabled, setEditScheduleEnabled] = useState(false);
  const [editIntervalMinutes, setEditIntervalMinutes] = useState(60);
  const [editAutoScan, setEditAutoScan] = useState(true);
  const [editAutoEnrich, setEditAutoEnrich] = useState(true);
  const [editAutoSend, setEditAutoSend] = useState(false);
  const [editSendPerTick, setEditSendPerTick] = useState(10);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const settingsDirtyRef = useRef(false);
  settingsDirtyRef.current = settingsDirty;
  const [tickPreview, setTickPreview] = useState<TickPreview | null>(null);
  const [lastTickResult, setLastTickResult] = useState<TickResult | null>(null);
  const [letterDraftPreview, setLetterDraftPreview] = useState<Letter | null>(
    null,
  );
  const [letterEditorOpen, setLetterEditorOpen] = useState(false);
  const [templatePreviewMode, setTemplatePreviewMode] = useState<
    "html" | "text"
  >("html");

  const unsubEmails = useMemo(
    () => new Set(unsubscribed.map((u) => u.email.toLowerCase())),
    [unsubscribed],
  );

  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, on]) => on)
        .map(([id]) => id),
    [selected],
  );

  const selectedReadyIds = useMemo(() => {
    const byId = new Map(contactIndex.map((c) => [c.id, c]));
    return selectedIds.filter((id) => {
      const c = byId.get(id);
      if (!c?.email) return false;
      if (unsubEmails.has(c.email.toLowerCase())) return false;
      return true;
    });
  }, [selectedIds, contactIndex, unsubEmails]);

  const selectedOnPage = useMemo(
    () => contacts.filter((c) => selected[c.id]).length,
    [contacts, selected],
  );

  const hiddenSelected = Math.max(0, selectedIds.length - selectedOnPage);

  const applyPayload = useCallback(
    (json: {
      contacts?: OutreachContact[];
      contactsTotal?: number;
      contactsPage?: number;
      contactsPageSize?: number;
      contactIndex?: ContactIndexItem[];
      meta?: Meta;
      sends?: OutreachSendLog[];
      unsubscribed?: OutreachUnsubRecord[];
      mail?: MailStatus;
      letter?: Letter;
      settings?: SettingsView;
      job?: JobStatus;
    }) => {
      if (json.contacts) setContacts(json.contacts);
      if (typeof json.contactsTotal === "number")
        setContactsTotal(json.contactsTotal);
      if (typeof json.contactsPage === "number") setPage(json.contactsPage);
      if (typeof json.contactsPageSize === "number")
        setPageSize(json.contactsPageSize);
      if (json.contactIndex) setContactIndex(json.contactIndex);
      if (json.meta) setMeta(json.meta);
      if (json.sends) setSends(json.sends);
      if (json.unsubscribed) setUnsubscribed(json.unsubscribed);
      if (json.mail) setMail(json.mail);
      if (json.letter) setLetter(json.letter);
      if (json.settings) {
        setSettings(json.settings);
        // ref: после save dirty сбрасывается, но state в closure ещё true
        if (!settingsDirtyRef.current) {
          setEditDelayMs(json.settings.checko.delayMs);
          setEditEnrichDelayMs(json.settings.checko.enrichDelayMs);
          setEditEnrichPerJob(json.settings.checko.enrichPerJob);
          setEditMaxPages(json.settings.checko.maxPages);
          setEditHeaded(json.settings.checko.headed);
          setEditSendDelayMs(json.settings.send.sendDelayMs);
          setEditSendBatchLimit(json.settings.send.sendBatchLimit);
          setEditOperatorEmail(json.settings.smtp.operatorEmail);
          setEditSubject(json.settings.letter.subjectTemplate);
          setEditText(json.settings.letter.textTemplate);
          setEditScheduleEnabled(json.settings.schedule.enabled);
          setEditIntervalMinutes(json.settings.schedule.intervalMinutes);
          setEditAutoScan(json.settings.schedule.autoScan);
          setEditAutoEnrich(json.settings.schedule.autoEnrich);
          setEditAutoSend(json.settings.schedule.autoSend);
          setEditSendPerTick(json.settings.schedule.sendPerTick);
        }
        if (json.settings.tickPreview) {
          setTickPreview(json.settings.tickPreview);
        }
      }
      if (json.job) setJob(json.job);
    },
    [],
  );

  const refresh = useCallback(
    async (opts?: {
      page?: number;
      pageSize?: number;
      filter?: OutreachContactFilter;
      q?: string;
    }) => {
      const p = opts?.page ?? page;
      const ps = opts?.pageSize ?? pageSize;
      const f = opts?.filter ?? filter;
      const query = opts?.q ?? q;
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(ps),
        filter: f,
        q: query,
      });
      const res = await fetch(`${apiBase}/outreach?${params}`);
      const json = await readJson<{
        ok?: boolean;
        error?: string;
        contacts?: OutreachContact[];
        contactsTotal?: number;
        contactsPage?: number;
        contactsPageSize?: number;
        contactIndex?: ContactIndexItem[];
        meta?: Meta;
        sends?: OutreachSendLog[];
        unsubscribed?: OutreachUnsubRecord[];
        mail?: MailStatus;
        letter?: Letter;
        settings?: SettingsView;
        job?: JobStatus;
      }>(res);
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Не удалось загрузить рассылку");
        return;
      }
      applyPayload(json);
      setError("");
    },
    [apiBase, page, pageSize, filter, q, applyPayload],
  );

  useEffect(() => {
    void refresh();
  }, [apiBase]); // eslint-disable-line react-hooks/exhaustive-deps -- initial

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  async function saveSettings() {
    setBusy("save_settings");
    setError("");
    try {
      const res = await fetch(`${apiBase}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_settings",
          page,
          pageSize,
          filter,
          q,
          settings: {
            delayMs: editDelayMs,
            enrichDelayMs: editEnrichDelayMs,
            enrichPerJob: editEnrichPerJob,
            maxPages: editMaxPages,
            headed: editHeaded,
            sendDelayMs: editSendDelayMs,
            sendBatchLimit: editSendBatchLimit,
            operatorEmail: editOperatorEmail,
            letter: {
              subjectTemplate: editSubject,
              textTemplate: editText,
            },
            schedule: {
              enabled: editScheduleEnabled,
              intervalMinutes: editIntervalMinutes,
              autoScan: editAutoScan,
              autoEnrich: editAutoEnrich,
              autoSend: editAutoSend,
              sendPerTick: editSendPerTick,
            },
          },
        }),
      });
      const json = await readJson<{
        ok?: boolean;
        error?: string;
        settings?: SettingsView;
        letter?: Letter;
      }>(res);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Не удалось сохранить");
        return;
      }
      settingsDirtyRef.current = false;
      setSettingsDirty(false);
      if (json?.settings) {
        setSettings(json.settings);
        setEditSubject(json.settings.letter.subjectTemplate);
        setEditText(json.settings.letter.textTemplate);
      }
      if (json?.letter) setLetter(json.letter);
      setInfo("Настройки сохранены");
      await refresh();
      if (view === "schedule") {
        // обновить проверку после сохранения
        const prevBusy = "schedule_preview";
        setBusy(prevBusy);
        try {
          const prevRes = await fetch(`${apiBase}/outreach`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "schedule_preview" }),
          });
          const prevJson = await readJson<{
            ok?: boolean;
            preview?: TickPreview;
            settings?: SettingsView;
          }>(prevRes);
          if (prevJson?.preview) setTickPreview(prevJson.preview);
          if (prevJson?.settings) setSettings(prevJson.settings);
        } finally {
          setBusy(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (view !== "schedule") return;
    void runAction("schedule_preview");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [view]);

  useEffect(() => {
    if (view !== "settings") return;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`${apiBase}/outreach`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "preview_letter",
              letterDraft: {
                subjectTemplate: editSubject,
                textTemplate: editText,
              },
            }),
          });
          const json = await readJson<{ ok?: boolean; letter?: Letter }>(res);
          if (json?.letter) setLetterDraftPreview(json.letter);
        } catch {
          /* ignore draft preview errors */
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [view, editSubject, editText, apiBase]);

  async function runAction(
    action:
      | "scan"
      | "enrich"
      | "send"
      | "test_send"
      | "probe"
      | "retry_send"
      | "tick"
      | "schedule_preview",
    extra?: { contactIds?: string[]; contactId?: string },
  ) {
    setBusy(action);
    setError("");
    setInfo("");
    try {
      const res = await fetch(`${apiBase}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          page,
          pageSize,
          filter,
          q,
          contactIds: extra?.contactIds,
          contactId: extra?.contactId,
        }),
      });
      const json = await readJson<{
        ok?: boolean;
        error?: string;
        contacts?: OutreachContact[];
        contactsTotal?: number;
        contactIndex?: ContactIndexItem[];
        meta?: Meta;
        sends?: OutreachSendLog[];
        unsubscribed?: OutreachUnsubRecord[];
        mail?: MailStatus;
        letter?: Letter;
        settings?: SettingsView;
        job?: JobStatus;
        result?: {
          added?: number;
          found?: number;
          processed?: number;
          withEmail?: number;
          error?: string;
        };
        sent?: number;
        failed?: number;
        skipped?: number;
        errors?: string[];
        testTo?: string;
        tick?: TickResult;
        preview?: TickPreview;
      }>(res);

      if (json) applyPayload(json);

      if (!res.ok || json?.ok === false) {
        setError(json?.error || json?.result?.error || "Ошибка");
        return;
      }

      if (action === "scan") {
        const msg = `Сканирование завершено · найдено ${json?.result?.found ?? 0} · новых ${json?.result?.added ?? 0}`;
        setProcessResult(msg);
        setInfo(msg);
      } else if (action === "enrich") {
        setProcessResult(
          `Email: обработано ${json?.result?.processed ?? 0}, с почтой ${json?.result?.withEmail ?? 0}`,
        );
        setInfo(
          `Email: обработано ${json?.result?.processed ?? 0}, с почтой ${json?.result?.withEmail ?? 0}`,
        );
      } else if (action === "send" || action === "retry_send") {
        setSendResult({
          sent: json?.sent ?? 0,
          failed: json?.failed ?? 0,
          skipped: json?.skipped ?? 0,
        });
        setInfo(
          `Отправлено ${json?.sent ?? 0} из ${(json?.sent ?? 0) + (json?.failed ?? 0)} · пропуск ${json?.skipped ?? 0}`,
        );
        setConfirmOpen(false);
      } else if (action === "test_send") {
        setInfo(`Тестовое письмо отправлено на ${json?.testTo ?? "оператора"}`);
      } else if (action === "probe") {
        setInfo("Проверка Checko: профиль и браузер найдены");
      } else if (action === "schedule_preview") {
        if (json?.preview) setTickPreview(json.preview);
        setInfo("Проверка расписания обновлена (без отправки)");
      } else if (action === "tick") {
        if (json?.tick) setLastTickResult(json.tick);
        setInfo(
          json?.tick?.skippedReason ||
            `Тик выполнен${json?.tick?.send?.sent != null ? ` · отправлено ${json.tick.send.sent}` : ""}`,
        );
        await refresh();
      }

      if (json?.errors?.length) setError(json.errors.slice(0, 3).join("; "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка запроса");
    } finally {
      setBusy(null);
    }
  }

  function setFilterAndLoad(next: OutreachContactFilter) {
    setFilter(next);
    setPage(1);
    void refresh({ filter: next, page: 1 });
  }

  function goWorkspaceWithFilter(next: OutreachContactFilter) {
    setView("workspace");
    setFilterAndLoad(next);
  }

  function toggleAllPage(on: boolean) {
    const next = { ...selected };
    for (const c of contacts) {
      if (!c.email) continue;
      if (unsubEmails.has(c.email.toLowerCase())) continue;
      next[c.id] = on;
    }
    setSelected(next);
  }

  function clearSelection() {
    setSelected({});
  }

  const pageCount = Math.max(1, Math.ceil(contactsTotal / pageSize));

  const stateLine = busy
    ? busy === "scan"
      ? "Сканирование Checko…"
      : busy === "enrich"
        ? "Получение email…"
        : busy === "send" || busy === "retry_send"
          ? "Отправка…"
          : busy === "test_send"
            ? "Тестовое письмо…"
            : "Выполняется…"
    : job?.running
      ? job.message || "Выполняется…"
      : "Готово к работе";

  const historyRows = useMemo(() => {
    const qq = historyQ.trim().toLowerCase();
    return sends.filter((s) => {
      if (historyFilter === "ok" && !s.ok) return false;
      if (historyFilter === "fail" && s.ok) return false;
      if (historyFilter === "test" && !s.testMode) return false;
      if (!qq) return true;
      return `${s.to} ${s.deliveredTo ?? ""} ${s.companyName ?? ""} ${s.subject}`
        .toLowerCase()
        .includes(qq);
    });
  }, [sends, historyFilter, historyQ]);

  const unsubRows = useMemo(() => {
    const qq = unsubQ.trim().toLowerCase();
    if (!qq) return unsubscribed;
    return unsubscribed.filter((u) =>
      `${u.email} ${u.companyName ?? ""}`.toLowerCase().includes(qq),
    );
  }, [unsubscribed, unsubQ]);

  const selectedContactsForPrep = useMemo(() => {
    const byId = new Map(contactIndex.map((c) => [c.id, c]));
    return selectedReadyIds
      .map((id) => byId.get(id))
      .filter(Boolean) as ContactIndexItem[];
  }, [selectedReadyIds, contactIndex]);

  const blockedSelected = useMemo(() => {
    const byId = new Map(contactIndex.map((c) => [c.id, c]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((c): c is ContactIndexItem => {
        if (!c) return false;
        if (!c.email) return true;
        if (unsubEmails.has(c.email.toLowerCase())) return true;
        return false;
      });
  }, [selectedIds, contactIndex, unsubEmails]);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h2 className={styles.title}>Рассылка</h2>
          <p className={styles.stateLine}>{stateLine}</p>
        </div>
        <div className={styles.headerRight}>
          <span
            className={`${styles.pill} ${mail?.configured ? styles.pillOk : styles.pillWarn}`}
          >
            SMTP: {mail?.configured ? mail.host || "ok" : "не настроен"}
          </span>
          <span
            className={`${styles.pill} ${mail?.overrideTo || mail?.testMode ? styles.pillWarn : styles.pillOk}`}
          >
            {mail?.testMode
              ? "Режим: TEST"
              : mail?.overrideTo
                ? `Override → ${mail.overrideTo}`
                : "Режим: реальный"}
          </span>
          <button
            type="button"
            className={styles.btn}
            disabled={busy !== null}
            onClick={() => refresh()}
          >
            Обновить
          </button>
        </div>
        <div className={styles.stats}>
          <button
            type="button"
            className={styles.statBtn}
            onClick={() => goWorkspaceWithFilter("all")}
          >
            Всего {meta?.counts.all ?? "—"}
          </button>
          <span className={styles.statSep}>·</span>
          <button
            type="button"
            className={styles.statBtn}
            onClick={() => goWorkspaceWithFilter("email")}
          >
            С email {meta?.counts.withEmail ?? "—"}
          </button>
          <span className={styles.statSep}>·</span>
          <button
            type="button"
            className={styles.statBtn}
            onClick={() => goWorkspaceWithFilter("sent")}
          >
            Отправлено {meta?.counts.sent ?? "—"}
          </button>
          <span className={styles.statSep}>·</span>
          <button
            type="button"
            className={styles.statBtn}
            onClick={() => setView("unsub")}
          >
            Отписки {unsubscribed.length}
          </button>
          <span className={styles.statSep}>·</span>
          <span className={styles.statBtn} style={{ cursor: "default" }}>
            Выбрано {selectedReadyIds.length}
          </span>
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Разделы рассылки">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? styles.navBtnOn : styles.navBtn}
              onClick={() => setView(item.id)}
            >
              {item.id === "unsub"
                ? `${item.label} (${unsubscribed.length})`
                : item.id === "prep"
                  ? `${item.label}${selectedReadyIds.length ? ` · ${selectedReadyIds.length}` : ""}`
                  : item.label}
            </button>
          ))}
        </nav>

        <div className={styles.main}>
          {error ? <p className={styles.error}>{error}</p> : null}
          {info ? <p className={styles.info}>{info}</p> : null}

          {view === "workspace" ? (
            <>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3 className={styles.cardTitle}>
                      Поиск новых организаций
                    </h3>
                    <p className={styles.cardHint}>
                      Последнее сканирование: {formatDate(meta?.lastScanAt)} ·
                      Enrich: {formatDate(meta?.lastEnrichAt)}
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={busy !== null}
                      onClick={() => runAction("scan")}
                    >
                      {busy === "scan" ? "Скан…" : "Сканировать Checko"}
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={
                        busy !== null || (meta?.counts.pending ?? 0) === 0
                      }
                      onClick={() => runAction("enrich")}
                    >
                      {busy === "enrich"
                        ? "Email…"
                        : `Получить email (${meta?.counts.pending ?? 0})`}
                    </button>
                  </div>
                </div>
                {busy === "scan" || busy === "enrich" ? (
                  <div className={styles.busyBox}>
                    Выполняется · {stateLine}
                    {job?.startedAt
                      ? ` · с ${formatDate(job.startedAt)}`
                      : ""}
                  </div>
                ) : null}
                {processResult ? (
                  <div className={styles.resultBox}>
                    {processResult}
                    <div style={{ marginTop: "0.45rem" }}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => setFilterAndLoad("pending")}
                      >
                        Показать ожидающие email
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={styles.toolbar}>
                <input
                  className={styles.search}
                  type="search"
                  value={qDraft}
                  placeholder="Компания, ИНН, ОГРН, email…"
                  onChange={(e) => setQDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setQ(qDraft);
                      setPage(1);
                      void refresh({ q: qDraft, page: 1 });
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    setQ(qDraft);
                    setPage(1);
                    void refresh({ q: qDraft, page: 1 });
                  }}
                >
                  Найти
                </button>
                <div className={styles.segments}>
                  {(
                    [
                      ["all", "Все"],
                      ["email", "С email"],
                      ["no_email", "Без email"],
                      ["pending", "Ожидает email"],
                      ["sent", "Отправлено"],
                      ["failed", "Ошибки"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={filter === key ? styles.segOn : styles.seg}
                      onClick={() => setFilterAndLoad(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {contacts.length === 0 ? (
                <p className={styles.empty}>
                  {contactsTotal === 0
                    ? "Список пуст — запустите сканирование Checko"
                    : "Ничего не найдено"}
                </p>
              ) : (
                <>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.colCheck}>
                            <input
                              type="checkbox"
                              aria-label="Выбрать все на странице"
                              checked={
                                contacts.filter(
                                  (c) =>
                                    c.email &&
                                    !unsubEmails.has(c.email.toLowerCase()),
                                ).length > 0 &&
                                contacts
                                  .filter(
                                    (c) =>
                                      c.email &&
                                      !unsubEmails.has(
                                        c.email.toLowerCase(),
                                      ),
                                  )
                                  .every((c) => selected[c.id])
                              }
                              onChange={(e) =>
                                toggleAllPage(e.target.checked)
                              }
                            />
                          </th>
                          <th>Компания</th>
                          <th>Email</th>
                          <th className={styles.colStatus}>Статус</th>
                          <th className={styles.colDate}>Добавлен</th>
                          <th className={styles.colActions} />
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map((c) => {
                          const unsubbed = Boolean(
                            c.email &&
                              unsubEmails.has(c.email.toLowerCase()),
                          );
                          const st = STATUS_UI[c.status];
                          return (
                            <tr key={c.id}>
                              <td className={styles.colCheck}>
                                <input
                                  type="checkbox"
                                  disabled={!c.email || unsubbed}
                                  checked={
                                    Boolean(selected[c.id]) && !unsubbed
                                  }
                                  onChange={(e) =>
                                    setSelected((prev) => ({
                                      ...prev,
                                      [c.id]: e.target.checked,
                                    }))
                                  }
                                  aria-label={`Выбрать ${c.name}`}
                                />
                              </td>
                              <td>
                                <div className={styles.company}>
                                  <span className={styles.companyName}>
                                    {c.shortName || c.name}
                                  </span>
                                  <span className={styles.companyMeta}>
                                    {c.inn ? `ИНН ${c.inn} · ` : ""}
                                    ОГРН {c.ogrn}
                                  </span>
                                </div>
                              </td>
                              <td className={styles.emailCell}>
                                {c.email ? (
                                  <a
                                    className={styles.link}
                                    href={`mailto:${c.email}`}
                                  >
                                    {c.email}
                                  </a>
                                ) : (
                                  <span className={styles.companyMeta}>
                                    {c.status === "no_email"
                                      ? "не найден"
                                      : "—"}
                                  </span>
                                )}
                                {unsubbed ? (
                                  <div className={styles.companyMeta}>
                                    отписка
                                  </div>
                                ) : null}
                                {c.status === "failed" && c.lastError ? (
                                  <div
                                    className={styles.companyMeta}
                                    title={c.lastError}
                                  >
                                    {c.lastError}
                                  </div>
                                ) : null}
                              </td>
                              <td>
                                <span
                                  className={`${styles.badge} ${st.badge}`}
                                >
                                  {unsubbed ? "Отписка" : st.label}
                                </span>
                              </td>
                              <td className={styles.companyMeta}>
                                {formatDate(c.scannedAt)}
                              </td>
                              <td>
                                <div className={styles.actions}>
                                  {c.url ? (
                                    <a
                                      className={styles.iconBtn}
                                      href={c.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Открыть Checko"
                                      style={{
                                        display: "inline-grid",
                                        placeItems: "center",
                                        textDecoration: "none",
                                      }}
                                    >
                                      ↗
                                    </a>
                                  ) : null}
                                  {c.email ? (
                                    <button
                                      type="button"
                                      className={styles.iconBtn}
                                      title="Копировать email"
                                      onClick={() =>
                                        void navigator.clipboard.writeText(
                                          c.email!,
                                        )
                                      }
                                    >
                                      ⎘
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.cardsMobile}>
                    {contacts.map((c) => {
                      const unsubbed = Boolean(
                        c.email && unsubEmails.has(c.email.toLowerCase()),
                      );
                      const st = STATUS_UI[c.status];
                      return (
                        <div key={c.id} className={styles.contactCard}>
                          <input
                            type="checkbox"
                            disabled={!c.email || unsubbed}
                            checked={Boolean(selected[c.id]) && !unsubbed}
                            onChange={(e) =>
                              setSelected((prev) => ({
                                ...prev,
                                [c.id]: e.target.checked,
                              }))
                            }
                          />
                          <div className={styles.company}>
                            <span className={styles.companyName}>
                              {c.shortName || c.name}
                            </span>
                            <span className={styles.companyMeta}>
                              {c.email || "без email"}
                            </span>
                            <span
                              className={`${styles.badge} ${st.badge}`}
                              style={{ justifySelf: "start" }}
                            >
                              {unsubbed ? "Отписка" : st.label}
                            </span>
                          </div>
                          {c.url ? (
                            <a
                              className={styles.iconBtn}
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              ↗
                            </a>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.pager}>
                    <span>
                      Найдено {contactsTotal}
                      {hiddenSelected > 0
                        ? ` · выбрано скрыто фильтром: ${hiddenSelected}`
                        : ""}
                    </span>
                    <div className={styles.pagerControls}>
                      <label>
                        На стр.{" "}
                        <select
                          className={styles.select}
                          value={pageSize}
                          onChange={(e) => {
                            const ps = Number(e.target.value);
                            setPageSize(ps);
                            setPage(1);
                            void refresh({ pageSize: ps, page: 1 });
                          }}
                        >
                          {[25, 50, 100].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={page <= 1 || busy !== null}
                        onClick={() => {
                          const p = page - 1;
                          setPage(p);
                          void refresh({ page: p });
                        }}
                      >
                        ←
                      </button>
                      <span>
                        {page} / {pageCount}
                      </span>
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={page >= pageCount || busy !== null}
                        onClick={() => {
                          const p = page + 1;
                          setPage(p);
                          void refresh({ page: p });
                        }}
                      >
                        →
                      </button>
                    </div>
                  </div>
                </>
              )}

              {selectedReadyIds.length > 0 ? (
                <div className={styles.selectionBar}>
                  <strong>Выбрано {selectedReadyIds.length}</strong>
                  {hiddenSelected > 0 ? (
                    <span className={styles.companyMeta}>
                      (скрыто фильтром {hiddenSelected})
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={clearSelection}
                  >
                    Снять выбор
                  </button>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    style={{ marginLeft: "auto" }}
                    onClick={() => setView("prep")}
                  >
                    Подготовить отправку
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {view === "prep" ? (
            <div className={styles.prepGrid}>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <div>
                      <h3 className={styles.cardTitle}>Подготовка отправки</h3>
                      <p className={styles.cardHint}>
                        Получатели: {selectedReadyIds.length} организаций
                      </p>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => setView("workspace")}
                      >
                        ← К контактам
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={busy !== null}
                        onClick={() => runAction("test_send")}
                      >
                        Тестовое письмо
                      </button>
                    </div>
                  </div>

                  {mail?.overrideTo || mail?.testMode ? (
                    <div className={styles.warnBanner} style={{ marginTop: 12 }}>
                      {mail.testMode
                        ? "Тестовый режим (OUTREACH_MAIL_TEST): письма не уходят по SMTP."
                        : `Тестовый override. Все письма будут отправлены на ${mail.overrideTo}.`}
                    </div>
                  ) : null}

                  {blockedSelected.length > 0 ? (
                    <div className={styles.resultBox}>
                      Исключены из отправки: {blockedSelected.length} (отписка /
                      нет email)
                    </div>
                  ) : null}

                  <div style={{ marginTop: "0.75rem" }}>
                    <div className={styles.cardHead}>
                      <h4 className={styles.cardTitle}>Получатели</h4>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={clearSelection}
                      >
                        Очистить список
                      </button>
                    </div>
                    {selectedContactsForPrep.length === 0 ? (
                      <p className={styles.empty}>Нет доступных получателей</p>
                    ) : (
                      <div className={styles.recipientList}>
                        {selectedContactsForPrep.map((c) => (
                          <div key={c.id} className={styles.recipientRow}>
                            <div className={styles.company}>
                              <span className={styles.companyName}>
                                {c.shortName || c.name}
                              </span>
                              <span className={styles.companyMeta}>
                                {c.email}
                              </span>
                            </div>
                            <button
                              type="button"
                              className={styles.btnGhost}
                              onClick={() =>
                                setSelected((prev) => ({
                                  ...prev,
                                  [c.id]: false,
                                }))
                              }
                            >
                              Убрать
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>Письмо</h3>
                    <div className={styles.segments}>
                      <button
                        type="button"
                        className={
                          previewMode === "html" ? styles.segOn : styles.seg
                        }
                        onClick={() => setPreviewMode("html")}
                      >
                        HTML
                      </button>
                      <button
                        type="button"
                        className={
                          previewMode === "text" ? styles.segOn : styles.seg
                        }
                        onClick={() => setPreviewMode("text")}
                      >
                        Текст
                      </button>
                    </div>
                  </div>
                  <div className={styles.previewMeta}>
                    <div>
                      От: <strong>{mail?.from || "—"}</strong>
                    </div>
                    <div>
                      Кому:{" "}
                      <strong>
                        {selectedReadyIds.length} получател
                        {selectedReadyIds.length === 1 ? "ь" : "ей"}
                      </strong>
                    </div>
                    <div>
                      Тема: <strong>{letter?.subject ?? "…"}</strong>
                    </div>
                  </div>
                  {previewMode === "html" && letter?.html ? (
                    <iframe
                      className={styles.previewFrame}
                      title="Превью HTML"
                      srcDoc={letter.html}
                    />
                  ) : (
                    <pre className={styles.previewText}>
                      {letter?.text ?? "Загрузка…"}
                    </pre>
                  )}
                </div>

                {sendResult ? (
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>
                      Отправлено {sendResult.sent} из{" "}
                      {sendResult.sent + sendResult.failed}
                    </h3>
                    {sendResult.failed > 0 ? (
                      <p className={styles.cardHint}>
                        {sendResult.failed} писем не отправлены
                      </p>
                    ) : null}
                    <div className={styles.actions} style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => {
                          setHistoryFilter("fail");
                          setView("history");
                        }}
                      >
                        Посмотреть ошибки
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Параметры отправки</h3>
                <div className={styles.kv}>
                  <div className={styles.kvRow}>
                    <span>Получателей</span>
                    <strong>{selectedReadyIds.length}</strong>
                  </div>
                  <div className={styles.kvRow}>
                    <span>Отправитель</span>
                    <strong>{mail?.from || "—"}</strong>
                  </div>
                  <div className={styles.kvRow}>
                    <span>SMTP</span>
                    <strong>{mail?.host || "—"}</strong>
                  </div>
                  <div className={styles.kvRow}>
                    <span>Режим</span>
                    <strong>
                      {mail?.testMode
                        ? "TEST"
                        : mail?.overrideTo
                          ? "Override"
                          : "Реальный"}
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  style={{ marginTop: "0.85rem", width: "100%" }}
                  disabled={busy !== null || selectedReadyIds.length === 0}
                  onClick={() => setConfirmOpen(true)}
                >
                  Отправить {selectedReadyIds.length} писем
                </button>
              </div>
            </div>
          ) : null}

          {view === "history" ? (
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h3 className={styles.cardTitle}>История отправок</h3>
                  <p className={styles.cardHint}>
                    Последние {sends.length} записей
                  </p>
                </div>
              </div>
              <div className={styles.toolbar} style={{ marginTop: 8 }}>
                <input
                  className={styles.search}
                  type="search"
                  value={historyQ}
                  placeholder="Email или компания…"
                  onChange={(e) => setHistoryQ(e.target.value)}
                />
                <div className={styles.segments}>
                  {(
                    [
                      ["all", "Все"],
                      ["ok", "Успешные"],
                      ["fail", "Ошибки"],
                      ["test", "Тестовые"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={
                        historyFilter === key ? styles.segOn : styles.seg
                      }
                      onClick={() => setHistoryFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {historyRows.length === 0 ? (
                <p className={styles.empty}>Записей нет</p>
              ) : (
                <div className={styles.tableWrap} style={{ marginTop: 10 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.colDate}>Дата</th>
                        <th>Компания</th>
                        <th>Email</th>
                        <th>Тема</th>
                        <th className={styles.colStatus}>Результат</th>
                        <th className={styles.colActions} />
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((s) => (
                        <tr key={s.id}>
                          <td className={styles.companyMeta}>
                            {formatDate(s.sentAt)}
                          </td>
                          <td>{s.companyName || "—"}</td>
                          <td className={styles.emailCell}>
                            {s.to}
                            {s.deliveredTo && s.deliveredTo !== s.to ? (
                              <div className={styles.companyMeta}>
                                → {s.deliveredTo}
                              </div>
                            ) : null}
                          </td>
                          <td className={styles.companyMeta}>{s.subject}</td>
                          <td>
                            <span
                              className={`${styles.badge} ${
                                s.ok
                                  ? s.testMode
                                    ? styles.badgeWarn
                                    : styles.badgeOk
                                  : styles.badgeDanger
                              }`}
                            >
                              {s.ok
                                ? s.testMode
                                  ? "Тест"
                                  : "Успешно"
                                : "Ошибка"}
                            </span>
                          </td>
                          <td>
                            <div className={styles.actions}>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                title="Подробнее"
                                onClick={() =>
                                  setHistoryDetail(
                                    historyDetail === s.id ? null : s.id,
                                  )
                                }
                              >
                                i
                              </button>
                              {!s.ok ? (
                                <button
                                  type="button"
                                  className={styles.btn}
                                  disabled={busy !== null}
                                  onClick={() =>
                                    runAction("retry_send", {
                                      contactId: s.contactId,
                                    })
                                  }
                                >
                                  Повтор
                                </button>
                              ) : null}
                            </div>
                            {historyDetail === s.id ? (
                              <div className={styles.detail}>
                                <div>Кому: {s.to}</div>
                                {s.deliveredTo ? (
                                  <div>Доставлено: {s.deliveredTo}</div>
                                ) : null}
                                <div>Тема: {s.subject}</div>
                                <div>{formatDate(s.sentAt)}</div>
                                {s.error ? <div>Ошибка: {s.error}</div> : null}
                                <div>
                                  Режим: {s.testMode ? "тест/override" : "реальный"}
                                </div>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {view === "unsub" ? (
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h3 className={styles.cardTitle}>Отписки</h3>
                  <p className={styles.cardHint}>
                    Адреса, исключённые из дальнейших отправок ·{" "}
                    {unsubscribed.length} адресов
                  </p>
                </div>
              </div>
              <input
                className={styles.search}
                style={{ marginTop: 8, maxWidth: 320 }}
                type="search"
                value={unsubQ}
                placeholder="Поиск по email или компании…"
                onChange={(e) => setUnsubQ(e.target.value)}
              />
              {unsubRows.length === 0 ? (
                <p className={styles.empty}>Пока никто не отписался</p>
              ) : (
                <div className={styles.tableWrap} style={{ marginTop: 10 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Компания</th>
                        <th className={styles.colDate}>Дата</th>
                        <th>Источник</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unsubRows.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <a
                              className={styles.link}
                              href={`mailto:${u.email}`}
                            >
                              {u.email}
                            </a>
                          </td>
                          <td className={styles.companyMeta}>
                            {u.companyName || "—"}
                          </td>
                          <td className={styles.companyMeta}>
                            {formatDate(u.unsubscribedAt)}
                          </td>
                          <td className={styles.companyMeta}>
                            Ссылка в письме
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {view === "schedule" ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3 className={styles.cardTitle}>Расписание</h3>
                    <p className={styles.cardHint}>
                      Настройте шаги тика, сохраните, проверьте без отправки, затем
                      запустите пробный тик.
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={busy !== null || !settingsDirty}
                      onClick={() => saveSettings()}
                    >
                      {busy === "save_settings" ? "Сохранение…" : "Сохранить"}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.settingsGrid}>
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Параметры</h3>
                  <div className={styles.kv}>
                    <label className={styles.kvRow}>
                      <span>Включить расписание</span>
                      <input
                        type="checkbox"
                        checked={editScheduleEnabled}
                        onChange={(e) => {
                          setEditScheduleEnabled(e.target.checked);
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className={styles.kvRow}>
                      <span>Интервал, мин (≥15)</span>
                      <input
                        className={styles.select}
                        type="number"
                        min={15}
                        max={1440}
                        value={editIntervalMinutes}
                        onChange={(e) => {
                          setEditIntervalMinutes(Number(e.target.value));
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className={styles.kvRow}>
                      <span>1. Авто-скан Checko</span>
                      <input
                        type="checkbox"
                        checked={editAutoScan}
                        onChange={(e) => {
                          setEditAutoScan(e.target.checked);
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className={styles.kvRow}>
                      <span>2. Авто-получить email</span>
                      <input
                        type="checkbox"
                        checked={editAutoEnrich}
                        onChange={(e) => {
                          setEditAutoEnrich(e.target.checked);
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className={styles.kvRow}>
                      <span>3. Авто-отправка писем</span>
                      <input
                        type="checkbox"
                        checked={editAutoSend}
                        onChange={(e) => {
                          setEditAutoSend(e.target.checked);
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className={styles.kvRow}>
                      <span>Писем за тик</span>
                      <input
                        className={styles.select}
                        type="number"
                        min={1}
                        max={100}
                        value={editSendPerTick}
                        onChange={(e) => {
                          setEditSendPerTick(Number(e.target.value));
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                  </div>
                  {editAutoSend ? (
                    <div className={styles.warnBanner} style={{ marginTop: 10 }}>
                      Автоотправка шлёт реальные письма (или на override, если он
                      задан). Сначала проверьте без отправки.
                    </div>
                  ) : null}
                </div>

                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Статус планировщика</h3>
                  <div className={styles.kv}>
                    <div className={styles.kvRow}>
                      <span>Расписание</span>
                      <strong>
                        {editScheduleEnabled ? "включено" : "выключено"}
                      </strong>
                    </div>
                    <div className={styles.kvRow}>
                      <span>Фоновый таймер</span>
                      <strong>
                        {settings?.scheduleState.schedulerDisabledByEnv
                          ? "выкл (env)"
                          : settings?.scheduleState.schedulerArmed
                            ? "активен"
                            : "не поднят"}
                      </strong>
                    </div>
                    <div className={styles.kvRow}>
                      <span>Последний тик</span>
                      <strong>
                        {formatDate(
                          tickPreview?.lastTickAt ||
                            settings?.scheduleState.lastTickAt,
                        )}
                      </strong>
                    </div>
                    <div className={styles.kvRow}>
                      <span>Следующий (ожид.)</span>
                      <strong>
                        {formatDate(
                          tickPreview?.nextTickAt ||
                            settings?.scheduleState.nextTickAt,
                        )}
                      </strong>
                    </div>
                    <div className={styles.kvRow}>
                      <span>Готово к автоотправке</span>
                      <strong>
                        {tickPreview?.candidatesReady ?? "—"} / до{" "}
                        {tickPreview?.sendPerTick ?? editSendPerTick}
                      </strong>
                    </div>
                  </div>
                  {settings?.scheduleState.lastSummary ? (
                    <p className={styles.cardHint} style={{ marginTop: 8 }}>
                      Прошлый итог: {settings.scheduleState.lastSummary}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3 className={styles.cardTitle}>Проверка</h3>
                    <p className={styles.cardHint}>
                      «Проверить» — без скана и без писем. «Запустить тик» —
                      выполняет сохранённые шаги по-настоящему.
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy !== null}
                      onClick={() => runAction("schedule_preview")}
                    >
                      {busy === "schedule_preview"
                        ? "Проверка…"
                        : "Проверить (без отправки)"}
                    </button>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={busy !== null || settingsDirty}
                      title={
                        settingsDirty
                          ? "Сначала сохраните настройки"
                          : undefined
                      }
                      onClick={() => runAction("tick")}
                    >
                      {busy === "tick" ? "Тик…" : "Запустить тик сейчас"}
                    </button>
                  </div>
                </div>

                {settingsDirty ? (
                  <div className={styles.warnBanner} style={{ marginTop: 10 }}>
                    Есть несохранённые изменения — сохраните, иначе тик пойдёт по
                    старым настройкам.
                  </div>
                ) : null}

                {tickPreview ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    <div className={styles.strong} style={{ fontSize: "0.9rem" }}>
                      Что сделает тик
                    </div>
                    {tickPreview.steps.map((step) => (
                      <div key={step.id} className={styles.recipientRow}>
                        <div className={styles.company}>
                          <span className={styles.companyName}>
                            {step.enabled ? "✓" : "—"} {step.label}
                          </span>
                          <span className={styles.companyMeta}>
                            {step.detail}
                          </span>
                        </div>
                        <span
                          className={`${styles.badge} ${
                            step.enabled ? styles.badgeOk : styles.badgeMute
                          }`}
                        >
                          {step.enabled ? "вкл" : "выкл"}
                        </span>
                      </div>
                    ))}
                    <div className={styles.kv} style={{ marginTop: 4 }}>
                      <div className={styles.kvRow}>
                        <span>Checko профиль</span>
                        <strong>
                          {tickPreview.checkoProfileFound
                            ? "найден"
                            : "нет"}
                        </strong>
                      </div>
                      <div className={styles.kvRow}>
                        <span>Браузер</span>
                        <strong>
                          {tickPreview.browsersFound ? "найден" : "нет"}
                        </strong>
                      </div>
                      <div className={styles.kvRow}>
                        <span>SMTP</span>
                        <strong>
                          {tickPreview.smtpConfigured ? "ok" : "нет"}
                        </strong>
                      </div>
                    </div>
                    {tickPreview.warnings.length > 0 ? (
                      <div className={styles.warnBanner}>
                        {tickPreview.warnings.map((w) => (
                          <div key={w}>{w}</div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.cardHint}>
                        Предупреждений нет — можно запускать тик.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className={styles.cardHint} style={{ marginTop: 10 }}>
                    Нажмите «Проверить», чтобы увидеть шаги и готовность.
                  </p>
                )}

                {lastTickResult ? (
                  <div className={styles.resultBox} style={{ marginTop: 12 }}>
                    <div className={styles.strong}>
                      Результат тика · {formatDate(lastTickResult.at)} ·{" "}
                      {lastTickResult.ok ? "ok" : "с ошибками"}
                    </div>
                    {lastTickResult.skippedReason ? (
                      <div>{lastTickResult.skippedReason}</div>
                    ) : null}
                    {lastTickResult.scan ? (
                      <div>
                        Скан: найдено {lastTickResult.scan.found}, новых{" "}
                        {lastTickResult.scan.added}
                        {lastTickResult.scan.error
                          ? ` · ${lastTickResult.scan.error}`
                          : ""}
                      </div>
                    ) : null}
                    {lastTickResult.enrich ? (
                      <div>
                        Email: {lastTickResult.enrich.withEmail}/
                        {lastTickResult.enrich.processed}
                        {lastTickResult.enrich.error
                          ? ` · ${lastTickResult.enrich.error}`
                          : ""}
                      </div>
                    ) : null}
                    {lastTickResult.send ? (
                      <div>
                        Отправка: {lastTickResult.send.sent} ok,{" "}
                        {lastTickResult.send.failed} fail, пропуск{" "}
                        {lastTickResult.send.skipped}
                        {lastTickResult.send.errors?.[0]
                          ? ` · ${lastTickResult.send.errors[0]}`
                          : ""}
                      </div>
                    ) : null}
                    {lastTickResult.error ? (
                      <div>{lastTickResult.error}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {view === "settings" ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3 className={styles.cardTitle}>Настройки и шаблон</h3>
                    <p className={styles.cardHint}>
                      Сохраняется в data/outreach-config.json — общий шаблон для
                      всех отправок. Плейсхолдеры: {"{{company}}"}, {"{{site}}"},{" "}
                      {"{{phone}}"}, {"{{fromName}}"}, {"{{shortName}}"},{" "}
                      {"{{brand}}"}.
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={busy !== null || !settingsDirty}
                      onClick={() => saveSettings()}
                    >
                      {busy === "save_settings" ? "Сохранение…" : "Сохранить"}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.settingsGrid}>
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Checko</h3>
                  <div className={styles.kv}>
                    <div className={styles.kvRow}>
                      <span>Профиль</span>
                      <strong>
                        {settings?.checko.profileFound
                          ? settings.checko.profileDirName
                          : "не найден"}
                      </strong>
                    </div>
                    <div className={styles.kvRow}>
                      <span>Браузер</span>
                      <strong>
                        {settings?.checko.browsersFound
                          ? "найден"
                          : "не найден"}
                      </strong>
                    </div>
                    <label className={styles.kvRow}>
                      <span>Задержка скана, мс</span>
                      <input
                        className={styles.select}
                        type="number"
                        min={0}
                        value={editDelayMs}
                        onChange={(e) => {
                          setEditDelayMs(Number(e.target.value));
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className={styles.kvRow}>
                      <span>Задержка email, мс</span>
                      <input
                        className={styles.select}
                        type="number"
                        min={0}
                        value={editEnrichDelayMs}
                        onChange={(e) => {
                          setEditEnrichDelayMs(Number(e.target.value));
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className={styles.kvRow}>
                      <span>Email за один запуск</span>
                      <input
                        className={styles.select}
                        type="number"
                        min={1}
                        max={50}
                        value={editEnrichPerJob}
                        onChange={(e) => {
                          setEditEnrichPerJob(Number(e.target.value));
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className={styles.kvRow}>
                      <span>Макс. страниц скана</span>
                      <input
                        className={styles.select}
                        type="number"
                        min={1}
                        max={200}
                        value={editMaxPages}
                        onChange={(e) => {
                          setEditMaxPages(Number(e.target.value));
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className={styles.kvRow}>
                      <span>Окно браузера (headed)</span>
                      <input
                        type="checkbox"
                        checked={editHeaded}
                        onChange={(e) => {
                          setEditHeaded(e.target.checked);
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <div className={styles.kvRow}>
                      <span>Последний скан</span>
                      <strong>{formatDate(meta?.lastScanAt)}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.btn}
                    style={{ marginTop: 10 }}
                    disabled={busy !== null}
                    onClick={() => runAction("probe")}
                  >
                    Проверить подключение
                  </button>
                </div>

                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Отправка и SMTP</h3>
                  <div className={styles.kv}>
                    <div className={styles.kvRow}>
                      <span>Сервер</span>
                      <strong>{settings?.smtp.host || "—"}</strong>
                    </div>
                    <div className={styles.kvRow}>
                      <span>Отправитель</span>
                      <strong>{settings?.smtp.from || "—"}</strong>
                    </div>
                    <div className={styles.kvRow}>
                      <span>Override (env)</span>
                      <strong>{settings?.smtp.overrideTo || "—"}</strong>
                    </div>
                    <label className={styles.kvRow}>
                      <span>Пауза между письмами, мс</span>
                      <input
                        className={styles.select}
                        type="number"
                        min={0}
                        value={editSendDelayMs}
                        onChange={(e) => {
                          setEditSendDelayMs(Number(e.target.value));
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label className={styles.kvRow}>
                      <span>Лимит писем за клик</span>
                      <input
                        className={styles.select}
                        type="number"
                        min={1}
                        max={200}
                        value={editSendBatchLimit}
                        onChange={(e) => {
                          setEditSendBatchLimit(Number(e.target.value));
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4 }}>
                      <span className={styles.companyMeta}>
                        Email оператора (тестовое письмо)
                      </span>
                      <input
                        className={styles.search}
                        style={{ maxWidth: "100%" }}
                        type="email"
                        value={editOperatorEmail}
                        onChange={(e) => {
                          setEditOperatorEmail(e.target.value);
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className={styles.btn}
                    style={{ marginTop: 10 }}
                    disabled={busy !== null}
                    onClick={() => runAction("test_send")}
                  >
                    Отправить тестовое письмо
                  </button>
                </div>

                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Расписание</h3>
                  <p className={styles.cardHint}>
                    Настройка и проверка автотика — в разделе «Расписание».
                  </p>
                  <button
                    type="button"
                    className={styles.btn}
                    style={{ marginTop: 10 }}
                    onClick={() => setView("schedule")}
                  >
                    Открыть расписание →
                  </button>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3 className={styles.cardTitle}>Шаблон письма</h3>
                    <p className={styles.cardHint}>
                      Превью как при отправке (пример: ООО «Пример»). Сохраните —
                      шаблон общий для всех. Плейсхолдеры: {"{{company}}"},{" "}
                      {"{{site}}"}, {"{{phone}}"}, {"{{fromName}}"}.
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <div className={styles.segments}>
                      <button
                        type="button"
                        className={
                          templatePreviewMode === "html"
                            ? styles.segOn
                            : styles.seg
                        }
                        onClick={() => setTemplatePreviewMode("html")}
                      >
                        HTML
                      </button>
                      <button
                        type="button"
                        className={
                          templatePreviewMode === "text"
                            ? styles.segOn
                            : styles.seg
                        }
                        onClick={() => setTemplatePreviewMode("text")}
                      >
                        Текст
                      </button>
                    </div>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => setLetterEditorOpen((v) => !v)}
                    >
                      {letterEditorOpen ? "Скрыть правку" : "Править шаблон"}
                    </button>
                  </div>
                </div>

                {letterEditorOpen ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "0.65rem",
                      marginBottom: "0.85rem",
                      padding: "0.75rem",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <label style={{ display: "grid", gap: 4 }}>
                      <span className={styles.companyMeta}>Тема</span>
                      <input
                        className={styles.search}
                        style={{ maxWidth: "100%" }}
                        value={editSubject}
                        onChange={(e) => {
                          setEditSubject(e.target.value);
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4 }}>
                      <span className={styles.companyMeta}>Текст письма</span>
                      <textarea
                        value={editText}
                        onChange={(e) => {
                          setEditText(e.target.value);
                          setSettingsDirty(true);
                        }}
                        rows={14}
                        style={{
                          width: "100%",
                          font: "inherit",
                          fontSize: "0.85rem",
                          lineHeight: 1.45,
                          padding: "0.65rem",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          resize: "vertical",
                          background: "#fff",
                        }}
                      />
                    </label>
                  </div>
                ) : null}

                <div className={styles.previewMeta}>
                  <div>
                    От: <strong>{mail?.from || "—"}</strong>
                  </div>
                  <div>
                    Кому: <strong>ООО «Пример» · preview@example.com</strong>
                  </div>
                  <div>
                    Тема:{" "}
                    <strong>
                      {(letterDraftPreview || letter)?.subject ?? "…"}
                    </strong>
                  </div>
                </div>

                {templatePreviewMode === "html" &&
                (letterDraftPreview || letter)?.html ? (
                  <iframe
                    className={styles.previewFrame}
                    title="Превью шаблона HTML"
                    srcDoc={(letterDraftPreview || letter)?.html}
                  />
                ) : (
                  <pre className={styles.previewText}>
                    {(letterDraftPreview || letter)?.text ?? "Загрузка…"}
                  </pre>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {confirmOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="send-confirm-title">Подтвердить отправку</h2>
            <div className={styles.kv}>
              <div className={styles.kvRow}>
                <span>Получателей</span>
                <strong>{selectedReadyIds.length}</strong>
              </div>
              <div className={styles.kvRow}>
                <span>Тема</span>
                <strong style={{ maxWidth: 220 }}>{letter?.subject}</strong>
              </div>
              <div className={styles.kvRow}>
                <span>Режим</span>
                <strong>
                  {mail?.testMode
                    ? "TEST"
                    : mail?.overrideTo
                      ? `Override → ${mail.overrideTo}`
                      : "Реальный"}
                </strong>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setConfirmOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={busy !== null}
                onClick={() =>
                  runAction("send", { contactIds: selectedReadyIds })
                }
              >
                {busy === "send" ? "Отправка…" : "Подтвердить отправку"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
