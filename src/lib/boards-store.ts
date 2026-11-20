import { randomBytes, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  CARD_STATUSES,
  type Board,
  type BoardCard,
  type CardAuthor,
  type CardStatus,
} from "@/lib/boards-shared";

export type {
  Board,
  BoardCard,
  CardAuthor,
  CardStatus,
} from "@/lib/boards-shared";
export {
  CARD_STATUSES,
  CARD_STATUS_LABEL,
  toClientBoard,
} from "@/lib/boards-shared";

type StoreFile = {
  boards: Board[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "boards.json");

function normalizeBoard(raw: Board): Board {
  return {
    ...raw,
    demoSlug:
      typeof raw.demoSlug === "string" ? raw.demoSlug.trim().toLowerCase() : "",
    cards: Array.isArray(raw.cards) ? raw.cards : [],
  };
}

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || !Array.isArray(parsed.boards)) return { boards: [] };
    return { boards: parsed.boards.map(normalizeBoard) };
  } catch {
    return { boards: [] };
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function makeToken(): string {
  return `rc-${randomBytes(12).toString("hex")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function trimText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function listBoards(): Promise<Board[]> {
  const store = await readStore();
  return store.boards;
}

export async function getBoardById(id: string): Promise<Board | null> {
  const store = await readStore();
  return store.boards.find((board) => board.id === id) ?? null;
}

export async function getBoardByToken(token: string): Promise<Board | null> {
  if (!/^rc-[a-f0-9]{24}$/i.test(token)) return null;
  const store = await readStore();
  return store.boards.find((board) => board.token === token) ?? null;
}

export async function getBoardByDemoSlug(
  demoSlug: string,
): Promise<Board | null> {
  const slug = trimText(demoSlug, 64).toLowerCase();
  if (!slug) return null;
  const store = await readStore();
  return store.boards.find((board) => board.demoSlug === slug) ?? null;
}

export async function createBoard(input: {
  title: string;
  clientName?: string;
  demoSlug?: string;
}): Promise<Board> {
  const title = trimText(input.title, 120);
  if (!title) throw new Error("Нужно название доски");

  const demoSlug = trimText(input.demoSlug, 64).toLowerCase();
  const store = await readStore();
  if (demoSlug && store.boards.some((board) => board.demoSlug === demoSlug)) {
    throw new Error("Для этого демо кабинет уже есть");
  }

  const stamp = nowIso();
  const board: Board = {
    id: randomUUID(),
    token: makeToken(),
    title,
    clientName: trimText(input.clientName, 120),
    demoSlug,
    createdAt: stamp,
    updatedAt: stamp,
    cards: [],
  };
  store.boards.unshift(board);
  await writeStore(store);
  return board;
}

/** Find board for a demo or create one on first open. */
export async function ensureBoardForDemo(input: {
  demoSlug: string;
  title: string;
}): Promise<{ board: Board; created: boolean }> {
  const demoSlug = trimText(input.demoSlug, 64).toLowerCase();
  if (!demoSlug) throw new Error("Нужен slug демо");
  const title = trimText(input.title, 120) || demoSlug;

  const existing = await getBoardByDemoSlug(demoSlug);
  if (existing) {
    if (existing.title !== title) {
      const store = await readStore();
      const row = store.boards.find((board) => board.id === existing.id);
      if (row) {
        row.title = title;
        row.updatedAt = nowIso();
        await writeStore(store);
        existing.title = title;
        existing.updatedAt = row.updatedAt;
      }
    }
    return { board: existing, created: false };
  }

  const board = await createBoard({
    title,
    demoSlug,
  });
  return { board, created: true };
}

export async function updateBoard(
  id: string,
  patch: { title?: string; clientName?: string },
): Promise<Board | null> {
  const store = await readStore();
  const board = store.boards.find((item) => item.id === id);
  if (!board) return null;

  if (patch.title !== undefined) {
    const title = trimText(patch.title, 120);
    if (!title) throw new Error("Нужно название доски");
    board.title = title;
  }
  if (patch.clientName !== undefined) {
    board.clientName = trimText(patch.clientName, 120);
  }
  board.updatedAt = nowIso();
  await writeStore(store);
  return board;
}

export async function deleteBoard(id: string): Promise<boolean> {
  const store = await readStore();
  const before = store.boards.length;
  store.boards = store.boards.filter((board) => board.id !== id);
  if (store.boards.length === before) return false;
  await writeStore(store);
  return true;
}

export async function addCard(
  boardId: string,
  input: {
    title: string;
    body?: string;
    author: CardAuthor;
    status?: CardStatus;
  },
): Promise<BoardCard | null> {
  const store = await readStore();
  const board = store.boards.find((item) => item.id === boardId);
  if (!board) return null;

  const title = trimText(input.title, 160);
  if (!title) throw new Error("Нужен заголовок");

  const status =
    input.status && CARD_STATUSES.includes(input.status)
      ? input.status
      : input.author === "client"
        ? "wish"
        : "planned";

  const stamp = nowIso();
  const card: BoardCard = {
    id: randomUUID(),
    title,
    body: trimText(input.body, 2000),
    status,
    author: input.author,
    reply: "",
    createdAt: stamp,
    updatedAt: stamp,
  };
  board.cards.unshift(card);
  board.updatedAt = stamp;
  await writeStore(store);
  return card;
}

export async function updateCard(
  boardId: string,
  cardId: string,
  patch: {
    title?: string;
    body?: string;
    status?: CardStatus;
    reply?: string;
  },
): Promise<BoardCard | null> {
  const store = await readStore();
  const board = store.boards.find((item) => item.id === boardId);
  if (!board) return null;
  const card = board.cards.find((item) => item.id === cardId);
  if (!card) return null;

  if (patch.title !== undefined) {
    const title = trimText(patch.title, 160);
    if (!title) throw new Error("Нужен заголовок");
    card.title = title;
  }
  if (patch.body !== undefined) card.body = trimText(patch.body, 2000);
  if (patch.status !== undefined) {
    if (!CARD_STATUSES.includes(patch.status)) {
      throw new Error("Некорректный статус");
    }
    card.status = patch.status;
  }
  if (patch.reply !== undefined) card.reply = trimText(patch.reply, 2000);

  const stamp = nowIso();
  card.updatedAt = stamp;
  board.updatedAt = stamp;
  await writeStore(store);
  return card;
}

export async function deleteCard(
  boardId: string,
  cardId: string,
): Promise<boolean> {
  const store = await readStore();
  const board = store.boards.find((item) => item.id === boardId);
  if (!board) return false;
  const before = board.cards.length;
  board.cards = board.cards.filter((card) => card.id !== cardId);
  if (board.cards.length === before) return false;
  board.updatedAt = nowIso();
  await writeStore(store);
  return true;
}
