import type { MetadataRoute } from "next";
import { IP } from "@/lib/ip";
import { SEO } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: IP.brand,
    short_name: IP.brand,
    description: SEO.description,
    start_url: "/",
    display: "standalone",
    background_color: "#eef2f4",
    theme_color: "#0d7377",
    lang: "ru",
  };
}
