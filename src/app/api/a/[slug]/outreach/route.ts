import { NextResponse } from "next/server";
import { isAdminRequest, verifyAdminPath } from "@/lib/admin-auth";
import { getMailConfigStatus, sendMail } from "@/lib/mail-send";
import { getOutreachConfig, writeOutreachConfig } from "@/lib/outreach-config";
import { DEFAULT_LETTER } from "@/lib/outreach-config";
import {
  buildRevenShareOutreachLetter,
  buildRevenShareOutreachLetterAsync,
  previewRevenShareOutreachLetter,
} from "@/lib/outreach-letter";
import { runOutreachEnrich, runOutreachScan } from "@/lib/outreach-jobs";
import {
  beginOutreachJob,
  finishOutreachJob,
  getOutreachJobStatus,
} from "@/lib/outreach-job-status";
import {
  ensureOutreachScheduler,
  previewOutreachTick,
  runOutreachTick,
} from "@/lib/outreach-scheduler";
import {
  getOutreachSettingsView,
  type OutreachSettingsPatch,
} from "@/lib/outreach-settings";
import { sendOutreachBatch } from "@/lib/outreach-send-batch";
import {
  getOutreachMeta,
  listOutreachContacts,
  listRecentSends,
  queryOutreachContacts,
  type OutreachContactFilter,
} from "@/lib/outreach-store";
import { readUnsubRecords } from "@/lib/outreach-unsubscribe";
import { IP } from "@/lib/ip";

type Ctx = { params: Promise<{ slug: string }> };

async function guard(slug: string) {
  if (!verifyAdminPath(slug)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function jobBusyResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "Уже выполняется другая задача",
      job: getOutreachJobStatus(),
    },
    { status: 409 },
  );
}

async function snapshot(extra?: {
  page?: number;
  pageSize?: number;
  filter?: OutreachContactFilter;
  q?: string;
}) {
  const filter = extra?.filter || "all";
  const page = extra?.page ?? 1;
  const pageSize = extra?.pageSize ?? 50;
  const q = extra?.q ?? "";

  const [paged, allContacts, meta, sends, unsubscribed, letter, settings] =
    await Promise.all([
      queryOutreachContacts({ q, filter, page, pageSize }),
      listOutreachContacts(),
      getOutreachMeta(),
      listRecentSends(200),
      readUnsubRecords(),
      previewRevenShareOutreachLetter(),
      getOutreachSettingsView(),
    ]);

  return {
    ok: true as const,
    contacts: paged.items,
    contactsTotal: paged.total,
    contactsPage: paged.page,
    contactsPageSize: paged.pageSize,
    /** Полный список id+email для selection / counts (лёгкий). */
    contactIndex: allContacts.map((c) => ({
      id: c.id,
      email: c.email,
      emails: c.emails ?? [],
      status: c.status,
      shortName: c.shortName,
      name: c.name,
    })),
    meta,
    sends,
    unsubscribed,
    mail: getMailConfigStatus(),
    letter,
    settings,
    job: getOutreachJobStatus(),
  };
}

export async function GET(request: Request, context: Ctx) {
  const { slug } = await context.params;
  const denied = await guard(slug);
  if (denied) return denied;

  await ensureOutreachScheduler();

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 50);
  const filter = (url.searchParams.get("filter") ||
    "all") as OutreachContactFilter;
  const q = url.searchParams.get("q") || "";

  return NextResponse.json(
    await snapshot({ page, pageSize, filter, q }),
  );
}

