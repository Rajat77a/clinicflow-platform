import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { detectMime, parseClamdResponse } from "../../workers/document-scanner/index.mjs";

const workerSource = await readFile(
  new URL("../../workers/document-scanner/index.mjs", import.meta.url),
  "utf8",
);
const migrationSource = await readFile(
  new URL(
    "../../supabase/migrations/20260801113000_document_scan_failure.sql",
    import.meta.url,
  ),
  "utf8",
);

test("document scanner verifies allowlisted file signatures", () => {
  assert.equal(detectMime(Buffer.from("%PDF-1.7")), "application/pdf");
  assert.equal(detectMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(
    detectMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
  assert.equal(detectMime(Buffer.from("plain text")), null);
});

test("document scanner accepts only explicit ClamAV outcomes", () => {
  assert.deepEqual(parseClamdResponse("stream: OK\0"), { clean: true, detailCode: "clean" });
  assert.deepEqual(parseClamdResponse("stream: Eicar-Test-Signature FOUND\0"), {
    clean: false,
    detailCode: "malware_detected",
  });
  assert.throws(() => parseClamdResponse("stream: UNKNOWN\0"));
});

test("scanner releases only clean bytes and uses bounded retries", () => {
  assert.match(workerSource, /if \(scan\.clean\) await uploadClean/);
  assert.match(workerSource, /SCANNER_MAX_ATTEMPTS/);
  assert.match(workerSource, /record_document_scan_failure/);
  assert.match(workerSource, /hospital-document-quarantine/);
  assert.match(workerSource, /hospital-documents/);
  assert.doesNotMatch(workerSource, /original_filename/);
});

test("terminal scan failure is service-role-only and audited", () => {
  assert.match(migrationSource, /coalesce\(auth\.jwt\(\) ->> 'role', ''\) <> 'service_role'/);
  assert.match(migrationSource, /document\.scan_failed/);
  assert.match(migrationSource, /revoke all[\s\S]*authenticated/);
  assert.match(migrationSource, /grant execute[\s\S]*service_role/);
});
