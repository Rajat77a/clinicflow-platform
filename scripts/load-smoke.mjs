import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL?.replace(/\/+$/, "");
if (!baseUrl) {
  throw new Error("Set BASE_URL to the deployment URL");
}

const requestCount = positiveInteger("LOAD_REQUESTS", 120);
const concurrency = positiveInteger("LOAD_CONCURRENCY", 8);
const maxP95Ms = positiveInteger("LOAD_P95_MS", 2_000);
const maxErrorRate = numberInRange("LOAD_MAX_ERROR_RATE", 0.01, 0, 1);
const timeoutMs = positiveInteger("LOAD_TIMEOUT_MS", 10_000);
const paths = ["/healthz", "/login"];
const latencies = [];
const failures = [];
let nextRequest = 0;

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function numberInRange(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

async function worker() {
  while (true) {
    const requestNumber = nextRequest++;
    if (requestNumber >= requestCount) return;

    const pathname = paths[requestNumber % paths.length];
    const startedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}${pathname}`, {
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "ClinicFlow-Operational-Probe/1.0" },
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      latencies.push(latencyMs);
      if (response.status !== 200) {
        failures.push({ pathname, status: response.status });
      }
      await response.body?.cancel();
    } catch (error) {
      latencies.push(Math.round(performance.now() - startedAt));
      failures.push({
        pathname,
        error: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, () => worker()));

latencies.sort((a, b) => a - b);
const percentile = (value) =>
  latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * value) - 1)];
const errorRate = failures.length / requestCount;
const summary = {
  baseUrl,
  requests: requestCount,
  concurrency,
  failures: failures.length,
  failureDetails: failures.slice(0, 10),
  errorRate,
  latencyMs: {
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: latencies.at(-1),
  },
};

console.log(JSON.stringify(summary, null, 2));
assert.ok(
  errorRate <= maxErrorRate,
  `Error rate ${(errorRate * 100).toFixed(2)}% exceeded ${(maxErrorRate * 100).toFixed(2)}%`,
);
assert.ok(
  summary.latencyMs.p95 <= maxP95Ms,
  `p95 ${summary.latencyMs.p95}ms exceeded ${maxP95Ms}ms`,
);
