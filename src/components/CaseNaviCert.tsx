import Image from "next/image";
import { IP } from "@/lib/ip";
import styles from "./CaseNaviCert.module.css";

const META = [
  { label: "Направление", value: "Центр сертификации продукции и услуг" },
  { label: "Реализовано", value: "Сайт, структура услуг, формы заявок" },
  { label: "Результат", value: "Стабильный поток заявок с сайта" },
] as const;

export function CaseNaviCert() {
  return (
    <section className={styles.section} id="case" aria-labelledby="case-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Кейс</p>
        <h2 id="case-title">Пример продукта</h2>

        <article className={styles.layout}>
          <a
            className={styles.shotLink}
            href={IP.caseUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Открыть ${IP.caseName}`}
          >
            <Image
              className={styles.shot}
              src="/cases/navicert/screenshot.webp"
              alt={`Скриншот главной ${IP.caseName}`}
              width={1024}
              height={665}
              sizes="(max-width: 900px) 100vw, 50vw"
              priority={false}
            />
          </a>

          <div className={styles.body}>
            <div className={styles.logoRow}>
              <Image
                className={styles.logoShield}
                src="/cases/navicert/logo-shield.webp"
                alt=""
                width={40}
                height={40}
              />
              <div>
                <h3 className={styles.name}>Navicert — центр сертификации</h3>
                <p className={styles.url}>{IP.caseName}</p>
              </div>
            </div>

            <p className={styles.text}>
              Сайт центра сертификации по России и ЕАЭС: структура услуг, понятная
              подача и канал заявок с сайта — без «макета ради макета».
            </p>

            <dl className={styles.meta}>
              {META.map((row) => (
                <div key={row.label} className={styles.metaRow}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>

            <a
              className={`btn ${styles.cta}`}
              href={IP.caseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Посмотреть сайт
            </a>
          </div>
        </article>
      </div>
    </section>
  );
}
