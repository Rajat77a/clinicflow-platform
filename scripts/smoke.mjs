import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL?.replace(/\/+$/, "");
if (!baseUrl) {
  throw new Error("Set BASE_URL to the deployment URL");
}

const timeoutMs = 10_000;

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

console.log(`ClinicFlow smoke check passed for ${baseUrl}`);
