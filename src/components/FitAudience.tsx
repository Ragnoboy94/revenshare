import styles from "./FitAudience.module.css";

const YES = [
  "Есть спрос и заявки онлайн — сайт может стать каналом продаж.",
  "Маржа позволяет отдавать 10% с заявки клиента, пришедшего с сайта.",
  "Готовы к учёту источников и ежемесячной сверке.",
];

const NO = [
  "Продажи только офлайн, без трекинга заявок с сайта.",
  "Очень низкий чек — процент с заявки экономически не тянется.",
  "Нужен «сайт ради сайта» — без продаж и прозрачности.",
];

const WHY = [
  "Без предоплаты за разработку — демо до договора",
  "Понятный выход: 10% с заявок или выкуп 29 000 ₽",
  "Рост от лендинга до CRM правками по запросу",
];

export function FitAudience() {
  return (
    <section className={styles.section} id="fit" aria-labelledby="fit-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Отбор</p>
        <h2 id="fit-title">Кому подходит модель</h2>
        <p className={styles.sub}>
          Берём проекты, где сайт реально приводит заявки — не «сдачу макета».
        </p>

        <div className={styles.grid}>
          <div className={`${styles.card} ${styles.yesCard}`}>
            <h3>
              <span className={styles.titleMarkYes} aria-hidden="true">
                ✓
              </span>
              Подходит
            </h3>
            <ul>
              {YES.map((item) => (
                <li key={item}>
                  <span className={styles.yesMark} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${styles.card} ${styles.noCard}`}>
            <h3>
              <span className={styles.titleMarkNo} aria-hidden="true">
                ×
              </span>
              Не подходит
            </h3>
            <ul>
              {NO.map((item) => (
                <li key={item}>
                  <span className={styles.noMark} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className={styles.why} aria-label="Почему это выгодно клиенту">
          <div className={styles.whyHead}>
            <span className={styles.trend} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 16.5 10 10.5l3.5 3.5L20 7.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M15 7.5h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <p className={styles.whyTitle}>Почему это выгодно клиенту</p>
          </div>
          <ul className={styles.whyList}>
            {WHY.map((item) => (
              <li key={item}>
                <span className={styles.whyCheck} aria-hidden="true">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
