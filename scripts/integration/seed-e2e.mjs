import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required");
}

const clientOptions = {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
};
const admin = createClient(url, serviceRoleKey, clientOptions);
const password = "E2EOnly#2026ClinicFlow";

function assertNoError(error, context) {
  assert.equal(error, null, `${context}: ${error?.message ?? "unknown error"}`);
}

async function createIdentity(roleCode, hospitalId, facilityId) {
  const email = `${roleCode.replaceAll("_", ".")}@example.test`;
  const displayName = `E2E ${roleCode.replaceAll("_", " ")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  assertNoError(error, `create ${roleCode} identity`);
  assert.ok(data.user, `${roleCode} identity was not returned`);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", data.user.id);
  assertNoError(profileError, `update ${roleCode} profile`);

  const { error: membershipError } = await admin.from("staff_memberships").insert({
    user_id: data.user.id,
    hospital_id: hospitalId,
    facility_id: facilityId,
    role_code: roleCode,
    specialty: roleCode === "doctor" ? "General medicine" : null,
    active: true,
  });
  assertNoError(membershipError, `create ${roleCode} membership`);
  return { id: data.user.id, email };
}

async function main() {
  const { data: hospital, error: hospitalError } = await admin
    .from("hospitals")
    .select("id")
    .eq("slug", "clinicflow-development")
    .single();
  assertNoError(hospitalError, "load seeded hospital");

  const { data: facility, error: facilityError } = await admin
    .from("facilities")
    .select("id")
    .eq("hospital_id", hospital.id)
    .eq("code", "MAIN")
    .single();
  assertNoError(facilityError, "load seeded facility");

  const superAdmin = await createIdentity("super_admin", hospital.id, facility.id);
  await createIdentity("clinic_admin", hospital.id, facility.id);
  const doctor = await createIdentity("doctor", hospital.id, facility.id);
  const receptionist = await createIdentity("receptionist", hospital.id, facility.id);

  const { error: platformError } = await admin.from("platform_admins").insert({
    user_id: superAdmin.id,
    active: true,
  });
  assertNoError(platformError, "authorize synthetic platform administrator");

  const receptionistClient = createClient(url, anonKey, clientOptions);
  const { error: signInError } = await receptionistClient.auth.signInWithPassword({
    email: receptionist.email,
    password,
  });
  assertNoError(signInError, "sign in synthetic receptionist");

  const { error: patientError } = await receptionistClient.rpc("register_patient_with_details", {
    p_first_name: "Emma",
    p_last_name: "Bauer",
    p_date_of_birth: "1991-04-18",
    p_sex: "female",
    p_phone: "+919000000002",
    p_doctor_user_id: doctor.id,
    p_idempotency_key: `e2e-${randomUUID()}`,
    p_blood_group: "O+",
    p_email: "emma.bauer@example.test",
    p_whatsapp_phone: null,
    p_address: null,
    p_emergency_contact_name: null,
    p_emergency_contact_phone: null,
    p_allergies: [],
    p_chronic_conditions: [],
  });
  assertNoError(patientError, "create synthetic portal patient");
}

await main();
