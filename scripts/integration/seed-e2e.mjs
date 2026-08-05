import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.SUPABASE_DB_URL;

if (!url || !anonKey || !serviceRoleKey || !databaseUrl) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DB_URL are required",
  );
}

const clientOptions = {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
};
const admin = createClient(url, serviceRoleKey, clientOptions);
const sql = postgres(databaseUrl, { max: 1 });
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

  await sql`
    update public.profiles
    set display_name = ${displayName}
    where id = ${data.user.id}
  `;
  await sql`
    insert into public.staff_memberships (
      user_id, hospital_id, facility_id, role_code, specialty, active
    )
    values (
      ${data.user.id}, ${hospitalId}, ${facilityId}, ${roleCode},
      ${roleCode === "doctor" ? "General medicine" : null}, true
    )
  `;
  return { id: data.user.id, email };
}

async function main() {
  const [hospital] = await sql`
    select id from public.hospitals where slug = 'clinicflow-development'
  `;
  assert.ok(hospital, "seeded hospital must exist");
  const [facility] = await sql`
    select id
    from public.facilities
    where hospital_id = ${hospital.id} and code = 'MAIN'
  `;
  assert.ok(facility, "seeded facility must exist");

  const superAdmin = await createIdentity("super_admin", hospital.id, facility.id);
  await createIdentity("clinic_admin", hospital.id, facility.id);
  const doctor = await createIdentity("doctor", hospital.id, facility.id);
  const receptionist = await createIdentity("receptionist", hospital.id, facility.id);

  await sql`
    insert into public.platform_admins (user_id, active)
    values (${superAdmin.id}, true)
  `;

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

try {
  await main();
} finally {
  await sql.end();
}
