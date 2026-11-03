import styles from "./Hero.module.css";

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 19 6.5v5.2c0 4.4-2.9 7.6-7 9.3-4.1-1.7-7-4.9-7-9.3V6.5L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.1 11.1 14l3.8-4.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCases() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="6.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 6.5V5.2A1.7 1.7 0 0 1 9.7 3.5h4.6A1.7 1.7 0 0 1 16 5.2v1.3"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M3.5 11.5h17" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconPercent() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="16" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M17.5 6.5 6.5 17.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4.5a5 5 0 0 1 5 5v2.2c0 .9.3 1.7.8 2.4l.7 1.1H5.5l.7-1.1c.5-.7.8-1.5.8-2.4V9.5a5 5 0 0 1 5-5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 18.2a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 10.5 12 4.5l7.5 6V19a1.5 1.5 0 0 1-1.5 1.5h-3.5V14h-5v6.5H6A1.5 1.5 0 0 1 4.5 19v-8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function IconLeads() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3.5V8h4.5M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.2 12.2 10.8 14.8 15.8 9.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 18.5V5.5M4 18.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.5 14.5 11 10l3 2.5 4.5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.8v1.8M12 18.4v1.8M4.9 6.6l1.3 1.3M17.8 16.1l1.3 1.3M3.8 12h1.8M18.4 12h1.8M4.9 17.4l1.3-1.3M17.8 7.9l1.3-1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const TRUST = [
  { label: "Без предоплаты", Icon: IconShield },
  { label: "Демо до договора", Icon: IconCases },
  { label: "10% с заявок / выкуп 29 000 ₽", Icon: IconPercent },
] as const;

const NAV = [
  { label: "Главная", Icon: IconHome, active: false },
  { label: "Заявки", Icon: IconLeads, active: true },
  { label: "Заказы", Icon: IconOrders, active: false },
  { label: "Аналитика", Icon: IconChart, active: false },
  { label: "Настройки", Icon: IconSettings, active: false },
] as const;

const KPIS = [
  { label: "Заявки", value: "124", delta: "+12%" },
  { label: "Заказы", value: "32", delta: "+18%" },
  { label: "Конверсия", value: "25.8%", delta: "+6%" },
] as const;

export function Hero() {
  return (
    <section className={styles.section} aria-labelledby="hero-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <h1 id="hero-title" className={styles.title}>
            Сайт без предоплаты. Платите с заявок, которые он принёс
          </h1>
          <p className={styles.sub}>
            Собираем сайт на демостенде, правим до договора, публикуем на хостинг
            на 3 месяца за наш счёт. Дальше — 10% со всех заявок клиентов с сайта,
            включая повторные. Нет заявок — выкуп за 29 000 ₽.
          </p>
          <div className={styles.actions}>
            <a href="#lead" className="btn btnLg">
              Обсудить проект
            </a>
            <a href="#how" className={`btn btnLg btnOutline ${styles.secondary}`}>
              Как устроена схема
            </a>
          </div>
          <ul className={styles.trust}>
            {TRUST.map(({ label, Icon }) => (
              <li key={label}>
                <span className={styles.trustIcon} aria-hidden="true">
                  <Icon />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.visual} aria-hidden="true">
          <div className={styles.chromeWrap}>
            <div className={styles.chrome}>
              <div className={styles.chromeBar}>
                <span className={styles.dot} data-c="g" />
                <span className={styles.dot} data-c="y" />
                <span className={styles.dot} data-c="r" />
              </div>

              <div className={styles.app}>
                <aside className={styles.side}>
                  {NAV.map((item) => (
                    <div
                      key={item.label}
                      className={styles.sideItem}
                      data-active={item.active ? "true" : undefined}
                    >
                      <span className={styles.sideIcon}>
                        <item.Icon />
                      </span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </aside>

                <div className={styles.main}>
                  <p className={styles.dashTitle}>Заявки и продажи</p>

                  <div className={styles.kpis}>
                    {KPIS.map((kpi) => (
                      <div key={kpi.label} className={styles.kpi}>
                        <p className={styles.kpiLabel}>{kpi.label}</p>
                        <p className={styles.kpiValue}>{kpi.value}</p>
                        <p className={styles.kpiDelta}>{kpi.delta}</p>
                      </div>
                    ))}
                  </div>

                  <div className={styles.chart}>
                    <div className={styles.chartHead}>
                      <p className={styles.chartTitle}>Динамика заявок</p>
                      <p className={styles.chartPeriod}>7 дней</p>
                    </div>
                    <div className={styles.chartBody}>
                      <svg className={styles.spark} viewBox="0 0 280 120" fill="none">
                        <defs>
                          <linearGradient id="heroChartFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        <g className={styles.grid} stroke="currentColor">
                          <line x1="8" y1="28" x2="272" y2="28" />
                          <line x1="8" y1="52" x2="272" y2="52" />
                          <line x1="8" y1="76" x2="272" y2="76" />
                          <line x1="8" y1="100" x2="272" y2="100" />
                        </g>
                        <path
                          d="M8 92 C 28 90, 42 78, 58 68 S 88 52, 104 58 S 132 78, 152 70 S 180 42, 204 38 S 236 48, 252 28 S 266 18, 272 16"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M8 92 C 28 90, 42 78, 58 68 S 88 52, 104 58 S 132 78, 152 70 S 180 42, 204 38 S 236 48, 252 28 S 266 18, 272 16 L 272 108 L 8 108 Z"
                          fill="url(#heroChartFill)"
                        />
                        <g className={styles.points} fill="#fff" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="58" cy="68" r="3" />
                          <circle cx="104" cy="58" r="3" />
                          <circle cx="152" cy="70" r="3" />
                          <circle cx="204" cy="38" r="3.2" />
                        </g>
                        <circle
                          className={styles.activePoint}
                          cx="252"
                          cy="28"
                          r="5"
                          fill="#fff"
                          stroke="currentColor"
                          strokeWidth="2.4"
                        />
                      </svg>
                      <div className={styles.tip}>
                        <strong>Новая заявка</strong>
                        <span>12:43 · 3 минуты назад</span>
                      </div>
                    </div>
                    <div className={styles.chartAxis}>
                      <span>Пн</span>
                      <span>Вт</span>
                      <span>Ср</span>
                      <span>Чт</span>
                      <span>Пт</span>
                      <span>Сб</span>
                      <span>Вс</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.toast}>
              <span className={styles.toastIcon}>
                <IconBell />
              </span>
              <div>
                <p className={styles.toastTitle}>Новая заявка с сайта</p>
                <p className={styles.toastBody}>
                  Клиент оставил заявку на услугу «Сертификация»
                </p>
                <p className={styles.toastTime}>12:43</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
