import { FAQ_ITEMS } from "@/lib/faq";
import { IP } from "@/lib/ip";
import { SEO, siteBaseUrl } from "@/lib/seo";

export function buildOrganizationJsonLd() {
  const base = siteBaseUrl();

  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${base}/#organization`,
    name: IP.brand,
    legalName: IP.fullName,
    description: SEO.description,
    url: base,
    email: IP.email,
    taxID: IP.inn,
    areaServed: { "@type": "Country", name: "Россия" },
    address: {
      "@type": "PostalAddress",
      addressLocality: IP.city.replace(/^г\.\s*/, ""),
      addressRegion: IP.region,
      addressCountry: "RU",
    },
    priceRange: "₽",
  };
}

export function buildWebsiteJsonLd() {
  const base = siteBaseUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: IP.brand,
    url: base,
    description: SEO.description,
    inLanguage: "ru-RU",
    publisher: { "@id": `${base}/#organization` },
  };
}

export function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}
