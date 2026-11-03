import styles from "./ModelFlow.module.css";

const STEPS = [
  {
    title: "Заявка на сайте",
    text: "Клиент оставляет контакт через форму, корзину или звонок с сайта.",
  },
  {
    title: "Фиксация источника",
    text: "Источник «сайт» в учёте — Метрика, UTM, поле в CRM.",
  },
  {
    title: "Заявки с сайта",
    text: "В базу входят заявки клиентов с сайта, включая повторные.",
  },
  {
    title: "Вознаграждение",
    text: "10% с базы сверки раз в месяц — по правилам договора.",
  },
];

export function ModelFlow() {
  return (
    <section className={styles.section} id="model" aria-labelledby="model-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Модель RevenShare</p>
        <h2 id="model-title">Как формируется вознаграждение</h2>
        <p className={styles.sub}>
          Без предоплаты за разработку: платите 10% с заявок клиентов, пришедших с сайта.
        </p>
        <ol className={styles.track}>
          {STEPS.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.num} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
