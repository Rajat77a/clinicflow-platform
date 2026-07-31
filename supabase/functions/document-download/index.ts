import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const allowedOrigin = Deno.env.get("CLINICFLOW_ALLOWED_ORIGIN") ?? "";
const allowedHeaders = [
  "authorization",
  "apikey",
  "content-type",
  "x-client-info",
  "x-request-id",
].join(", ");

function createResponse(status: number, body: Record<string, unknown> | null, requestId: string) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, private",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": allowedHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "X-Content-Type-Options": "nosniff",
      "X-Request-ID": requestId,
      Vary: "Origin",
    },
  });
}

Deno.serve(async (request) => {
  const requestedId = request.headers.get("x-request-id")?.trim() ?? "";
  const requestId = /^[0-9a-f-]{36}$/i.test(requestedId)
    ? requestedId
    : crypto.randomUUID();
  const response = (status: number, body: Record<string, unknown> | null) =>
    createResponse(status, status >= 400 && body
      ? { ...body, code: status === 401 || status === 403 || status === 404 ? "access_denied" : "unknown", requestId }
      : body, requestId);

  if (request.method === "OPTIONS") return response(204, null);
  if (request.method !== "POST") return response(405, { error: "Method not allowed" });
  if (!allowedOrigin || request.headers.get("origin") !== allowedOrigin) {
    return response(403, { error: "Origin not allowed" });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return response(401, { error: "Authentication required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response(503, { error: "Service configuration is incomplete" });
  }

  try {
    const payload = await request.json();
    const documentId = typeof payload.documentId === "string" ? payload.documentId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) {
      return response(400, { error: "Invalid document request" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: identity, error: identityError } = await userClient.auth.getUser();
    if (identityError || !identity.user) {
      return response(401, { error: "Authentication required" });
    }

    const { data: document, error: documentError } = await userClient
      .from("documents")
      .select("id,storage_bucket,storage_path,original_filename,scan_status")
      .eq("id", documentId)
      .eq("scan_status", "clean")
      .eq("storage_bucket", "hospital-documents")
      .maybeSingle();
    if (documentError || !document) {
      return response(404, { error: "Document is unavailable" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signed, error: signedError } = await adminClient.storage
      .from("hospital-documents")
      .createSignedUrl(document.storage_path, 60, { download: document.original_filename });
    if (signedError || !signed?.signedUrl) {
      return response(503, { error: "Document access is temporarily unavailable" });
    }

    return response(200, { url: signed.signedUrl, expiresIn: 60 });
  } catch {
    return response(400, { error: "Invalid document request" });
  }
});
