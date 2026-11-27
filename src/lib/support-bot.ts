import { promises as fs } from "fs";
import path from "path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "content", "support-bot");
/** Факты и готовые ответы из пакета инструкций (без ALL_IN_ONE — дубль). */
const ALLOWED_KNOWLEDGE = [
  "05_SCENARIOS_AND_REPLIES.md",
  "04_REVENSHARE_KNOWLEDGE.md",
] as const;

export const MAX_MESSAGE_CHARS = 300;
const MAX_HISTORY = 6;
const CACHE_MS = 15_000;
type ChatTurn = { role: "user" | "assistant"; content: string };

type KnowledgeChunk = {
  title: string;
  body: string;
  tokens: Set<string>;
  titleTokens: Set<string>;
  negative: boolean;
  fromScenarios: boolean;
};

const STOP = new Set([
  "и",
  "в",
  "во",
  "на",
  "с",
  "со",
  "к",
  "ко",
  "о",
  "об",
  "по",
  "для",
  "из",
  "у",
  "от",
  "до",
  "за",
  "а",
  "но",
  "или",
  "же",
  "ли",
  "бы",
  "как",
  "что",
  "это",
  "эта",
  "этот",
  "эти",
  "то",
  "так",
  "там",
  "тут",
  "есть",
  "быть",
  "был",
  "была",
  "были",
  "не",
  "ни",
  "да",
  "нет",
  "мне",
  "меня",
  "мой",
  "моя",
  "мы",
  "вы",
  "ваш",
  "ваша",
  "вас",
  "нам",
  "нас",
  "он",
  "она",
  "они",
  "его",
  "её",
  "их",
  "если",
  "когда",
  "где",
  "чем",
  "про",
  "можно",
  "нужно",
  "хочу",
  "скажите",
  "подскажите",
  "расскажите",
  "пожалуйста",
  "здравствуйте",
  "привет",
  "добрый",
  "день",
  "вечер",
]);

const FALLBACK =
  "Не хочу придумывать ответ вне проверенных условий. Кратко: без предоплаты за разработку, демо до договора, 10% с заявок с сайта. Уточните вопрос или оставьте заявку через форму «Обсудить проект» — либо напишите на info@revenshare.ru.";

const GREETING_REPLY =
  "Здравствуйте! Чем могу помочь — условия, демостенд, 10% с заявок или подойдёт ли модель вашему бизнесу?";

const GREETING_AGAIN =
  "Ещё раз здравствуйте. Напишите, пожалуйста, конкретный вопрос по условиям — так смогу ответить по делу.";

const IDENTITY_REPLY =
  "Да, я ИИ-помощник RevenShare, не живой человек. Скрывать нечего — могу быстро разложить условия. Что хотите узнать?";

let cachedChunks: { at: number; chunks: KnowledgeChunk[] } | null = null;

/** Только приветствие без вопроса. */
export function isGreetingOnly(text: string): boolean {
  const t = text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[!?.,…🙂😊😉]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.length > 40) return false;
  return /^(привет|здрасте|здравствуй(те)?|добрый\s+(день|вечер|утро)|доброго\s+(дня|вечера|утра)|хай|хелло|hello|hi|hey|йоу|салют)$/i.test(
    t,
  );
}

async function readMd(name: string): Promise<string> {
  return (await fs.readFile(path.join(KNOWLEDGE_DIR, name), "utf8")).trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9%]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function stemRough(token: string): string {
  // лёгкая обрезка русских окончаний — без внешних либ
  if (token.length <= 4) return token;
  // унификация «подойдёт / подходит»
  if (/^подойд/.test(token) || /^подход/.test(token)) return "подход";
  if (/^компани/.test(token)) return "компани";
  if (/^бесплатн/.test(token)) return "бесплатн";
  if (/^стоимость|^стоит$|^цена$|^цену$|^цены$/.test(token)) return "цена";
  return token
    .replace(/(иями|ями|ами|ого|ему|ыми|ими|ая|яя|ое|ее|ые|ие|ой|ый|ий|ом|ем|ах|ях|ам|ям|ов|ев|ей|ью|ии|ию|ия)$/u, "")
    .replace(/(ться|тся|ешь|ете|ют|ат|ят|ил|ыл|ал|ла|ли|ть|ти)$/u, "");
}

function tokenSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of tokenize(text)) {
    out.add(t);
    out.add(stemRough(t));
  }
  return out;
}

/** Убрать служебные указания автору бота — их нельзя показывать посетителю. */
function isInstructionLine(line: string): boolean {
  return /^(не\s+(говори|называй|обещай|выдумывай|придумывай|сообщай|утверждай|упрощай|превращай)\b|\*{0,2}критически важно:|если\s+(посетитель|спрашивают|человек\s+спрашивает)\b)/i.test(
    line,
  );
}

function toPublicAnswer(raw: string): string {
  const lines = raw
    .split(/\n+/)
    .flatMap((line) => {
      const t = line.replace(/^[-*]\s+/, "").replace(/^\*{1,2}/, "").replace(/\*{1,2}$/, "").trim();
      if (!t) return [];
      // если в одной строке склеены буллеты через " - "
      if (/\s-\s/.test(t) && t.length > 80) {
        return t.split(/\s-\s+/).map((x) => x.trim()).filter(Boolean);
      }
      return [t];
    })
    .filter((line) => line.length > 2 && !isInstructionLine(line));

  return lines
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function splitSections(md: string, fromScenarios: boolean): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  // ## и ### — отдельные куски (у knowledge много подразделов)
  const parts = md.split(/^#{2,3}\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const title = (nl === -1 ? part : part.slice(0, nl)).trim();
    let body = nl === -1 ? "" : part.slice(nl + 1).trim();
    if (!title || !body) continue;

    // в сценариях берём готовый ответ в кавычках «…», без служебных пометок
    if (fromScenarios) {
      const quotes = [...body.replace(/\s+/g, " ").matchAll(/«([^»]{12,})»/g)].map((m) => m[1].trim());
      if (quotes.length > 0) body = quotes[0]!;
      else body = toPublicAnswer(body);
    } else {
      body = toPublicAnswer(body);
      if (!body) continue;
    }

    const titleTokens = tokenSet(title);
    chunks.push({
      title,
      body,
      // для матчинга — и заголовок, и очищенный текст (без инструкций)
      tokens: tokenSet(`${title} ${body}`),
      titleTokens,
      // \b плохо работает с кириллицей в JS
      negative: /(^|[^а-яёa-z0-9])не([^а-яёa-z0-9]|$)/i.test(title),
      fromScenarios,
    });
  }
  return chunks;
}

async function loadChunks(): Promise<KnowledgeChunk[]> {
  const now = Date.now();
  if (cachedChunks && now - cachedChunks.at < CACHE_MS) {
    return cachedChunks.chunks;
  }

  const chunks: KnowledgeChunk[] = [];
  for (const name of ALLOWED_KNOWLEDGE) {
    try {
      const fromScenarios = name.startsWith("05_");
      chunks.push(...splitSections(await readMd(name), fromScenarios));
    } catch {
      // файл отсутствует — пропускаем
    }
  }

  cachedChunks = { at: now, chunks };
  return chunks;
}

/** Вопрос «ты бот / живой / человек / реальный?» — не путать с «нужен живой человек». */
export function isAiIdentityQuestion(q: string): boolean {
  const asksIdentity =
    /(ты|вы|это)\s+(бот|ии|нейросет|живой|жива|реален|реальная)|бот\s*\?|(реальн\w*|живой)\s+человек|ты\s+человек|вы\s+человек|это\s+человек|ты\s+живой|вы\s+живой/i.test(
      q,
    );
  const wantsHuman =
    /(нужен|нужна|хочу|дайте|позови|свяж|поговорит|общатьс).{0,30}(человек|серге|менеджер|оператор)/i.test(q);
  return asksIdentity && !wantsHuman;
}

function isHumanHandoffRequest(q: string): boolean {
  return /(нужен|нужна|хочу|дайте|позови|свяж|поговорит|общатьс).{0,30}(человек|серге|менеджер|оператор)/i.test(
    q,
  );
}

