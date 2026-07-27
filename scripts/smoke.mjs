import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL?.replace(/\/+$/, "");
if (!baseUrl) {
  throw new Error("Set BASE_URL to the deployment URL");
}

const timeoutMs = 10_000;
const functionUrl = process.env.SUPABASE_FUNCTION_URL;

async function get(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });

  assert.equal(response.status, 200, `${pathname} returned ${response.status}`);
  return response;
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
requireSecurityHeaders(health, "/healthz");
const healthBody = await health.json();
assert.equal(healthBody.status, "ok");
assert.equal(healthBody.service, "clinicflow");

const login = await get("/login");
requireSecurityHeaders(login, "/login");
assert.match(login.headers.get("cache-control") ?? "", /no-store/);
assert.match(login.headers.get("x-robots-tag") ?? "", /noindex/);

if (functionUrl) {
  const preflight = await fetch(functionUrl, {
    method: "OPTIONS",
    headers: {
      Origin: baseUrl,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers":
        "authorization, apikey, content-type, idempotency-key, x-client-info",
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
  ]) {
    assert.match(allowedHeaders, new RegExp(`(?:^|,\\s*)${header}(?:,|$)`, "i"));
  }
}

console.log(`ClinicFlow smoke check passed for ${baseUrl}`);
