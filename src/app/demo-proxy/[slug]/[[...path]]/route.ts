import { injectDemoDisclaimer } from "@/lib/demo-disclaimer";
import { resolveDemoTarget } from "@/lib/demo-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = {
  params: Promise<{ slug: string; path?: string[] }>;
};

async function proxy(request: Request, context: Ctx) {
  const { slug, path: parts } = await context.params;
  const target = await resolveDemoTarget(slug);

  if ("error" in target) {
    return new Response(
      `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><meta name="robots" content="noindex"/><title>Демо</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#222}
code{background:#f2f2f2;padding:.1rem .35rem;border-radius:4px}</style></head>
<body><h1>Демо недоступно</h1><p>${escapeHtml(target.error)}</p></body></html>`,
      {
        status: target.status,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }

  const rest = parts?.length ? parts.map(encodeURIComponent).join("/") : "";
  const incoming = new URL(request.url);
  const upstream = `http://127.0.0.1:${target.port}/${rest}${incoming.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.set("host", `127.0.0.1:${target.port}`);

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  const upstreamRes = await fetch(upstream, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  });

  const outHeaders = new Headers(upstreamRes.headers);
  outHeaders.set("X-Robots-Tag", "noindex, nofollow");
  outHeaders.delete("transfer-encoding");
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");

  const contentType = (upstreamRes.headers.get("content-type") ?? "").toLowerCase();
  const isHtml =
    contentType.includes("text/html") || contentType.includes("application/xhtml");

  if (!isHtml || request.method === "HEAD") {
    return new Response(request.method === "HEAD" ? null : upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: outHeaders,
    });
  }

  const html = await upstreamRes.text();
  const patched = injectDemoDisclaimer(html);
  outHeaders.set("Content-Type", "text/html; charset=utf-8");
  outHeaders.set("Cache-Control", "no-store");

  return new Response(patched, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: outHeaders,
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
