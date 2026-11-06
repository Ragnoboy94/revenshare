/** Host only, no scheme. DEMO_HOST is read at runtime and wins over the build-time public value. */
export function demoHostName(): string {
  const runtime = process.env["DEMO_HOST"]?.trim();
  const published = process.env.NEXT_PUBLIC_DEMO_HOST?.trim();
  return runtime || published || "demo.localhost";
}
