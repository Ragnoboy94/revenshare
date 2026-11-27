import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  at: string;
  weak?: boolean;
};

export type ChatSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  ip: string;
  weakStreak: number;
  messages: ChatMessage[];
};

type StoreFile = {
  sessions: ChatSession[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "chats.json");

/** Лимиты, чтобы не раздувать диск на VPS. */
const MAX_SESSIONS = 200;
const MAX_MESSAGES = 40;

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || !Array.isArray(parsed.sessions)) return { sessions: [] };
    return parsed;
  } catch {
    return { sessions: [] };
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  // свежие сверху, старые обрезаем
  store.sessions = store.sessions
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_SESSIONS);
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(value);
}

export async function listChatSessions(): Promise<ChatSession[]> {
  const store = await readStore();
  return store.sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  const store = await readStore();
  return store.sessions.find((s) => s.id === id) ?? null;
}

export async function appendChatTurn(input: {
  sessionId?: string;
  ip: string;
  userText: string;
  assistantText: string;
  weak: boolean;
}): Promise<ChatSession> {
  const store = await readStore();
  const now = new Date().toISOString();
  let session = input.sessionId
    ? store.sessions.find((s) => s.id === input.sessionId)
    : undefined;

  if (!session) {
    session = {
      id: input.sessionId && isSessionId(input.sessionId) ? input.sessionId : randomUUID(),
      createdAt: now,
      updatedAt: now,
      ip: input.ip,
      weakStreak: 0,
      messages: [],
    };
    store.sessions.unshift(session);
  }

  session.updatedAt = now;
  session.ip = input.ip || session.ip;
  session.weakStreak = input.weak ? session.weakStreak + 1 : 0;
  session.messages.push(
    { role: "user", content: input.userText.slice(0, 300), at: now },
    {
      role: "assistant",
      content: input.assistantText.slice(0, 2000),
      at: now,
      weak: input.weak || undefined,
    },
  );
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }

  await writeStore(store);
  return session;
}
