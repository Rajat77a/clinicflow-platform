import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const allowedOrigin = Deno.env.get("CLINICFLOW_ALLOWED_ORIGIN") ?? "";
const allowedHeaders = [
  "authorization",
  "apikey",
  "content-type",
  "idempotency-key",
  "x-client-info",
  "x-request-id",
].join(", ");

function createResponse(
  status: number,
  body: Record<string, unknown> | null,
  requestId: string,
) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": allowedHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  const response = (status: number, body: Record<string, unknown> | null) => {
    return createResponse(status, body, requestId);
  };

  if (request.method === "OPTIONS") {
    return response(204, null);
  }
  if (request.method !== "POST") {
    return response(405, { error: "Method not allowed" });
  }
  if (!allowedOrigin || request.headers.get("origin") !== allowedOrigin) {
    return response(403, { error: "Origin not allowed" });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return response(400, { error: "Missing authorization" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return response(503, { error: "Service configuration is incomplete" });
  }

  try {
    const payload = await request.json();
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const roleCode = typeof payload.roleCode === "string" ? payload.roleCode : "";
    const hospitalId = typeof payload.hospitalId === "string" ? payload.hospitalId : "";
    const facilityId = typeof payload.facilityId === "string" ? payload.facilityId : null;
    const clinicName = typeof payload.clinicName === "string" ? payload.clinicName.trim() : null;
    const clinicEmail = typeof payload.clinicEmail === "string" ? payload.clinicEmail.trim() : null;
    const clinicPhone = typeof payload.clinicPhone === "string" ? payload.clinicPhone.trim() : null;
    const clinicAddress = typeof payload.clinicAddress === "string" ? payload.clinicAddress.trim() : null;

    if (!email || !fullName || !roleCode || !hospitalId) {
      return response(422, { error: "Email, name, role, and hospital are required" });
    }

    const allowedRoles = new Set(["clinic_admin", "doctor", "receptionist", "super_admin"]);
    if (!allowedRoles.has(roleCode)) {
      return response(422, { error: "Unsupported role" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const { error: insertError } = await adminClient.from("invite_tokens").insert({
      email,
      full_name: fullName,
      phone,
      role_code: roleCode,
      hospital_id: hospitalId,
      facility_id: facilityId,
      token,
      clinic_name: clinicName,
      clinic_email: clinicEmail,
      clinic_phone: clinicPhone,
      clinic_address: clinicAddress,
    });
    if (insertError) {
      console.error(JSON.stringify({ event: "invite_token_insert_failed", error: insertError.message }));
      return response(500, { error: "Failed to generate invite token" });
    }

    const setupUrl = `${allowedOrigin}/setup?token=${token}`;

    return response(201, {
      token,
      setupUrl,
      email,
      message: "Invite token generated. Share the setup URL with the staff member.",
    });
  } catch {
    return response(500, { error: "Unable to process the invitation" });
  }
});
