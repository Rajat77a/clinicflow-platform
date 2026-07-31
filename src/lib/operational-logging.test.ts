import assert from "node:assert/strict";
import test from "node:test";
import { requestIdFor, traceparentFor } from "./operational-logging.ts";

test("request correlation accepts only valid UUID request identifiers", () => {
  const trusted = "018f7f1a-7c2b-7d3e-8f4a-1234567890ab";
  assert.equal(
    requestIdFor(new Request("https://clinicflow.test", {
      headers: { "x-request-id": trusted },
    })),
    trusted,
  );
  assert.notEqual(
    requestIdFor(new Request("https://clinicflow.test", {
      headers: { "x-request-id": "patient-name-or-untrusted-text" },
    })),
    "patient-name-or-untrusted-text",
  );
});

test("trace correlation rejects malformed trace headers", () => {
  const valid = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
  assert.equal(
    traceparentFor(new Request("https://clinicflow.test", {
      headers: { traceparent: valid },
    })),
    valid,
  );
  assert.equal(
    traceparentFor(new Request("https://clinicflow.test", {
      headers: { traceparent: "patient-data" },
    })),
    null,
  );
});
