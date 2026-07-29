import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL?.replace(/\/+$/, "");
if (!baseUrl) {
  throw new Error("Set BASE_URL to the deployment URL");
}

const timeoutMs = 10_000;
const functionUrl = process.env.SUPABASE_FUNCTION_URL;
const authHealthUrl = process.env.SUPABASE_AUTH_HEALTH_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const maxLatencyMs = Number(process.env.SMOKE_MAX_LATENCY_MS ?? 3_000);

async function get(pathname) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });

  assert.equal(response.status, 200, `${pathname} returned ${response.status}`);
  const latencyMs = Math.round(performance.now() - startedAt);
  assert.ok(
    latencyMs <= maxLatencyMs,
    `${pathname} took ${latencyMs}ms (budget ${maxLatencyMs}ms)`,
  );
  return { response, latencyMs };
}

function requireSecurityHeaders(response, pathname) {
  const required = [
    "content-security-policy",
    "referrer-policy",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
    "x-request-id",
  ];

  for (const name of required) {
    assert.ok(response.headers.get(name), `${pathname} is missing ${name}`);
  }
}

const health = await get("/healthz");
requireSecurityHeaders(health.response, "/healthz");
const healthBody = await health.response.json();
assert.equal(healthBody.status, "ok");
assert.equal(healthBody.service, "clinicflow");

const readiness = await get("/readyz");
requireSecurityHeaders(readiness.response, "/readyz");
const readinessBody = await readiness.response.json();
assert.equal(readinessBody.status, "ready");
assert.equal(readinessBody.service, "clinicflow");
assert.deepEqual(Object.keys(readinessBody).sort(), ["service", "status"]);

const login = await get("/login");
requireSecurityHeaders(login.response, "/login");
assert.match(login.response.headers.get("cache-control") ?? "", /no-store/);
assert.match(login.response.headers.get("x-robots-tag") ?? "", /noindex/);

if (authHealthUrl) {
  const startedAt = performance.now();
  const authHealth = await fetch(authHealthUrl, {
    headers: supabaseAnonKey ? { apikey: supabaseAnonKey } : {},
    signal: AbortSignal.timeout(timeoutMs),
  });
  const authLatencyMs = Math.round(performance.now() - startedAt);
  const expectedStatuses = supabaseAnonKey ? [200] : [200, 401];
  assert.ok(
    expectedStatuses.includes(authHealth.status),
    `Supabase Auth health returned ${authHealth.status}`,
  );
  assert.ok(
    authLatencyMs <= maxLatencyMs,
    `Supabase Auth health took ${authLatencyMs}ms (budget ${maxLatencyMs}ms)`,
  );
  console.log(`Supabase Auth gateway: ${authLatencyMs}ms (status ${authHealth.status})`);
}

if (functionUrl) {
  const preflight = await fetch(functionUrl, {
    method: "OPTIONS",
    headers: {
      Origin: baseUrl,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers":
        "authorization, apikey, content-type, idempotency-key, x-client-info, x-request-id",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  assert.equal(preflight.status, 204, `invite-staff preflight returned ${preflight.status}`);
  assert.equal(preflight.headers.get("access-control-allow-origin"), baseUrl);
  const allowedHeaders = preflight.headers.get("access-control-allow-headers") ?? "";
  for (const header of [
    "authorization",
    "apikey",
    "content-type",
    "idempotency-key",
    "x-client-info",
    "x-request-id",
  ]) {
    assert.match(allowedHeaders, new RegExp(`(?:^|,\\s*)${header}(?:,|$)`, "i"));
  }
}

console.log(
  `ClinicFlow smoke check passed for ${baseUrl} ` +
    `(health ${health.latencyMs}ms, readiness ${readiness.latencyMs}ms, ` +
    `login ${login.latencyMs}ms)`,
);
