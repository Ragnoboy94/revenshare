export async function register() {
  // Node-only: edge must not analyze/bundle Checko/Playwright/fs.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.OUTREACH_SCHEDULER === "0") return;

  // webpackIgnore: keep this out of the Edge instrumentation graph.
  const { registerNode } = await import(
    /* webpackIgnore: true */ "./instrumentation.node"
  );
  await registerNode();
}
