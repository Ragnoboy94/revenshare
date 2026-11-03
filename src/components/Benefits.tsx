import styles from "./Benefits.module.css";

const FIT = [
  "Услуги с заявкой онлайн и повтором",
  "Сертификация, обучение, клиники, B2B-услуги, ремонт, логистика",
  "Маржа позволяет отдавать 10% с заявки клиента с сайта",
  "Готовы делиться Метрикой/CRM и подписывать сверки",
];

const NOT_FIT = [
  "Продажи в основном офлайн без трекинга",
  "Низкий чек — процент с заявки экономически не тянется",
  "Нужен «сайт ради сайта» без продаж и прозрачности",
  "Сложный портал или маркетплейс «ради галочки»",
];

export function Benefits() {
  return (
    <section className={styles.section} id="fit" aria-labelledby="fit-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Отбор</p>
        <h2 id="fit-title">Кому подходит модель</h2>
        <p className={styles.sub}>
          Берём проекты, где сайт реально приводит заявки — не «сдачу макета».
        </p>
        <div className={styles.grid}>
          <div>
            <h3>Подходит</h3>
            <ul>
              {FIT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Не подходит</h3>
            <ul>
              {NOT_FIT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
