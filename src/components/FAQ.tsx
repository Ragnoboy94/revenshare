import { FAQ_ITEMS } from "@/lib/faq";
import styles from "./FAQ.module.css";

export function FAQ() {
  return (
    <section className={styles.section} id="faq" aria-labelledby="faq-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Ответы</p>
        <h2 id="faq-title">Ответы на важные вопросы</h2>
        <p className={styles.sub}>
          Предоплата, демостенд, 10%, выкуп, код и хостинг — коротко и по делу.
        </p>
        <div className={styles.list}>
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className={styles.item}>
              <summary>
                <span>{item.q}</span>
              </summary>
              <div className={styles.answer}>
                <p>{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
