import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const allowedRoles = new Set(["clinic_admin", "doctor", "receptionist"]);
const allowedOrigin = Deno.env.get("CLINICFLOW_ALLOWED_ORIGIN") ?? "";
const allowedHeaders = [
  "authorization",
  "apikey",
  "content-type",
  "idempotency-key",
  "x-client-info",
].join(", ");

function response(status: number, body: Record<string, unknown> | null) {
  if (status >= 400) {
    console.warn(JSON.stringify({
      event: "invite_staff_rejected",
      status,
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
      Vary: "Origin",
    },
  });
}

Deno.serve(async (request) => {
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

    if (actor.role_code === "clinic_admin") {
      const { data: assurance, error: assuranceError } =
        await userClient.auth.mfa.getAuthenticatorAssuranceLevel(
          authorization.slice("Bearer ".length),
        );
      if (assuranceError || assurance.currentLevel !== "aal2") {
        return response(403, { error: "Two-step verification is required" });
      }
    }

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
      .eq("hospital_id", actor.hospital_id)
      .eq("actor_user_id", userData.user.id)
      .eq("key", idempotencyKey)
      .maybeSingle();
    if (replay?.response_code) {
      return response(replay.response_code, replay.response_body as Record<string, unknown>);
    }

    if (facilityId) {
      const { data: facility, error: facilityError } = await userClient
        .from("facilities")
        .select("id")
        .eq("id", facilityId)
        .eq("hospital_id", actor.hospital_id)
        .eq("active", true)
        .maybeSingle();
      if (facilityError || !facility) return response(422, { error: "Invalid facility" });
    } else {
      const { data: facility, error: facilityError } = await userClient
        .from("facilities")
        .select("id")
        .eq("hospital_id", actor.hospital_id)
        .eq("active", true)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      facilityId = facility?.id ?? null;
      if (facilityError || !facilityId) {
        return response(422, { error: "Create an active facility before inviting staff" });
      }
    }
    if (departmentId) {
      const { data: department, error: departmentError } = await userClient
        .from("departments")
        .select("id, facility_id")
        .eq("id", departmentId)
        .eq("hospital_id", actor.hospital_id)
        .eq("active", true)
        .maybeSingle();
      if (departmentError || !department || department.facility_id !== facilityId) {
        return response(422, { error: "Invalid department for the selected facility" });
      }
    }

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { data: { full_name: fullName, phone }, redirectTo },
    );
    if (inviteError || !invited.user) {
      const providerMessage = inviteError?.message.toLowerCase() ?? "";
      if (inviteError?.status === 429) {
        return response(429, {
          error: "Email invitation limit reached. Try again later or configure hospital SMTP.",
        });
      }
      if (providerMessage.includes("not authorized")) {
        return response(503, {
          error: "Staff email delivery is not configured. Connect custom SMTP in Supabase Auth.",
        });
      }
      if (
        providerMessage.includes("already") ||
        providerMessage.includes("registered") ||
        providerMessage.includes("exists")
      ) {
        return response(409, { error: "An account or invitation already exists for this email" });
      }
      return response(503, {
        error: "The email provider rejected the invitation. Check Supabase Auth email settings.",
      });
    }

    const { error: provisionError } = await userClient.rpc("provision_invited_staff", {
      p_user_id: invited.user.id,
      p_email: email,
      p_full_name: fullName,
      p_phone: phone,
      p_role_code: roleCode,
      p_facility_id: facilityId,
      p_department_id: departmentId,
      p_specialty: specialty,
      p_shift: shift,
      p_gender: gender,
      p_qualification: qualification,
      p_medical_registration_number: medicalRegistrationNumber,
      p_experience_years: experienceYears,
      p_consultation_fee: consultationFee,
      p_working_hours: workingHours,
      p_administrative_notes: administrativeNotes,
    });
    if (provisionError) {
      await adminClient.auth.admin.deleteUser(invited.user.id);
      return response(409, { error: "The staff account could not be provisioned" });
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
