export type CardStatus = "wish" | "planned" | "in_progress" | "done";
export type CardAuthor = "client" | "admin";

export type BoardCard = {
  id: string;
  title: string;
  body: string;
  status: CardStatus;
  author: CardAuthor;
  /** Short reply from RevenShare, visible to the client. */
  reply: string;
  createdAt: string;
  updatedAt: string;
};

export type Board = {
  id: string;
  /** Secret URL segment for /c/<token> */
  token: string;
  title: string;
  clientName: string;
  /** Linked demo folder slug from demo-workspace, empty if none. */
  demoSlug: string;
  createdAt: string;
  updatedAt: string;
  cards: BoardCard[];
};

export const CARD_STATUSES: CardStatus[] = [
  "wish",
  "planned",
  "in_progress",
  "done",
];

export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  wish: "Пожелание",
  planned: "В плане",
  in_progress: "В работе",
  done: "Готово",
};

/** Safe public payload for the client board page. */
export function toClientBoard(board: Board) {
  return {
    title: board.title,
    clientName: board.clientName,
    cards: board.cards.map((card) => ({
      id: card.id,
      title: card.title,
      body: card.body,
      status: card.status,
      author: card.author,
      reply: card.reply,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    })),
  };
}
