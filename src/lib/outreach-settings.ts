import fs from "node:fs";
import path from "path";
import { checkoProfileDir } from "@/lib/outreach/checko-profile-path";
import {
  playwrightBrowsersInstalled,
  playwrightBrowsersPath,
} from "@/lib/outreach/playwright-env";
import { getMailConfigStatus } from "@/lib/mail-send";
import {
  getOutreachConfig,
  type OutreachLetterConfig,
  type OutreachRuntimeConfig,
  type OutreachScheduleConfig,
} from "@/lib/outreach-config";
import {
  getOutreachScheduleState,
  isOutreachSchedulerArmed,
  previewOutreachTick,
  type OutreachTickPreview,
} from "@/lib/outreach-scheduler";

export type OutreachSettingsView = {
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
  letter: OutreachLetterConfig;
  schedule: OutreachScheduleConfig;
  scheduleState: {
    lastTickAt?: string;
    nextTickAt?: string;
    lastOk?: boolean;
    lastSummary?: string;
    schedulerArmed: boolean;
    schedulerDisabledByEnv: boolean;
  };
  tickPreview?: OutreachTickPreview;
};

export async function getOutreachSettingsView(): Promise<OutreachSettingsView> {
  const cfg = await getOutreachConfig();
  const [state, tickPreview] = await Promise.all([
    getOutreachScheduleState(),
    previewOutreachTick(),
  ]);
  const profileDir = checkoProfileDir(0);
  const browsersPath = playwrightBrowsersPath();
  const browsersFound = playwrightBrowsersInstalled();

  const mail = getMailConfigStatus();
  const last = state.lastResult;
  let lastSummary: string | undefined;
  if (last) {
    const parts: string[] = [];
    if (last.skippedReason) parts.push(last.skippedReason);
    if (last.scan)
      parts.push(`скан +${last.scan.added}/${last.scan.found}`);
    if (last.enrich)
      parts.push(`email ${last.enrich.withEmail}/${last.enrich.processed}`);
    if (last.send)
      parts.push(`отправка ${last.send.sent} ok / ${last.send.failed} fail`);
    if (last.error) parts.push(last.error);
    lastSummary = parts.join(" · ") || (last.ok ? "ok" : "ошибка");
  }

  return {
    checko: {
      profileDirName: path.basename(profileDir),
      profileFound: fs.existsSync(profileDir),
      browsersFound,
      delayMs: cfg.delayMs,
      enrichDelayMs: cfg.enrichDelayMs,
      enrichPerJob: cfg.enrichPerJob,
      maxPages: cfg.maxPages,
      headed: cfg.headed,
    },
    send: {
      sendDelayMs: cfg.sendDelayMs,
      sendBatchLimit: cfg.sendBatchLimit,
    },
    smtp: {
      configured: mail.configured,
      host: mail.host,
      from: mail.from,
      testMode: mail.testMode,
      overrideTo: mail.overrideTo,
      operatorEmail: cfg.operatorEmail || mail.overrideTo || "",
    },
    letter: cfg.letter,
    schedule: cfg.schedule,
    scheduleState: {
      lastTickAt: state.lastTickAt,
      nextTickAt: state.nextTickAt,
      lastOk: last?.ok,
      lastSummary,
      schedulerArmed: isOutreachSchedulerArmed(),
      schedulerDisabledByEnv: process.env.OUTREACH_SCHEDULER === "0",
    },
    tickPreview,
  };
}

export type OutreachSettingsPatch = Partial<
  Pick<
    OutreachRuntimeConfig,
    | "delayMs"
    | "enrichDelayMs"
    | "enrichPerJob"
    | "maxPages"
    | "headed"
    | "sendDelayMs"
    | "sendBatchLimit"
    | "operatorEmail"
  >
> & {
  letter?: Partial<OutreachLetterConfig>;
  schedule?: Partial<OutreachScheduleConfig>;
};
