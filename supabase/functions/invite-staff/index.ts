import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const allowedRoles = new Set(["clinic_admin", "doctor", "receptionist"]);
const allowedOrigin = Deno.env.get("CLINICFLOW_ALLOWED_ORIGIN") ?? "";

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, idempotency-key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return response(204, {});
  }
  if (request.method !== "POST") {
    return response(405, { error: "Method not allowed" });
  }
  if (!allowedOrigin || request.headers.get("origin") !== allowedOrigin) {
    return response(403, { error: "Origin not allowed" });
  }

  const authorization = request.headers.get("authorization");
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!authorization?.startsWith("Bearer ") || !idempotencyKey || idempotencyKey.length < 16) {
    return response(400, { error: "Missing authorization or idempotency key" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response(503, { error: "Service configuration is incomplete" });
  }

  try {
    const payload = await request.json();
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
    const roleCode = typeof payload.roleCode === "string" ? payload.roleCode : "";
    const facilityId = typeof payload.facilityId === "string" ? payload.facilityId : null;
    const departmentId = typeof payload.departmentId === "string" ? payload.departmentId : null;
    const redirectTo = typeof payload.redirectTo === "string" ? payload.redirectTo : allowedOrigin;

    if (!email || !fullName || !allowedRoles.has(roleCode)) {
      return response(422, { error: "A valid name, email, and supported role are required" });
    }
    if (!redirectTo.startsWith(`${allowedOrigin}/`)) {
      return response(422, { error: "Invalid invitation redirect" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(
      authorization.slice("Bearer ".length),
    );
    if (userError || !userData.user) {
      return response(401, { error: "Invalid session" });
    }

    const { data: actor, error: actorError } = await userClient
      .from("staff_memberships")
      .select("hospital_id, role_code")
      .eq("user_id", userData.user.id)
      .eq("active", true)
      .single();
    if (actorError || !actor) {
      return response(403, { error: "Active hospital membership required" });
    }

    const { data: permission } = await userClient
      .from("role_permissions")
      .select("permission_code")
      .eq("role_code", actor.role_code)
      .eq("permission_code", "people.manage")
      .maybeSingle();
    const canAssignRole = roleCode !== "clinic_admin" || actor.role_code === "super_admin";
    if (!permission || !canAssignRole) {
      return response(403, { error: "You cannot assign this role" });
    }

    const { data: replay } = await adminClient
      .from("idempotency_keys")
      .select("response_code, response_body")
      .eq("hospital_id", actor.hospital_id)
      .eq("actor_user_id", userData.user.id)
      .eq("key", idempotencyKey)
      .maybeSingle();
    if (replay?.response_code) {
      return response(replay.response_code, replay.response_body as Record<string, unknown>);
    }

    if (facilityId) {
      const { data: facility } = await adminClient
        .from("facilities")
        .select("id")
        .eq("id", facilityId)
        .eq("hospital_id", actor.hospital_id)
        .eq("active", true)
        .maybeSingle();
      if (!facility) return response(422, { error: "Invalid facility" });
    }
    if (departmentId) {
      const { data: department } = await adminClient
        .from("departments")
        .select("id")
        .eq("id", departmentId)
        .eq("hospital_id", actor.hospital_id)
        .eq("active", true)
        .maybeSingle();
      if (!department) return response(422, { error: "Invalid department" });
    }

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { data: { full_name: fullName }, redirectTo },
    );
    if (inviteError || !invited.user) {
      return response(409, { error: "The invitation could not be created" });
    }

    const { error: membershipError } = await adminClient.from("staff_memberships").insert({
      user_id: invited.user.id,
      hospital_id: actor.hospital_id,
      role_code: roleCode,
      facility_id: facilityId,
      department_id: departmentId,
    });
    if (membershipError) {
      await adminClient.auth.admin.deleteUser(invited.user.id);
      return response(409, { error: "The staff membership could not be created" });
    }

    const result = { userId: invited.user.id, status: "invited" };
    await adminClient.from("idempotency_keys").insert({
      hospital_id: actor.hospital_id,
      actor_user_id: userData.user.id,
      key: idempotencyKey,
      command: "invite-staff",
      response_code: 201,
      response_body: result,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return response(201, result);
  } catch {
    return response(500, { error: "Unable to process the invitation" });
  }
});
