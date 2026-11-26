export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.OUTREACH_SCHEDULER === "0") return;

  const { ensureOutreachScheduler } = await import(
    "@/lib/outreach-scheduler"
  );
  await ensureOutreachScheduler();
}
