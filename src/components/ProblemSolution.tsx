import styles from "./ProblemSolution.module.css";

const PAIN = [
  "Платите за макет вперёд — заявок может так и не быть.",
  "Правки «закончились», а сайт ещё не продаёт.",
  "Непонятно, окупается ли канал и кто за это отвечает.",
];

const FIX = [
  "Сначала демостенд и правки — договор, когда устраивает результат.",
  "Платите 10% с заявок клиентов, которые пришли с сайта.",
  "Правила в договоре: атрибуция, ежемесячная сверка, понятный выход.",
];

export function ProblemSolution() {
  return (
    <section className={styles.section} aria-labelledby="problem-title">
      <div className={styles.inner}>
        <article className={`${styles.card} ${styles.pain}`}>
          <div className={styles.head}>
            <span className={`${styles.icon} ${styles.iconWarn}`} aria-hidden="true">
              !
            </span>
            <h2 id="problem-title">Знакомо?</h2>
          </div>
          <ul className={styles.list}>
            {PAIN.map((item) => (
              <li key={item}>
                <span className={styles.markWarn} aria-hidden="true">
                  ×
                </span>
                {item}
              </li>
            ))}
          </ul>
        </article>
        <article className={`${styles.card} ${styles.fix}`}>
          <div className={styles.head}>
            <span className={`${styles.icon} ${styles.iconOk}`} aria-hidden="true">
              ✓
            </span>
            <h2>Мы делаем иначе</h2>
          </div>
          <ul className={styles.list}>
            {FIX.map((item) => (
              <li key={item}>
                <span className={styles.markOk} aria-hidden="true">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
