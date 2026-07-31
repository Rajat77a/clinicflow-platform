import assert from "node:assert/strict";

const supabaseUrl = requiredUrl("SUPABASE_URL");
const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
const maxQueueDepth = nonNegativeInteger("OPS_MAX_QUEUE_DEPTH", 100);
const maxOldestAgeSeconds = nonNegativeInteger("OPS_MAX_OLDEST_AGE_SECONDS", 900);
const timeoutMs = positiveInteger("OPS_TIMEOUT_MS", 10_000);

function requiredUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1") {
    throw new Error(`${name} must use HTTPS`);
  }
  return parsed.href.replace(/\/$/, "");
}

function requiredSecret(name) {
  const value = process.env[name];
  if (!value || value.length < 20) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

function nonNegativeInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be non-negative`);
  return value;
}

async function request(pathname, init = {}) {
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Operational dependency check failed with HTTP ${response.status}`);
  }
  return response;
}

const startedAt = performance.now();
const [authResponse, queueResponse] = await Promise.all([
  request("/auth/v1/health", { method: "GET" }),
  request("/rest/v1/rpc/queue_operational_metrics", {
    method: "POST",
    body: "{}",
  }),
]);

const authHealth = await authResponse.json();
assert.equal(authHealth.name, "GoTrue", "Supabase Auth did not report the expected service");

const queueMetrics = await queueResponse.json();
assert.ok(Array.isArray(queueMetrics), "Queue metrics response must be an array");
const expectedQueues = new Set([
  "document_scanning",
  "notification_delivery",
  "security_alerts",
]);

for (const metric of queueMetrics) {
  expectedQueues.delete(metric.queue_name);
  assert.ok(
    Number(metric.queue_length) <= maxQueueDepth,
    `${metric.queue_name} depth exceeded the operational threshold`,
  );
  assert.ok(
    Number(metric.oldest_message_age_seconds ?? 0) <= maxOldestAgeSeconds,
    `${metric.queue_name} contains a stale message`,
  );
}
assert.deepEqual([...expectedQueues], [], "One or more required queues did not report metrics");

console.log(
  JSON.stringify(
    {
      status: "healthy",
      checkedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startedAt),
      auth: "healthy",
      queues: queueMetrics.map((metric) => ({
        queue: metric.queue_name,
        depth: Number(metric.queue_length),
        oldestAgeSeconds: Number(metric.oldest_message_age_seconds ?? 0),
      })),
    },
    null,
    2,
  ),
);
