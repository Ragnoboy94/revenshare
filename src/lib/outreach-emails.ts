/** Клиент-безопасные хелперы email (без fs). */

export function contactEmailList(c: {
  email?: string;
  emails?: string[] | null;
}): string[] {
  const out: string[] = [];
  for (const raw of [...(c.emails ?? []), c.email ?? ""]) {
    const email = raw.trim().toLowerCase();
    if (email && !out.includes(email)) out.push(email);
  }
  return out;
}
