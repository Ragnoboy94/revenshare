import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    n: "01",
    title: "Созвон",
    text: "Разбираем нишу, спрос и подходит ли модель под ваш бизнес.",
    icon: "phone",
  },
  {
    n: "02",
    title: "Демостенд",
    text: "Собираем сайт и правим дизайн с функционалом до договора.",
    icon: "code",
  },
  {
    n: "03",
    title: "Договор",
    text: "Фиксируем 10%, атрибуцию, хостинг и условия выкупа.",
    icon: "doc",
  },
  {
    n: "04",
    title: "Публикация",
    text: "Выкладываем на хостинг: 3 месяца за наш счёт, домен — ваш.",
    icon: "host",
  },
  {
    n: "05",
    title: "Развитие и сверка",
    text: "Вносим правки по запросу; раз в месяц — % с заявок с сайта.",
    icon: "check",
  },
] as const;

function StepIcon({ name }: { name: (typeof STEPS)[number]["icon"] }) {
  if (name === "phone") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8.2 4.5h2.1l1 3.1-1.5 1a11 11 0 0 0 5.6 5.6l1-1.5 3.1 1v2.1a1.8 1.8 0 0 1-1.8 1.8A14.2 14.2 0 0 1 4.5 6.3 1.8 1.8 0 0 1 6.3 4.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "doc") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M14 3.5V8h4.5M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "code") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9 7.5 4.5 12 9 16.5M15 7.5 19.5 12 15 16.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "host") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="4.5" width="16" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
        <rect x="4" y="11" width="16" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 7h0.01M7 13.5h0.01M12 19.5h0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M8 19.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.2 12.2 10.8 14.8 15.8 9.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HowItWorks() {
  return (
    <section className={styles.section} id="how" aria-labelledby="how-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Процесс</p>
        <h2 id="how-title">Как это работает</h2>
        <p className={styles.sub}>
          От созвона и демостенда до публикации, развития и ежемесячной сверки.
        </p>
        <ol className={styles.list}>
          {STEPS.map((step, index) => (
            <li key={step.n} className={styles.item}>
              {index < STEPS.length - 1 ? (
                <span className={styles.connector} aria-hidden="true" />
              ) : null}
              <div className={styles.head} aria-hidden="true">
                <span className={styles.badge}>{step.n}</span>
                <span className={styles.icon}>
                  <StepIcon name={step.icon} />
                </span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
