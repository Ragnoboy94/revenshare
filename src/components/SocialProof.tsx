import styles from "./SocialProof.module.css";

const ITEMS = [
  "Стоматологии",
  "Ремонт квартир",
  "Юридические услуги",
  "B2B-оборудование",
  "Сертификация",
];

export function SocialProof() {
  return (
    <section className={styles.section} aria-label="С кем уже работаем">
      <div className={styles.inner}>
        <span className={styles.label}>Уже работаем с:</span>
        <ul className={styles.list}>
          {ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
