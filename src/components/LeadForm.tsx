"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  maskPhoneInput,
  normalizePhone,
  validateLeadPayload,
} from "@/lib/lead-validate";
import { IP } from "@/lib/ip";
import styles from "./LeadForm.module.css";

type Status = "idle" | "loading" | "ok" | "error";

export function LeadForm() {
  const formStartedAt = useMemo(() => Date.now(), []);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: String(data.get("name") ?? ""),
      contact: phone,
      niche: String(data.get("niche") ?? ""),
      comment: String(data.get("comment") ?? ""),
      company: String(data.get("company") ?? ""),
      formStartedAt,
    };

    const local = validateLeadPayload(payload);
    if (!local.ok) {
      if (local.silent) {
        setStatus("ok");
        setMessage("Заявка принята. Свяжемся в ближайшее время.");
        form.reset();
        setPhone("");
        return;
      }
      setStatus("error");
      setMessage(local.error);
      return;
    }

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...local.data,
          company: payload.company,
          formStartedAt: payload.formStartedAt,
        }),
      });

      const json = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Не удалось отправить заявку");
      }

      setStatus("ok");
      setMessage("Заявка принята. Свяжемся в ближайшее время.");
      form.reset();
      setPhone("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка отправки");
    }
  }

  const phoneOk = phone ? normalizePhone(phone).ok : false;

  return (
    <section className={styles.section} id="lead" aria-labelledby="lead-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Следующий шаг</p>
          <h2 id="lead-title">Обсудить проект</h2>
          <p className={styles.sub}>
            Коротко опишите нишу и телефон. На созвоне разберём модель {IP.brand} —
            демостенд, 10% с заявок с сайта или выкуп 29 000 ₽.
          </p>
          <ul className={styles.perks}>
            <li>
              <span className={styles.perkIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12.5 9.2 17 19 7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Ответ в рабочее время
            </li>
            <li>
              <span className={styles.perkIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3.5 19 6.5v5.2c0 4.4-2.9 7.6-7 9.3-4.1-1.7-7-4.9-7-9.3V6.5L12 3.5Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Демо до договора
            </li>
            <li>
              <span className={styles.perkIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M12 8v4.2l2.6 1.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </span>
              Без предоплаты за разработку
            </li>
          </ul>
        </div>

        <form className={styles.form} onSubmit={onSubmit} noValidate autoComplete="on">
          <div className={styles.hp} aria-hidden="true">
            <label>
              Название компании
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
              />
            </label>
          </div>

          <label className={styles.field}>
            <input
              name="name"
              type="text"
              autoComplete="name"
              required
              maxLength={80}
              placeholder=" "
            />
            <span className={styles.float}>Имя</span>
          </label>

          <label className={styles.field}>
            <input
              name="contact"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={18}
              placeholder=" "
              value={phone}
              onChange={(e) => setPhone(maskPhoneInput(e.target.value, phone))}
            />
            <span className={styles.float}>Телефон</span>
            {phone ? (
              <span className={phoneOk ? styles.hintOk : styles.hintBad}>
                {phoneOk ? "Номер принят" : "Нужен полный номер +7 и 10 цифр"}
              </span>
            ) : null}
          </label>

          <label className={styles.field}>
            <input name="niche" type="text" required maxLength={160} placeholder=" " />
            <span className={styles.float}>Ниша / чем занимаетесь</span>
          </label>

          <label className={`${styles.field} ${styles.fieldArea}`}>
            <textarea name="comment" rows={2} maxLength={1000} placeholder=" " />
            <span className={styles.float}>Комментарий (необязательно)</span>
          </label>

          <p className={styles.legal}>
            Нажимая кнопку, вы соглашаетесь с{" "}
            <a href="/privacy">политикой обработки персональных данных</a>.
          </p>
          <button
            type="submit"
            className={`btn btnLg ${styles.submit}`}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Отправляем…" : "Отправить заявку"}
          </button>
          {message ? (
            <p
              className={status === "ok" ? styles.ok : styles.err}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
