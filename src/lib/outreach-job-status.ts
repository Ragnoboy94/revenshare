export type OutreachJobAction =
  | "scan"
  | "enrich"
  | "send"
  | "test_send"
  | "probe"
  | "tick";

export type OutreachJobStatus = {
  running: boolean;
  action?: OutreachJobAction;
  startedAt?: string;
  message?: string;
  finishedAt?: string;
  lastError?: string;
};

let current: OutreachJobStatus = { running: false };

export function getOutreachJobStatus(): OutreachJobStatus {
  return { ...current };
}

/** @returns false если уже идёт другая задача */
export function beginOutreachJob(
  action: OutreachJobAction,
  message: string,
): boolean {
  if (current.running) return false;
  current = {
    running: true,
    action,
    startedAt: new Date().toISOString(),
    message,
    finishedAt: undefined,
    lastError: undefined,
  };
  return true;
}

export function finishOutreachJob(error?: string): void {
  current = {
    ...current,
    running: false,
    finishedAt: new Date().toISOString(),
    message: error ? current.message : "Готово",
    lastError: error,
  };
}
