import { NextRequest, NextResponse } from "next/server";

function hostname(hostHeader: string | null): string {
  return (hostHeader ?? "").split(":")[0].toLowerCase();
}

function isDemoHost(host: string): boolean {
  const configured = process.env.NEXT_PUBLIC_DEMO_HOST?.toLowerCase();
  if (configured && host === configured) return true;
  if (host === "demo.localhost") return true;
  return host.startsWith("demo.");
}

function siteOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* fall through */
    }
  }
  const port = req.nextUrl.port;
  const portPart =
    port && port !== "80" && port !== "443" ? `:${port}` : "";
  return `${req.nextUrl.protocol}//localhost${portPart}`;
}

function demoOrigin(req: NextRequest): string {
  const demoHost = process.env.NEXT_PUBLIC_DEMO_HOST ?? "demo.localhost";
  const port = req.nextUrl.port;
  const portPart =
    port && port !== "80" && port !== "443" ? `:${port}` : "";
  return `${req.nextUrl.protocol}//${demoHost}${portPart}`;
}

function looksLikeFile(pathname: string): boolean {
  const last = pathname.split("/").pop() ?? "";
  return last.includes(".");
}

/** Redirect demo host → apex. HTML on localhost (Next collapses Location). */
function redirectToApex(req: NextRequest): NextResponse {
  const target = `${siteOrigin(req)}/`;
  let siteHost = "localhost";
  try {
    siteHost = new URL(target).hostname;
  } catch {
    /* keep */
  }
  if (siteHost === "localhost" || siteHost === "127.0.0.1") {
    const html =
      `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>` +
      `<meta http-equiv="refresh" content="0;url=${target}"/>` +
      `<script>location.replace(${JSON.stringify(target)})</script>` +
      `<title>Redirect</title></head><body>` +
      `<p><a href="${target}">RevenShare</a></p></body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  return NextResponse.redirect(target, 307);
}

export function middleware(req: NextRequest) {
  const host = hostname(req.headers.get("host"));
  const { pathname } = req.nextUrl;

  if (isDemoHost(host)) {
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/demo-proxy") ||
      pathname.startsWith("/favicon") ||
      pathname === "/robots.txt" ||
      pathname.startsWith("/icon") ||
      pathname.startsWith("/apple-icon")
    ) {
      return NextResponse.next();
    }

    if (pathname === "/" || pathname === "") {
      return redirectToApex(req);
    }

    // /mebel39 or /mebel39/... → internal proxy route
    const segments = pathname.split("/").filter(Boolean);
    const slug = segments[0];
    if (!slug || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(slug)) {
      return redirectToApex(req);
    }

    const rest = segments.slice(1);
    // Ensure directory URLs end with / for relative assets
    if (rest.length === 0 && !pathname.endsWith("/") && !looksLikeFile(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = `/${slug}/`;
      return NextResponse.redirect(url);
    }

    const url = req.nextUrl.clone();
    url.pathname =
      rest.length > 0
        ? `/demo-proxy/${slug}/${rest.join("/")}`
        : `/demo-proxy/${slug}`;
    return NextResponse.rewrite(url);
  }

  // Apex: old /demos/... → demo subdomain
  if (pathname === "/demos" || pathname.startsWith("/demos/")) {
    let rest = pathname.replace(/^\/demos/, "") || "/";
    if (rest.endsWith("/index.html")) {
      rest = rest.slice(0, -"/index.html".length) || "/";
    }
    if (rest === "/" || rest === "") {
      return NextResponse.redirect(new URL("/", siteOrigin(req)));
    }
    if (!rest.endsWith("/") && !looksLikeFile(rest)) {
      rest = `${rest}/`;
    }
    return NextResponse.redirect(
      new URL(`${rest}${req.nextUrl.search}`, demoOrigin(req)),
    );
  }

  if (pathname === "/show" || pathname.startsWith("/show/")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
