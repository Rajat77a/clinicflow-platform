import assert from "node:assert/strict";
import test from "node:test";

import {
  applySecurityHeaders,
  healthResponse,
  readinessResponse,
} from "./security-headers.ts";

test("applies browser security headers to every response", async () => {
  const response = applySecurityHeaders(new Response("ok"), "/", "request-1");

  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-request-id"), "request-1");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(await response.text(), "ok");
});

test("prevents caching and indexing of authenticated screens", () => {
  const response = applySecurityHeaders(new Response("private"), "/app/patients", "request-2");

  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
});

test("health response contains no deployment secrets", async () => {
  const response = healthResponse("request-3");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "clinicflow");
  assert.deepEqual(Object.keys(body).sort(), ["service", "status", "timestamp"]);
});

test("readiness reports configuration without exposing dependency details", async () => {
  const ready = readinessResponse("request-4", true);
  const unavailable = readinessResponse("request-5", false);

  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { service: "clinicflow", status: "ready" });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), {
    service: "clinicflow",
    status: "not_ready",
  });
});
