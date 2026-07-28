const DEFAULT_IDLE_MINUTES = 30;
const MIN_IDLE_MINUTES = 5;
const MAX_IDLE_MINUTES = 720;

export function sessionIdleTimeoutMs(configuredMinutes?: string) {
  const parsed = Number(configuredMinutes);
  const minutes = Number.isFinite(parsed) && parsed > 0
    ? Math.min(MAX_IDLE_MINUTES, Math.max(MIN_IDLE_MINUTES, parsed))
    : DEFAULT_IDLE_MINUTES;
  return minutes * 60_000;
}
