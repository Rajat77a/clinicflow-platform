import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../../supabase/functions/document-download/index.ts", import.meta.url),
  "utf8",
);
const config = await readFile(new URL("../../supabase/config.toml", import.meta.url), "utf8");

test("document downloads authorize through caller-scoped RLS before signing", () => {
  const callerQuery = source.indexOf('createClient(supabaseUrl, anonKey');
  const metadataRead = source.indexOf('.from("documents")');
  const adminClient = source.indexOf('createClient(supabaseUrl, serviceRoleKey');
  const signedUrl = source.indexOf("createSignedUrl");
  assert.ok(callerQuery > 0 && metadataRead > callerQuery);
  assert.ok(adminClient > metadataRead && signedUrl > adminClient);
  assert.match(source, /\.eq\("scan_status", "clean"\)/);
  assert.match(source, /\.eq\("storage_bucket", "hospital-documents"\)/);
});

test("document links are short-lived, private, and exact-origin only", () => {
  assert.match(source, /createSignedUrl\(document\.storage_path, 60/);
  assert.match(source, /"Cache-Control": "no-store, private"/);
  assert.match(source, /request\.headers\.get\("origin"\) !== allowedOrigin/);
  assert.match(source, /X-Content-Type-Options/);
  assert.match(config, /\[functions\.document-download\][\s\S]*verify_jwt = true/);
});

test("document download errors do not reveal storage or authorization details", () => {
  assert.match(source, /Document is unavailable/);
  assert.doesNotMatch(source, /console\.(log|warn|error)/);
  assert.doesNotMatch(source, /documentError\.message|signedError\.message/);
});
