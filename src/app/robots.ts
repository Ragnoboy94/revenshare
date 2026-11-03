import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/demos/", "/a/", "/api/", "/demo-proxy/"],
      },
    ],
    host: base,
    sitemap: `${base}/sitemap.xml`,
  };
}
