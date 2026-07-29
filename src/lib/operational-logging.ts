type LogLevel = "error" | "info" | "warn";

export interface OperationalLog {
  event: string;
  level: LogLevel;
  requestId: string;
  method?: string;
  pathname?: string;
  status?: number;
  durationMs?: number;
}

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestIdFor(request: Request) {
  const candidate = request.headers.get("x-request-id")?.trim() ?? "";
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : globalThis.crypto.randomUUID();
}

export function traceparentFor(request: Request) {
  const value = request.headers.get("traceparent")?.trim() ?? "";
  return /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/i.test(value) ? value : null;
}

export function writeOperationalLog(entry: OperationalLog) {
  const serialized = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "clinicflow",
    ...entry,
  });
  if (entry.level === "error") console.error(serialized);
  else if (entry.level === "warn") console.warn(serialized);
  else console.info(serialized);
}
