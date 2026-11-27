import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getOutreachConfig } from "@/lib/outreach-config";
import { runOutreachEnrich, runOutreachScan } from "@/lib/outreach-jobs";
import {
  beginOutreachJob,
  finishOutreachJob,
  getOutreachJobStatus,
} from "@/lib/outreach-job-status";
import {
  listAutoSendCandidates,
  sendOutreachBatch,
} from "@/lib/outreach-send-batch";

export type OutreachTickResult = {
  at: string;
  ok: boolean;
  skippedReason?: string;
  scan?: { ok: boolean; found: number; added: number; error?: string };
  enrich?: { ok: boolean; processed: number; withEmail: number; error?: string };
  send?: {
    ok: boolean;
    sent: number;
    failed: number;
    skipped: number;
    errors: string[];
  };
  error?: string;
};

type ScheduleState = {
  lastTickAt?: string;
  lastResult?: OutreachTickResult;
  nextTickAt?: string;
};

const STATE_FILE = path.join(process.cwd(), "data", "outreach-schedule.json");

let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

async function readState(): Promise<ScheduleState> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    return JSON.parse(raw) as ScheduleState;
  } catch {
    return {};
  }
}

async function writeState(state: ScheduleState): Promise<void> {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function getOutreachScheduleState(): Promise<ScheduleState> {
  return readState();
}

export function isOutreachSchedulerArmed(): boolean {
  return timer !== null;
}

export type OutreachTickPreview = {
  at: string;
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

/** Проверка без побочных эффектов: что сделает следующий тик. */
export async function previewOutreachTick(): Promise<OutreachTickPreview> {
  const cfg = await getOutreachConfig();
  const state = await readState();
  const mail = await import("@/lib/mail-send").then((m) =>
    m.getMailConfigStatus(),
  );
  const { checkoProfileDir } = await import(
    "@/lib/outreach/checko-profile-path"
  );
  const { playwrightBrowsersInstalled, playwrightBrowsersPath } = await import(
    "@/lib/outreach/playwright-env"
  );
  const fs = await import("node:fs");
  const profileDir = checkoProfileDir(0);
  const browsersPath = playwrightBrowsersPath();
  const browsersFound = playwrightBrowsersInstalled();
  const profileFound = fs.existsSync(profileDir);

  const sendLimit = Math.min(cfg.schedule.sendPerTick, cfg.sendBatchLimit);
  const candidates = await listAutoSendCandidates(sendLimit);
  const warnings: string[] = [];

  if (process.env.OUTREACH_SCHEDULER === "0") {
    warnings.push(
      "OUTREACH_SCHEDULER=0 — фоновый планировщик выключен. Тик только вручную или через /api/cron/outreach.",
    );
  } else if (!timer) {
    warnings.push(
      "Фоновый таймер ещё не поднят (нужен next start / instrumentation). Ручной тик и cron работают.",
    );
  }
  if (cfg.schedule.enabled && cfg.schedule.autoSend && !mail.configured) {
    warnings.push("Автоотправка включена, но SMTP не настроен.");
  }
  if (cfg.schedule.autoSend && (mail.overrideTo || mail.testMode)) {
    warnings.push(
      mail.testMode
        ? "TEST-режим: письма не уйдут по SMTP."
        : `Override: все письма → ${mail.overrideTo}.`,
    );
  }
  if (cfg.schedule.autoScan && !profileFound) {
    warnings.push("Профиль Checko не найден — авто-скан, скорее всего, упадёт.");
  }
  if ((cfg.schedule.autoScan || cfg.schedule.autoEnrich) && !browsersFound) {
    warnings.push("Chromium Playwright не найден.");
  }

  return {
    at: new Date().toISOString(),
    schedulerArmed: timer !== null,
    schedulerDisabledByEnv: process.env.OUTREACH_SCHEDULER === "0",
    scheduleEnabled: cfg.schedule.enabled,
    intervalMinutes: cfg.schedule.intervalMinutes,
    steps: [
      {
        id: "scan",
        label: "Скан Checko",
        enabled: cfg.schedule.autoScan,
        detail: cfg.schedule.autoScan
          ? "Новые организации за окно регистрации"
          : "Пропуск",
      },
      {
        id: "enrich",
        label: "Получить email",
        enabled: cfg.schedule.autoEnrich,
        detail: cfg.schedule.autoEnrich
          ? `До ${cfg.enrichPerJob} контактов за тик`
          : "Пропуск",
      },
      {
        id: "send",
        label: "Отправка писем",
        enabled: cfg.schedule.autoSend,
        detail: cfg.schedule.autoSend
          ? `До ${sendLimit} шт. · сейчас готово ${candidates.length}`
          : "Пропуск (безопасно)",
      },
    ],
    candidatesReady: candidates.length,
    sendPerTick: sendLimit,
    smtpConfigured: mail.configured,
    overrideTo: mail.overrideTo,
    testMode: mail.testMode,
    checkoProfileFound: profileFound,
    browsersFound,
    lastTickAt: state.lastTickAt,
    nextTickAt: state.nextTickAt,
    warnings,
  };
}

export async function runOutreachTick(options?: {
  force?: boolean;
}): Promise<OutreachTickResult> {
  const cfg = await getOutreachConfig();
  const schedule = cfg.schedule;
  const at = new Date().toISOString();

  if (!options?.force && !schedule.enabled) {
    return { at, ok: true, skippedReason: "Расписание выключено" };
  }

  if (tickInFlight || getOutreachJobStatus().running) {
    return { at, ok: true, skippedReason: "Уже выполняется другая задача" };
  }

  tickInFlight = true;
  if (!beginOutreachJob("tick", "Плановый тик рассылки…")) {
    tickInFlight = false;
    return { at, ok: true, skippedReason: "Уже выполняется другая задача" };
  }

  const result: OutreachTickResult = { at, ok: true };

  try {
    if (schedule.autoScan) {
      const scan = await runOutreachScan();
      result.scan = {
        ok: scan.ok,
        found: scan.found,
        added: scan.added,
        error: scan.error,
      };
      if (!scan.ok) result.ok = false;
    }

    if (schedule.autoEnrich) {
      const enrich = await runOutreachEnrich();
      result.enrich = {
        ok: enrich.ok,
        processed: enrich.processed,
        withEmail: enrich.withEmail,
        error: enrich.error,
      };
      if (!enrich.ok) result.ok = false;
    }

    if (schedule.autoSend) {
      const mail = await import("@/lib/mail-send").then((m) =>
        m.getMailConfigStatus(),
      );
      if (!mail.configured) {
        result.send = {
          ok: false,
          sent: 0,
          failed: 0,
          skipped: 0,
          errors: ["SMTP не настроен"],
        };
        result.ok = false;
      } else {
        const limit = Math.min(
          schedule.sendPerTick,
          cfg.sendBatchLimit,
        );
        const ids = await listAutoSendCandidates(limit);
        const send = await sendOutreachBatch(ids, {
          respectBatchLimit: true,
        });
        result.send = {
          ok: send.failed === 0,
          sent: send.sent,
          failed: send.failed,
          skipped: send.skipped,
          errors: send.errors,
        };
        if (send.failed > 0) result.ok = false;
      }
    }

    finishOutreachJob(result.ok ? undefined : "Тик завершён с ошибками");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка тика";
    result.ok = false;
    result.error = message;
    finishOutreachJob(message);
  } finally {
    tickInFlight = false;
    const intervalMs = Math.max(schedule.intervalMinutes, 15) * 60_000;
    await writeState({
      lastTickAt: at,
      lastResult: result,
      nextTickAt: new Date(Date.now() + intervalMs).toISOString(),
    });
  }

  return result;
}

export async function ensureOutreachScheduler(): Promise<void> {
  if (timer) return;
  if (process.env.OUTREACH_SCHEDULER === "0") return;

  // Первый проход через минуту после старта (дать подняться серверу)
  const bootDelayMs = 60_000;

  const loop = async () => {
    try {
      const cfg = await getOutreachConfig();
      if (!cfg.schedule.enabled) return;
      const state = await readState();
      const intervalMs = Math.max(cfg.schedule.intervalMinutes, 15) * 60_000;
      if (state.lastTickAt) {
        const elapsed = Date.now() - new Date(state.lastTickAt).getTime();
        if (elapsed < intervalMs - 5_000) return;
      }
      await runOutreachTick();
    } catch (err) {
      console.error("[outreach-scheduler]", err);
    }
  };

  setTimeout(() => {
    void loop();
    timer = setInterval(() => {
      void loop();
    }, 60_000); // проверка каждую минуту; сам тик — по intervalMinutes
    if (typeof timer === "object" && "unref" in timer) {
      timer.unref?.();
    }
  }, bootDelayMs);

  console.info("[outreach-scheduler] armed (check every 1m)");
}
