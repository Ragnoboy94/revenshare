import Link from "next/link";
import { IP } from "@/lib/ip";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandCol}>
          <p className={styles.brand}>{IP.brand}</p>
          <p className={styles.tag}>Сайты без предоплаты — платите с заявок с сайта</p>
        </div>

        <nav className={styles.nav} aria-label="Навигация в подвале">
          <a href="#how">Как работает</a>
          <a href="#terms">Условия</a>
          <a href="#fit">Кому подходит</a>
          <a href="#case">Кейсы</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className={styles.contacts}>
          <a href={`mailto:${IP.email}`}>{IP.email}</a>
          <a href="#lead">Оставить заявку</a>
        </div>
      </div>

      <div className={styles.legal}>
        <div className={styles.legalInner}>
          <p>
            © {new Date().getFullYear()} {IP.brand} · {IP.fullName} · ИНН {IP.inn} · ОГРНИП{" "}
            {IP.ogrnip}
          </p>
          <p className={styles.legalLinks}>
            <Link href="/privacy">Политика ПДн</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
