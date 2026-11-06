import { IP } from "@/lib/ip";

/** Fixed legal strip injected into every proxied demo HTML page. */
export function demoDisclaimerHtml(): string {
  const brand = escapeHtml(IP.brand);
  const body =
    "Страница показана только для демонстрации вёрстки и функционала. " +
    "Не является официальным сайтом изображённого бренда и не означает использование чужой " +
    "интеллектуальной собственности, аффилиацию или одобрение. Товарные знаки и материалы " +
    "принадлежат их правообладателям.";

  return `<!-- revenshare-demo-disclaimer -->
<style id="rs-demo-disclaimer-style">
  #rs-demo-disclaimer{position:fixed;left:0;right:0;top:0;z-index:2147483646;
    box-sizing:border-box;padding:0.55rem 0.85rem;padding-top:max(0.55rem,env(safe-area-inset-top));
    background:rgba(14,26,36,0.94);color:#f3f6f8;font:600 12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;
    letter-spacing:0.01em;box-shadow:0 6px 24px rgba(0,0,0,0.18)}
  #rs-demo-disclaimer strong{color:#7fd4d6;font-weight:700}
  #rs-demo-disclaimer p{margin:0;max-width:72rem;padding-right:1.6rem}
  #rs-demo-disclaimer button{position:absolute;top:0.35rem;right:0.45rem;border:0;background:transparent;
    color:#c5d0d8;font:700 16px/1 system-ui,sans-serif;cursor:pointer;padding:0.2rem 0.35rem;border-radius:4px}
  #rs-demo-disclaimer button:hover{color:#fff;background:rgba(255,255,255,0.08)}
  body.rs-demo-disclaimer-on{padding-top:4.5rem !important}
  @media (max-width:640px){#rs-demo-disclaimer{font-size:11px}
    body.rs-demo-disclaimer-on{padding-top:5.75rem !important}}
</style>
<aside id="rs-demo-disclaimer" role="note" aria-label="Юридическое уведомление о демо-стенде">
  <p><strong>Демо-стенд ${brand}.</strong> ${escapeHtml(body)}</p>
  <button type="button" aria-label="Скрыть уведомление" onclick="(function(){var a=document.getElementById('rs-demo-disclaimer');if(a)a.remove();document.body&&document.body.classList.remove('rs-demo-disclaimer-on');})()">×</button>
</aside>
<script id="rs-demo-disclaimer-script">
(function(){try{document.body&&document.body.classList.add('rs-demo-disclaimer-on')}catch(e){}})();
</script>`;
}

export function injectDemoDisclaimer(html: string): string {
  if (html.includes("rs-demo-disclaimer") || html.includes("revenshare-demo-disclaimer")) {
    return html;
  }
  const snippet = demoDisclaimerHtml();
  const bodyClose = html.lastIndexOf("</body>");
  if (bodyClose !== -1) {
    return html.slice(0, bodyClose) + snippet + html.slice(bodyClose);
  }
  const htmlClose = html.lastIndexOf("</html>");
  if (htmlClose !== -1) {
    return html.slice(0, htmlClose) + snippet + html.slice(htmlClose);
  }
  return html + snippet;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
