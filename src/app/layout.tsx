import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { JsonLd } from "@/components/JsonLd";
import { IP } from "@/lib/ip";
import { SEO } from "@/lib/seo";
import "./globals.css";

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(IP.siteUrl),
  title: {
    default: SEO.title,
    template: `%s · ${IP.brand}`,
  },
  description: SEO.description,
  keywords: [...SEO.keywords],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: SEO.title,
    description: SEO.ogDescription,
    url: "/",
    locale: "ru_RU",
    type: "website",
    siteName: IP.brand,
  },
  twitter: {
    card: "summary_large_image",
    title: SEO.title,
    description: SEO.ogDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${manrope.variable}`}>
      <body>
        <JsonLd />
        <a className="skip-link" href="#main">
          К содержанию
        </a>
        {children}
      </body>
    </html>
  );
}
