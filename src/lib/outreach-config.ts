import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type OutreachLetterConfig = {
  /** Тема, плейсхолдер {{company}} */
  subjectTemplate: string;
  /** Текст письма, плейсхолдер {{company}} */
  textTemplate: string;
};

export type OutreachScheduleConfig = {
  enabled: boolean;
  /** Интервал тика, минуты (15–1440) */
  intervalMinutes: number;
  autoScan: boolean;
  autoEnrich: boolean;
  autoSend: boolean;
  /** Сколько писем за один тик */
  sendPerTick: number;
};

export function defaultSchedule(): OutreachScheduleConfig {
  return {
    enabled: false,
    intervalMinutes: 60,
    autoScan: true,
    autoEnrich: true,
    autoSend: false,
    sendPerTick: 10,
  };
}

export type OutreachRuntimeConfig = {
  delayMs: number;
  enrichDelayMs: number;
  enrichPerJob: number;
  maxPages: number;
  headed: boolean;
  /** Пауза между письмами при массовой отправке, мс */
  sendDelayMs: number;
  /** Макс. писем за одно нажатие «Отправить» */
  sendBatchLimit: number;
  operatorEmail: string;
  letter: OutreachLetterConfig;
  schedule: OutreachScheduleConfig;
};

const DATA_FILE = path.join(process.cwd(), "data", "outreach-config.json");

export const DEFAULT_LETTER: OutreachLetterConfig = {
  subjectTemplate: "Предложение по созданию сайта для {{company}}",
  textTemplate: `Здравствуйте!

Обратил внимание на вашу компанию и решил предложить обсудить возможность создания сайта для вашего бизнеса.

Я представляю RevenShare — проект, в рамках которого мы разрабатываем сайты без предоплаты за разработку. Принцип простой: сначала вы видите результат, а затем принимаете решение о сотрудничестве.

Как это работает:

1. Создаём демоверсию. Разрабатываем сайт и размещаем его на демостенде. Вы можете оценить дизайн, функциональность и предложить необходимые изменения.
2. Заключаем договор. Когда результат вас устраивает, переходим к сотрудничеству и размещаем сайт на хостинге.
3. Развиваем проект. Наше вознаграждение составляет 10% с заявок, полученных через сайт, включая повторные обращения.

Первые три месяца размещение сайта на хостинге предоставляется бесплатно. Если за этот период сайт не принесёт заявок, вы сможете выкупить готовый проект за 29 000 ₽.

Таким образом, вам не нужно оплачивать разработку заранее или принимать решение, не видя результата. Сначала вы оцениваете готовый сайт, а уже потом выбираете, подходит ли вам такой формат сотрудничества.

Предлагаю просто обсудить эту идею. Будет интересно узнать о вашей компании и понять, какой сайт мог бы быть полезен вашему бизнесу.

Можете ответить прямо на это письмо. Подробнее о модели сотрудничества: {{site}}

С уважением,

{{fromName}}
RevenShare · {{shortName}}

Тел.: {{phone}}
Сайт: {{site}}

Если предложение неактуально, достаточно сообщить об этом в ответном письме.`,
};

function defaultsFromEnv(): OutreachRuntimeConfig {
  return {
    delayMs: Number(process.env.OUTREACH_CHECKO_DELAY_MS || 1800),
    enrichDelayMs: Number(process.env.OUTREACH_CHECKO_ENRICH_DELAY_MS || 9000),
    enrichPerJob: Number(process.env.OUTREACH_CHECKO_ENRICH_PER_JOB || 12),
    maxPages: Number(process.env.OUTREACH_CHECKO_MAX_PAGES || 40),
    headed: process.env.OUTREACH_CHECKO_HEADED === "1",
    sendDelayMs: Number(process.env.OUTREACH_SEND_DELAY_MS || 1500),
    sendBatchLimit: Number(process.env.OUTREACH_SEND_BATCH_LIMIT || 50),
    operatorEmail:
      process.env.OUTREACH_OPERATOR_EMAIL?.trim() ||
      process.env.OUTREACH_MAIL_OVERRIDE_TO?.trim() ||
      "",
    letter: { ...DEFAULT_LETTER },
    schedule: defaultSchedule(),
  };
}

