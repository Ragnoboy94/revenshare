import styles from "./WhyBento.module.css";

export function WhyBento() {
  return (
    <section className={styles.section} id="why" aria-labelledby="why-title">
      <div className={styles.inner}>
        <h2 id="why-title">Почему это выгодно</h2>
        <div className={styles.bento}>
          <article className={`${styles.card} ${styles.large}`}>
            <p className={styles.metric}>0 ₽</p>
            <h3>предоплаты</h3>
            <p className={styles.text}>
              Разработку делаем за свой счёт. Сначала демостенд и правки — договор, когда
              устраивает результат.
            </p>
          </article>
          <article className={styles.card}>
            <p className={styles.metric}>10%</p>
            <h3>с заявок с сайта</h3>
            <p className={styles.text}>
              Со всех заявок клиентов, пришедших с сайта, включая повторные.
            </p>
          </article>
          <article className={styles.card}>
            <h3>Выкуп 29 000 ₽</h3>
            <p className={styles.text}>
              Если через 3 месяца заявок с сайта нет — понятный выход по договору.
            </p>
          </article>
          <article className={`${styles.card} ${styles.wide}`}>
            <h3>Интересы совпадают</h3>
            <p className={styles.text}>
              Нам невыгодно делать красивый, но бесполезный сайт. Зарабатываем, когда сайт
              приводит заявки.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
