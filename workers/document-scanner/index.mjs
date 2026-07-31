import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { connect } from "node:net";

const MAX_BYTES = 25 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function detectMime(bytes) {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  return null;
}

export function parseClamdResponse(value) {
  const response = value.replace(/\0/g, "").trim();
  if (/^stream: OK$/i.test(response)) return { clean: true, detailCode: "clean" };
  if (/^stream: .+ FOUND$/i.test(response)) {
    return { clean: false, detailCode: "malware_detected" };
  }
  throw new Error("Scanner returned an invalid response");
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function integer(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function encodeObjectPath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function runtimeConfig() {
  const supabaseUrl = new URL(required("SUPABASE_URL"));
  if (supabaseUrl.protocol !== "https:" && supabaseUrl.hostname !== "127.0.0.1") {
    throw new Error("SUPABASE_URL must use HTTPS");
  }
  return {
    supabaseUrl: supabaseUrl.href.replace(/\/$/, ""),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    clamdHost: process.env.CLAMD_HOST ?? "clamav",
    clamdPort: integer("CLAMD_PORT", 3310, 1, 65535),
    pollMs: integer("SCANNER_POLL_MS", 5_000, 500, 60_000),
    maxAttempts: integer("SCANNER_MAX_ATTEMPTS", 5, 1, 20),
    timeoutMs: integer("SCANNER_TIMEOUT_MS", 60_000, 1_000, 300_000),
  };
}

async function supabaseRequest(config, pathname, init = {}) {
  const response = await fetch(`${config.supabaseUrl}${pathname}`, {
    ...init,
    signal: AbortSignal.timeout(config.timeoutMs),
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`Supabase operation failed with HTTP ${response.status}`);
  return response;
}

async function rpc(config, name, body) {
  const response = await supabaseRequest(config, `/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function scanWithClamd(config, bytes) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: config.clamdHost, port: config.clamdPort });
    const chunks = [];
    const timeout = setTimeout(() => socket.destroy(new Error("Scanner timed out")), config.timeoutMs);
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
        const chunk = bytes.subarray(offset, Math.min(offset + 64 * 1024, bytes.length));
        const length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length);
        socket.write(length);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("error", reject);
    socket.on("end", () => {
      try {
        resolve(parseClamdResponse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    socket.on("close", () => clearTimeout(timeout));
  });
}

async function loadDocument(config, documentId) {
  const select = [
    "id",
    "hospital_id",
    "storage_bucket",
    "storage_path",
    "content_type",
    "byte_size",
    "scan_status",
  ].join(",");
  const response = await supabaseRequest(
    config,
    `/rest/v1/documents?id=eq.${encodeURIComponent(documentId)}&select=${select}&limit=1`,
  );
  const rows = await response.json();
  assert.equal(rows.length, 1, "Document metadata was not found");
  return rows[0];
}

async function downloadQuarantine(config, document) {
  assert.equal(document.storage_bucket, "hospital-document-quarantine");
  assert.ok(["pending", "failed"].includes(document.scan_status));
  const response = await supabaseRequest(
    config,
    `/storage/v1/object/authenticated/hospital-document-quarantine/${encodeObjectPath(document.storage_path)}`,
  );
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length > 0 && bytes.length <= MAX_BYTES, "Document size is outside the limit");
  assert.equal(bytes.length, Number(document.byte_size), "Document size does not match metadata");
  assert.equal(detectMime(bytes), document.content_type, "Document signature does not match its type");
  return bytes;
}

async function uploadClean(config, path, contentType, bytes) {
  await supabaseRequest(config, `/storage/v1/object/hospital-documents/${encodeObjectPath(path)}`, {
    method: "POST",
    headers: { "content-type": contentType, "x-upsert": "true" },
    body: bytes,
  });
}

async function removeQuarantine(config, path) {
  await supabaseRequest(config, "/storage/v1/object/hospital-document-quarantine", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prefixes: [path] }),
  });
}

async function archive(config, messageId) {
  await rpc(config, "archive_system_job", {
    p_queue_name: "document_scanning",
    p_message_id: messageId,
  });
}

async function terminalFailure(config, job, detailCode) {
  const documentId = job.message?.document_id;
  if (UUID.test(documentId ?? "")) {
    await rpc(config, "record_document_scan_failure", {
      p_document_id: documentId,
      p_detail_code: detailCode,
    });
  }
  await rpc(config, "enqueue_system_job", {
    p_queue_name: "security_alerts",
    p_message: { type: "document_scan_failed", document_id: documentId ?? null },
    p_delay_seconds: 0,
  });
  await archive(config, job.msg_id);
}

async function processJob(config, job) {
  const documentId = job.message?.document_id;
  const hospitalId = job.message?.hospital_id;
  assert.ok(UUID.test(documentId ?? ""), "Queue message has an invalid document ID");
  assert.ok(UUID.test(hospitalId ?? ""), "Queue message has an invalid hospital ID");
  const document = await loadDocument(config, documentId);
  assert.equal(document.hospital_id, hospitalId, "Queue hospital does not match document metadata");
  const bytes = await downloadQuarantine(config, document);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const scan = await scanWithClamd(config, bytes);
  const extension = MIME_EXTENSIONS[document.content_type];
  const releasedPath = scan.clean
    ? `${hospitalId}/${documentId}/${sha256}.${extension}`
    : null;

  if (scan.clean) await uploadClean(config, releasedPath, document.content_type, bytes);
  await rpc(config, "record_document_scan_result", {
    p_document_id: documentId,
    p_clean: scan.clean,
    p_sha256: sha256,
    p_scan_provider: "clamav",
    p_scan_detail_code: scan.detailCode,
    p_released_path: releasedPath,
  });
  await removeQuarantine(config, document.storage_path);
  await archive(config, job.msg_id);
}

async function run() {
  const config = runtimeConfig();
  let stopping = false;
  process.once("SIGTERM", () => { stopping = true; });
  process.once("SIGINT", () => { stopping = true; });

  while (!stopping) {
    const jobs = await rpc(config, "read_system_jobs", {
      p_queue_name: "document_scanning",
      p_visibility_timeout: Math.ceil(config.timeoutMs / 1_000) + 30,
      p_quantity: 5,
    });
    for (const job of jobs ?? []) {
      try {
        await processJob(config, job);
      } catch {
        if (Number(job.read_count) >= config.maxAttempts) {
          await terminalFailure(config, job, "retry_limit_reached");
        } else {
          console.error(JSON.stringify({ event: "document_scan_retry", attempt: job.read_count }));
        }
      }
    }
    if (!stopping && (jobs?.length ?? 0) === 0) {
      await new Promise((resolve) => setTimeout(resolve, config.pollMs));
    }
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  await run();
}