function clampSchedule(
  raw: Partial<OutreachScheduleConfig> | undefined,
  base: OutreachScheduleConfig,
): OutreachScheduleConfig {
  const s = { ...base, ...(raw || {}) };
  return {
    enabled: Boolean(s.enabled),
    intervalMinutes: Math.min(
      1440,
      Math.max(15, Number(s.intervalMinutes) || base.intervalMinutes),
    ),
    autoScan: Boolean(s.autoScan),
    autoEnrich: Boolean(s.autoEnrich),
    autoSend: Boolean(s.autoSend),
    sendPerTick: Math.min(
      100,
      Math.max(1, Number(s.sendPerTick) || base.sendPerTick),
    ),
  };
}

function clampConfig(raw: Partial<OutreachRuntimeConfig>): OutreachRuntimeConfig {
  const base = defaultsFromEnv();
  return {
    delayMs: Math.max(0, Number(raw.delayMs ?? base.delayMs) || 0),
    enrichDelayMs: Math.max(0, Number(raw.enrichDelayMs ?? base.enrichDelayMs) || 0),
    enrichPerJob: Math.min(
      50,
      Math.max(1, Number(raw.enrichPerJob ?? base.enrichPerJob) || 12),
    ),
    maxPages: Math.min(
      200,
      Math.max(1, Number(raw.maxPages ?? base.maxPages) || 40),
    ),
    headed: Boolean(raw.headed ?? base.headed),
    sendDelayMs: Math.max(0, Number(raw.sendDelayMs ?? base.sendDelayMs) || 0),
    sendBatchLimit: Math.min(
      200,
      Math.max(1, Number(raw.sendBatchLimit ?? base.sendBatchLimit) || 50),
    ),
    operatorEmail:
      typeof raw.operatorEmail === "string"
        ? raw.operatorEmail.trim()
        : base.operatorEmail,
    letter: {
      subjectTemplate:
        typeof raw.letter?.subjectTemplate === "string" &&
        raw.letter.subjectTemplate.trim()
          ? raw.letter.subjectTemplate.trim()
          : base.letter.subjectTemplate,
      textTemplate:
        typeof raw.letter?.textTemplate === "string" &&
        raw.letter.textTemplate.trim()
          ? raw.letter.textTemplate
          : base.letter.textTemplate,
    },
    schedule: clampSchedule(raw.schedule, base.schedule),
  };
}

export async function readOutreachConfig(): Promise<OutreachRuntimeConfig> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<OutreachRuntimeConfig>;
    return clampConfig(parsed);
  } catch {
    return defaultsFromEnv();
  }
}

export async function writeOutreachConfig(
  patch: Omit<Partial<OutreachRuntimeConfig>, "letter" | "schedule"> & {
    letter?: Partial<OutreachLetterConfig>;
    schedule?: Partial<OutreachScheduleConfig>;
  },
): Promise<OutreachRuntimeConfig> {
  const current = await readOutreachConfig();
  const next = clampConfig({
    ...current,
    ...patch,
    letter: {
      ...current.letter,
      ...(patch.letter || {}),
    },
    schedule: {
      ...current.schedule,
      ...(patch.schedule || {}),
    },
  });
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  invalidateOutreachConfigCache();
  cached = next;
  cachedAt = Date.now();
  return next;
}

/** Синхронный кэш после первого чтения — для hot path checko (опционально). */
let cached: OutreachRuntimeConfig | null = null;
let cachedAt = 0;

export async function getOutreachConfig(): Promise<OutreachRuntimeConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < 2000) return cached;
  cached = await readOutreachConfig();
  cachedAt = now;
  return cached;
}

export function invalidateOutreachConfigCache(): void {
  cached = null;
  cachedAt = 0;
}

/** Для sync-путей (checko/letter). Без файла — дефолты из env. */
export function peekOutreachConfigSync(): OutreachRuntimeConfig {
  return cached ?? defaultsFromEnv();
}

export function applyLetterPlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
