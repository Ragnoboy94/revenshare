/** Shared lead validation / sanitization (client + server). Phone only. */

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TAGS = /<\/?[a-z][^>]*>/gi;
const SUSPICIOUS =
  /(\b(union\s+select|drop\s+table|insert\s+into|;\s*--|\/\*|\*\/)\b)|\$\{|`|<\s*script/i;

export function stripDangerous(value: string): string {
  return value.replace(CONTROL, "").replace(TAGS, "").trim();
}

export function looksSuspicious(value: string): boolean {
  return SUSPICIOUS.test(value);
}

/** Live mask: +7 (XXX) XXX-XX-XX. Pass previous value so Backspace can erase. */
export function maskPhoneInput(raw: string, previous = ""): string {
  const prevDigits = previous.replace(/\D/g, "");
  let digits = raw.replace(/\D/g, "");

  // Deleting a formatting char (")", " ", "-") keeps the same digits — drop one digit.
  if (
    previous &&
    raw.length < previous.length &&
    digits.length === prevDigits.length &&
    digits.length > 0
  ) {
    digits = digits.slice(0, -1);
  }

  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length > 0 && !digits.startsWith("7")) digits = `7${digits}`;
  digits = digits.slice(0, 11);

  if (!digits) return "";

  let out = `+${digits[0]}`;
  if (digits.length > 1) out += ` (${digits.slice(1, 4)}`;
  if (digits.length >= 4) out += ")";
  if (digits.length > 4) out += ` ${digits.slice(4, 7)}`;
  if (digits.length > 7) out += `-${digits.slice(7, 9)}`;
  if (digits.length > 9) out += `-${digits.slice(9, 11)}`;
  return out;
}

/** @deprecated use maskPhoneInput */
export const maskContactInput = maskPhoneInput;

export function normalizePhone(raw: string): { ok: true; value: string } | { ok: false; value: string } {
  const value = stripDangerous(raw);
  if (!value) return { ok: false, value: "" };

  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("8") && digits.length === 11) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  if (!/^7\d{10}$/.test(digits)) return { ok: false, value };

  return { ok: true, value: `+${digits}` };
}

/** @deprecated use normalizePhone */
export function normalizeContact(raw: string): {
  kind: "phone" | "invalid";
  value: string;
} {
  const n = normalizePhone(raw);
  return n.ok ? { kind: "phone", value: n.value } : { kind: "invalid", value: n.value };
}

export function isValidName(name: string): boolean {
  if (name.length < 2 || name.length > 80) return false;
  if (looksSuspicious(name)) return false;
  return /^[\p{L}\p{M}'’.\-\s]+$/u.test(name);
}

export function isValidNiche(niche: string): boolean {
  if (niche.length < 2 || niche.length > 160) return false;
  if (looksSuspicious(niche)) return false;
  return true;
}

export function isValidComment(comment: string): boolean {
  if (comment.length > 1000) return false;
  if (looksSuspicious(comment)) return false;
  return true;
}

export type LeadPayload = {
  name: string;
  contact: string;
  niche: string;
  comment: string;
  company?: string;
  formStartedAt?: number;
};

export type LeadValidationResult =
  | { ok: true; data: { name: string; contact: string; niche: string; comment: string } }
  | { ok: false; error: string; silent?: boolean };

export function validateLeadPayload(input: LeadPayload): LeadValidationResult {
  if (typeof input.company === "string" && input.company.trim() !== "") {
    return { ok: false, error: "rejected", silent: true };
  }

  if (typeof input.formStartedAt === "number" && Number.isFinite(input.formStartedAt)) {
    const elapsed = Date.now() - input.formStartedAt;
    if (elapsed >= 0 && elapsed < 1500) {
      return { ok: false, error: "rejected", silent: true };
    }
  }

  const name = stripDangerous(String(input.name ?? "")).slice(0, 80);
  const niche = stripDangerous(String(input.niche ?? "")).slice(0, 160);
  const comment = stripDangerous(String(input.comment ?? "")).slice(0, 1000);
  const contactRaw = String(input.contact ?? "");

  if (!isValidName(name)) {
    return { ok: false, error: "Укажите корректное имя (буквы, 2–80 символов)" };
  }
  if (!isValidNiche(niche)) {
    return { ok: false, error: "Укажите, чем занимается бизнес (2–160 символов)" };
  }
  if (!isValidComment(comment)) {
    return { ok: false, error: "Комментарий содержит недопустимые символы" };
  }

  const phone = normalizePhone(contactRaw);
  if (!phone.ok) {
    return { ok: false, error: "Укажите телефон в формате +7 XXX XXX-XX-XX" };
  }

  return {
    ok: true,
    data: {
      name,
      contact: phone.value,
      niche,
      comment,
    },
  };
}