function scoreChunk(queryTokens: Set<string>, queryRaw: string, chunk: KnowledgeChunk): number {
  let hits = 0;
  let titleHits = 0;
  for (const t of queryTokens) {
    if (chunk.tokens.has(t)) hits += 1;
    if (chunk.titleTokens.has(t)) titleHits += 1;
  }
  if (hits === 0 && titleHits === 0) return 0;

  let score = hits + titleHits * 2.5 + hits / Math.sqrt(chunk.tokens.size + 1);
  if (chunk.fromScenarios) {
    // сценарии — готовые человеческие ответы; приоритетнее сырых knowledge-блоков
    score += titleHits > 0 ? 2.5 : -1;
    if (titleHits === 0) score *= 0.4;
    else score += 2;
  } else {
    // knowledge — запасной источник фактов
    score *= 0.5;
  }

  const qNeg = /(^|[^а-яёa-z0-9])не([^а-яёa-z0-9]|$)/i.test(queryRaw);
  if (chunk.negative && !qNeg) score -= 4;
  if (chunk.negative && qNeg) score += 4;
  if (!chunk.negative && qNeg && /подход/i.test(queryRaw)) score -= 2;

  const title = chunk.title;
  if (isAiIdentityQuestion(queryRaw)) {
    if (/бот|ии\b|реальн/i.test(title) && !/нужен|позовите|поговорить с человеком/i.test(title)) {
      score += 10;
    }
    if (/нужен.*человек|живой человек|позовите серге/i.test(title)) {
      score -= 12;
    }
  }
  if (isHumanHandoffRequest(queryRaw)) {
    if (/нужен.*человек|живой человек|позовите серге|поговорить с человеком/i.test(title)) {
      score += 10;
    }
  }

  return score;
}

function formatAnswer(chunk: KnowledgeChunk, queryRaw: string): string {
  let body = toPublicAnswer(chunk.body) || chunk.body;
  const qNeg = /(^|[^а-яёa-z0-9])не([^а-яёa-z0-9]|$)/i.test(queryRaw);
  // в блоке «кому подходит» вырезаем нужную половину
  if (/подход/i.test(chunk.title) && /скорее подходит/i.test(body) && /скорее не подходит/i.test(body)) {
    const negAt = body.search(/скорее не подходит/i);
    const posAt = body.search(/скорее подходит/i);
    if (qNeg && negAt >= 0) body = body.slice(negAt);
    else if (!qNeg && posAt >= 0 && negAt > posAt) body = body.slice(posAt, negAt).trim();
  }
  if (body.length > 700) body = `${body.slice(0, 680).trim()}…`;
  if (/обсудить проект|info@revenshare|серге/i.test(body)) return body;
  if (chunk.fromScenarios) return body;
  return `${body}\n\nЕсли нужно — форма «Обсудить проект» или info@revenshare.ru.`;
}

export function normalizeMessages(input: unknown): ChatTurn[] | { error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "Нужно хотя бы одно сообщение" };
  }

  const turns: ChatTurn[] = [];
  for (const item of input.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      continue;
    }
    const trimmed = content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!trimmed) continue;
    turns.push({ role, content: trimmed });
  }

  if (turns.length === 0) return { error: "Пустые сообщения" };
  if (turns[turns.length - 1]?.role !== "user") {
    return { error: "Последнее сообщение должно быть от пользователя" };
  }
  return turns;
}

export type LocalAnswer = { reply: string; weak: boolean };

/** Локальный ответчик: только md-база, без внешних API и ключей. */
export async function answerLocally(messages: ChatTurn[]): Promise<LocalAnswer> {
  const last = messages[messages.length - 1]?.content ?? "";

  if (isGreetingOnly(last)) {
    const greetingCount = messages.filter((m) => m.role === "user" && isGreetingOnly(m.content)).length;
    if (greetingCount <= 1) {
      // первый привет — вежливо, без «слабого» штрафа
      return { reply: GREETING_REPLY, weak: false };
    }
    // повторный привет без вопроса — уже можно мягко направить
    return { reply: GREETING_AGAIN, weak: true };
  }

  if (isAiIdentityQuestion(last)) {
    return { reply: IDENTITY_REPLY, weak: false };
  }

  const query = tokenSet(last);
  const chunks = await loadChunks();

  if (chunks.length === 0) {
    return { reply: FALLBACK, weak: true };
  }

  let best: KnowledgeChunk | null = null;
  let bestScore = 0;
  for (const chunk of chunks) {
    const s = scoreChunk(query, last, chunk);
    if (s > bestScore) {
      bestScore = s;
      best = chunk;
    }
  }

  // минимум одно содержательное совпадение
  if (!best || bestScore < 1) {
    return { reply: FALLBACK, weak: true };
  }

  return { reply: formatAnswer(best, last), weak: false };
}
