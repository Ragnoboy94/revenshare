"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { BrandReveal } from "@/components/BrandReveal";
import { IP } from "@/lib/ip";
import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "#how", label: "Как работает" },
  { href: "#terms", label: "Условия" },
  { href: "#fit", label: "Кому подходит" },
  { href: "#case", label: "Кейсы" },
  { href: "#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 861px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function close() {
    setOpen(false);
  }

  return (
    <header className={styles.header} data-open={open ? "true" : undefined}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brandLink} aria-label={`${IP.brand} — на главную`}>
          <BrandReveal className={styles.brandAnim} />
        </Link>

        <nav className={styles.nav} aria-label="Разделы">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.actions}>
          <a href="#lead" className={`btn ${styles.cta}`}>
            Обсудить проект
          </a>
          <button
            type="button"
            className={styles.menuBtn}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={styles.menuIcon} data-open={open ? "true" : undefined} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        id={menuId}
        className={styles.drawer}
        data-open={open ? "true" : undefined}
        aria-hidden={!open}
      >
        <nav className={styles.drawerNav} aria-label="Мобильные разделы">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={close}>
              {item.label}
            </a>
          ))}
          <a href="#lead" className={`btn ${styles.drawerCta}`} onClick={close}>
            Обсудить проект
          </a>
        </nav>
      </div>
    </header>
  );
}