export async function POST(request: Request, context: Ctx) {
  const { slug } = await context.params;
  const denied = await guard(slug);
  if (denied) return denied;

  let body: {
    action?: string;
    contactIds?: string[];
    contactId?: string;
    limit?: number;
    page?: number;
    pageSize?: number;
    filter?: OutreachContactFilter;
    q?: string;
    settings?: OutreachSettingsPatch;
    letterDraft?: {
      subjectTemplate?: string;
      textTemplate?: string;
    };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const action = body.action?.trim();
  const pageOpts = {
    page: body.page,
    pageSize: body.pageSize,
    filter: body.filter,
    q: body.q,
  };

  if (action === "scan") {
    if (!beginOutreachJob("scan", "Сканирование Checko…")) {
      return jobBusyResponse();
    }
    try {
      const result = await runOutreachScan();
      finishOutreachJob(result.ok ? undefined : result.error);
      return NextResponse.json({
        ...(await snapshot(pageOpts)),
        ok: result.ok,
        result,
        error: result.error,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка скана";
      finishOutreachJob(message);
      return NextResponse.json({
        ...(await snapshot(pageOpts)),
        ok: false,
        error: message,
      });
    }
  }

  if (action === "enrich") {
    if (!beginOutreachJob("enrich", "Получение email…")) {
      return jobBusyResponse();
    }
    try {
      const result = await runOutreachEnrich(
        typeof body.limit === "number" ? body.limit : undefined,
      );
      finishOutreachJob(result.ok ? undefined : result.error);
      return NextResponse.json({
        ...(await snapshot(pageOpts)),
        ok: result.ok,
        result,
        error: result.error,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка enrich";
      finishOutreachJob(message);
      return NextResponse.json({
        ...(await snapshot(pageOpts)),
        ok: false,
        error: message,
      });
    }
  }

  if (action === "preview_letter") {
    const draft = body.letterDraft || {};
    const letter = buildRevenShareOutreachLetter(
      {
        companyName: "ООО «Пример»",
        recipientEmail: "preview@example.com",
      },
      {
        subjectTemplate:
          draft.subjectTemplate?.trim() || DEFAULT_LETTER.subjectTemplate,
        textTemplate:
          draft.textTemplate?.trim() || DEFAULT_LETTER.textTemplate,
      },
    );
    return NextResponse.json({
      ok: true,
      letter,
    });
  }

  if (action === "save_settings") {
    const patch = body.settings || {};
    const saved = await writeOutreachConfig(patch);
    await getOutreachConfig();
    return NextResponse.json({
      ...(await snapshot(pageOpts)),
      ok: true,
      saved,
    });
  }

  if (action === "schedule_preview") {
    const preview = await previewOutreachTick();
    return NextResponse.json({
      ...(await snapshot(pageOpts)),
      ok: true,
      preview,
    });
  }

  if (action === "tick") {
    // force: ручной прогон из UI, даже если schedule.enabled=false
    const result = await runOutreachTick({ force: true });
    return NextResponse.json({
      ...(await snapshot(pageOpts)),
      ok: result.ok,
      tick: result,
      error: result.error || result.skippedReason,
    });
  }

  if (action === "probe") {
    if (!beginOutreachJob("probe", "Проверка Checko…")) {
      return jobBusyResponse();
    }
    const settings = await getOutreachSettingsView();
    const ok = settings.checko.profileFound && settings.checko.browsersFound;
    finishOutreachJob(
      ok
        ? undefined
        : !settings.checko.profileFound
          ? "Профиль Checko не найден"
          : "Браузер Playwright не найден",
    );
    return NextResponse.json({
      ...(await snapshot(pageOpts)),
      ok,
      probe: settings.checko,
      error: ok ? undefined : getOutreachJobStatus().lastError,
    });
  }

  if (action === "test_send") {
    const mailCfg = getMailConfigStatus();
    const cfg = await getOutreachConfig();
    const operator =
      cfg.operatorEmail ||
      process.env.OUTREACH_OPERATOR_EMAIL?.trim() ||
      mailCfg.overrideTo ||
      "";
    if (!operator) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Задайте email оператора в Настройках или OUTREACH_MAIL_OVERRIDE_TO",
        },
        { status: 400 },
      );
    }
    if (!mailCfg.configured) {
      return NextResponse.json(
        { ok: false, error: "SMTP не настроен" },
        { status: 400 },
      );
    }

    if (!beginOutreachJob("test_send", "Тестовое письмо…")) {
      return jobBusyResponse();
    }
    const letter = await buildRevenShareOutreachLetterAsync({
      companyName: "ООО «Пример»",
      recipientEmail: operator,
    });

    try {
      const result = await sendMail({
        to: operator,
        subject: `[тест] ${letter.subject}`,
        text: letter.text,
        html: letter.html,
        skipOverride: true,
      });
      finishOutreachJob(result.ok ? undefined : result.error);
      return NextResponse.json({
        ...(await snapshot(pageOpts)),
        ok: result.ok,
        testTo: operator,
        error: result.ok ? undefined : result.error,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка теста";
      finishOutreachJob(message);
      return NextResponse.json({
        ...(await snapshot(pageOpts)),
        ok: false,
        error: message,
      });
    }
  }

  if (action === "send") {
    const ids = Array.isArray(body.contactIds)
      ? body.contactIds.filter(Boolean)
      : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Не выбраны контакты" },
        { status: 400 },
      );
    }

    if (!beginOutreachJob("send", "Отправка писем…")) {
      return jobBusyResponse();
    }
    try {
      const batch = await sendOutreachBatch(ids);
      finishOutreachJob(batch.failed ? `${batch.failed} ошибок` : undefined);
      return NextResponse.json({
        ...(await snapshot(pageOpts)),
        ok: batch.failed === 0,
        sent: batch.sent,
        failed: batch.failed,
        skipped: batch.skipped,
        capped: batch.capped,
        errors: batch.errors,
        brand: IP.brand,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка отправки";
      finishOutreachJob(message);
      return NextResponse.json({
        ...(await snapshot(pageOpts)),
        ok: false,
        error: message,
      });
    }
  }

  if (action === "retry_send") {
    const contactId = typeof body.contactId === "string" ? body.contactId : "";
    if (!contactId) {
      return NextResponse.json(
        { ok: false, error: "Не указан контакт" },
        { status: 400 },
      );
    }

    if (!beginOutreachJob("send", "Повторная отправка…")) {
      return jobBusyResponse();
    }
    try {
      const batch = await sendOutreachBatch([contactId]);
      finishOutreachJob(batch.failed ? `${batch.failed} ошибок` : undefined);
      return NextResponse.json({
        ...(await snapshot(pageOpts)),
        ok: batch.failed === 0 && batch.sent > 0,
        sent: batch.sent,
        failed: batch.failed,
        skipped: batch.skipped,
        errors: batch.errors,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка отправки";
      finishOutreachJob(message);
      return NextResponse.json({
        ...(await snapshot(pageOpts)),
        ok: false,
        error: message,
      });
    }
  }

  return NextResponse.json({ ok: false, error: "Неизвестное действие" }, { status: 400 });
}
