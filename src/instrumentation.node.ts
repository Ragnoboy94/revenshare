/** Node-only side of instrumentation — never imported from Edge. */
export async function registerNode(): Promise<void> {
  const { ensureOutreachScheduler } = await import(
    "@/lib/outreach-scheduler"
  );
  await ensureOutreachScheduler();
}
