import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const allowedRoles = new Set(["clinic_admin", "doctor", "receptionist", "super_admin"]);
const allowedOrigin = Deno.env.get("CLINICFLOW_ALLOWED_ORIGIN") ?? "";
const allowedHeaders = [
  "authorization",
  "apikey",
  "content-type",
  "idempotency-key",
  "x-client-info",
  "x-request-id",
].join(", ");

function errorCode(status: number) {
  if (status === 400 || status === 422) return "invalid_request";
  if (status === 401 || status === 403) return "access_denied";
  if (status === 409) return "conflict";
  if (status === 429 || status === 503) return "service_unavailable";
  return "unknown";
}

function createResponse(
  status: number,
  body: Record<string, unknown> | null,
  requestId: string,
) {
  if (status >= 400) {
    console.warn(JSON.stringify({
      event: "invite_staff_rejected",
      status,
      request_id: requestId,
      reason: typeof body?.error === "string" ? body.error : "unknown",
    }));
  }
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
    const structuredBody = status >= 400 && body
      ? { ...body, code: errorCode(status), requestId }
      : body;
    return createResponse(status, structuredBody, requestId);
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
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const roleCode = typeof payload.roleCode === "string" ? payload.roleCode : "";
    const targetHospitalId = typeof payload.targetHospitalId === "string" ? payload.targetHospitalId : null;
    const specialty = typeof payload.specialty === "string" ? payload.specialty.trim() : null;
    const shift = typeof payload.shift === "string" ? payload.shift.trim() : null;
    const gender = typeof payload.gender === "string" ? payload.gender : null;
    const qualification = typeof payload.qualification === "string" ? payload.qualification.trim() : null;
    const medicalRegistrationNumber = typeof payload.medicalRegistrationNumber === "string"
      ? payload.medicalRegistrationNumber.trim()
      : null;
    const experienceYears = Number.isInteger(payload.experienceYears) ? payload.experienceYears : null;
    const consultationFee = typeof payload.consultationFee === "number" ? payload.consultationFee : null;
    const workingHours = typeof payload.workingHours === "string" ? payload.workingHours.trim() : null;
    const administrativeNotes = typeof payload.notes === "string" ? payload.notes.trim() : null;
    let facilityId = typeof payload.facilityId === "string" ? payload.facilityId : null;
    const departmentId = typeof payload.departmentId === "string" ? payload.departmentId : null;

    if (!email || !fullName || !allowedRoles.has(roleCode)) {
      return response(422, { error: "A valid name, email, and supported role are required" });
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

    const isCrossHospital = Boolean(targetHospitalId && targetHospitalId !== actor.hospital_id);
    if (isCrossHospital) {
      const { data: isPlatformAdmin, error: platformAdminError } = await userClient.rpc("is_platform_admin");
      if (platformAdminError || !isPlatformAdmin || actor.role_code !== "super_admin" || roleCode !== "clinic_admin") {
        return response(403, { error: "Platform administrator permission is required" });
      }
    }
    const effectiveHospitalId = targetHospitalId ?? actor.hospital_id;

    const { data: permission } = await userClient
      .from("role_permissions")
      .select("permission_code")
      .eq("role_code", actor.role_code)
      .eq("permission_code", "people.manage")
      .maybeSingle();
    if (!permission) {
      return response(403, { error: "You cannot assign this role" });
    }
    const { error: roleAssignmentError } = await adminClient.rpc("assert_staff_role_assignment", {
      p_actor_role: actor.role_code,
      p_target_role: roleCode,
    });
    if (roleAssignmentError) {
      return response(403, { error: "You cannot assign this role" });
    }

    const { data: replay } = await adminClient
      .from("idempotency_keys")
      .select("response_code, response_body")
      .eq("hospital_id", effectiveHospitalId)
      .eq("actor_user_id", userData.user.id)
      .eq("key", idempotencyKey)
      .maybeSingle();
    if (replay?.response_code) {
      return response(replay.response_code, replay.response_body as Record<string, unknown>);
    }

    if (facilityId) {
      const facilityClient = isCrossHospital ? adminClient : userClient;
      const { data: facility, error: facilityError } = await facilityClient
        .from("facilities")
        .select("id")
        .eq("id", facilityId)
        .eq("hospital_id", effectiveHospitalId)
        .eq("active", true)
        .maybeSingle();
      if (facilityError || !facility) return response(422, { error: "Invalid facility" });
    } else {
      const { data: facility, error: facilityError } = await adminClient
        .from("facilities")
        .select("id")
        .eq("hospital_id", effectiveHospitalId)
        .eq("active", true)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      facilityId = facility?.id ?? null;
      if (!facilityId) {
        const { data: hospital } = await adminClient
          .from("hospitals")
          .select("name")
          .eq("id", effectiveHospitalId)
          .maybeSingle();
        const { data: created, error: createError } = await adminClient
          .from("facilities")
          .insert({
            hospital_id: effectiveHospitalId,
            code: "MAIN",
            name: hospital?.name ? `${hospital.name} Main Facility` : "Main Facility",
            active: true,
          })
          .select("id")
          .single();
        if (createError || !created) {
          return response(422, { error: "Create an active facility before inviting staff" });
        }
        facilityId = created.id;
      }
    }
    if (departmentId) {
      const departmentClient = isCrossHospital ? adminClient : userClient;
      const { data: department, error: departmentError } = await departmentClient
        .from("departments")
        .select("id, facility_id")
        .eq("id", departmentId)
        .eq("hospital_id", effectiveHospitalId)
        .eq("active", true)
        .maybeSingle();
      if (departmentError || !department || department.facility_id !== facilityId) {
        return response(422, { error: "Invalid department for the selected facility" });
      }
    }

    // Generate an unlimited-validity invite token
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    // Look up hospital details for the email
    const { data: hospital } = await adminClient
      .from("hospitals")
      .select("name, email, phone, address")
      .eq("id", effectiveHospitalId)
      .maybeSingle();

    const { error: insertError } = await adminClient.from("invite_tokens").insert({
      email,
      full_name: fullName,
      phone,
      role_code: roleCode,
      hospital_id: effectiveHospitalId,
      facility_id: facilityId,
      department_id: departmentId,
      token,
      clinic_name: hospital?.name ?? null,
      clinic_email: hospital?.email ?? null,
      clinic_phone: hospital?.phone ?? null,
      clinic_address: typeof hospital?.address === "object" ? JSON.stringify(hospital.address) : (hospital?.address ?? null),
      specialty,
      shift,
      gender,
      qualification,
      medical_registration_number: medicalRegistrationNumber,
      experience_years: experienceYears,
      consultation_fee: consultationFee,
      working_hours: workingHours,
      administrative_notes: administrativeNotes,
    });
    if (insertError) {
      console.error(JSON.stringify({ event: "invite_token_insert_failed", error: insertError.message }));
      return response(500, { error: "Failed to generate invite token" });
    }

    const setupUrl = `${allowedOrigin}/setup?token=${token}`;

    const result = { userId: token, status: "invited", setupUrl };
    await adminClient.from("idempotency_keys").insert({
      hospital_id: effectiveHospitalId,
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
