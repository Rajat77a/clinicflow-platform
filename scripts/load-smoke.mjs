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
const durationSeconds = nonNegativeInteger("LOAD_DURATION_SECONDS", 0);
const paths = (process.env.LOAD_PATHS ?? "/healthz,/readyz,/login")
  .split(",")
  .map((path) => path.trim())
  .filter((path) => /^\/[a-z0-9/_-]*$/i.test(path));
if (paths.length === 0) throw new Error("LOAD_PATHS must contain at least one safe path");
const latencies = [];
const failures = [];
let nextRequest = 0;
const deadline = durationSeconds > 0 ? Date.now() + durationSeconds * 1_000 : null;

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

function nonNegativeInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

async function worker() {
  while (true) {
    const requestNumber = nextRequest++;
    if (deadline ? Date.now() >= deadline : requestNumber >= requestCount) return;

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
assert.ok(latencies.length > 0, "The load probe did not complete any requests");
const percentile = (value) =>
  latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * value) - 1)];
const errorRate = failures.length / latencies.length;
const summary = {
  baseUrl,
  configuredRequests: durationSeconds > 0 ? null : requestCount,
  concurrency,
  durationSeconds,
  completedRequests: latencies.length,
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
