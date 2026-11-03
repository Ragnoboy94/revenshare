import styles from "./TermsClear.module.css";

const TERMS = [
  {
    title: "0 ₽ предоплаты",
    text: "Разработку делаем за свой счёт — без оплаты «за макет».",
  },
  {
    title: "Демо до договора",
    text: "Сайт на демостенде: правки дизайна и функций, пока не устроит.",
  },
  {
    title: "Хостинг 3 месяца",
    text: "После договора публикуем и держим хостинг 3 месяца за наш счёт.",
  },
  {
    title: "10% с заявок с сайта",
    text: "Со всех заявок клиентов, пришедших с сайта, включая повторные.",
  },
  {
    title: "Выкуп 29 000 ₽",
    text: "Если через 3 месяца заявок с сайта нет — понятный выход.",
  },
  {
    title: "Сверка раз в месяц",
    text: "Атрибуция и выплаты по договору — без скрытых абоненток.",
  },
] as const;

export function TermsClear() {
  return (
    <section className={styles.section} id="terms" aria-labelledby="terms-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Условия</p>
        <h2 id="terms-title">Прозрачные условия</h2>
        <p className={styles.sub}>
          Цифры и правила видны до заявки: без предоплаты, с понятным процентом и выходом.
        </p>
        <ul className={styles.grid}>
          {TERMS.map((item) => (
            <li key={item.title} className={styles.card}>
              <span className={styles.mark} aria-hidden="true" />
              <div>
                <p className={styles.cardTitle}>{item.title}</p>
                <p className={styles.cardText}>{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
