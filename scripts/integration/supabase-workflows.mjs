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
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};
const admin = createClient(url, serviceRoleKey, clientOptions);
const sql = postgres(databaseUrl, { max: 1 });
const password = "Integration!2026#ClinicFlow";

function assertNoError(error, context) {
  assert.equal(error, null, `${context}: ${error?.message ?? "unknown error"}`);
}

async function createIdentity(label, roleCode, hospitalId, facilityId) {
  const email = `${label}.${randomUUID()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Integration ${label}` },
  });
  assertNoError(error, `create ${label} identity`);
  assert.ok(data.user, `${label} identity was not returned`);

  await sql`
    update public.profiles
    set display_name = ${`Integration ${label}`}
    where id = ${data.user.id}
  `;
  await sql`
    insert into public.staff_memberships (
      user_id,
      hospital_id,
      facility_id,
      role_code,
      specialty,
      active
    )
    values (
      ${data.user.id},
      ${hospitalId},
      ${facilityId},
      ${roleCode},
      ${roleCode === "doctor" ? "Integration medicine" : null},
      true
    )
  `;

  const client = createClient(url, anonKey, clientOptions);
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  assertNoError(signInError, `sign in ${label}`);
  assert.ok(signInData.session, `${label} session was not returned`);
  await client.realtime.setAuth(signInData.session.access_token);
  return { client, email, id: data.user.id };
}

async function visibleIds(client, table, id) {
  const { data, error } = await client.from(table).select("id").eq("id", id);
  assertNoError(error, `read ${table}`);
  return (data ?? []).map((row) => row.id);
}

async function main() {
  const [hospital] = await sql`select id from public.hospitals limit 1`;
  assert.ok(hospital, "seeded hospital must exist");
  const [facility] = await sql`
    select id
    from public.facilities
    where hospital_id = ${hospital.id}
    limit 1
  `;
  assert.ok(facility, "seeded facility must exist");

  const clinicAdmin = await createIdentity(
    "clinic-admin",
    "clinic_admin",
    hospital.id,
    facility.id,
  );
  const doctor = await createIdentity("doctor", "doctor", hospital.id, facility.id);
  const unrelatedDoctor = await createIdentity(
    "unrelated-doctor",
    "doctor",
    hospital.id,
    facility.id,
  );
  const receptionist = await createIdentity(
    "receptionist",
    "receptionist",
    hospital.id,
    facility.id,
  );
  const superAdmin = await createIdentity("super-admin", "super_admin", hospital.id, facility.id);

  const { data: assurance, error: assuranceError } =
    await clinicAdmin.client.auth.mfa.getAuthenticatorAssuranceLevel();
  assertNoError(assuranceError, "read clinic administrator assurance level");
  assert.equal(assurance.currentLevel, "aal1", "integration must exercise password-only access");

  const { data: visibleStaff, error: visibleStaffError } =
    await clinicAdmin.client.rpc("list_current_staff");
  assertNoError(visibleStaffError, "list staff as a password-authenticated clinic administrator");
  assert.ok(
    visibleStaff.some((member) => member.user_id === doctor.id),
    "clinic administrator must manage staff without mandatory OTP during development",
  );

  const { data: adminDirectory, error: adminDirectoryError } = await clinicAdmin.client.rpc(
    "list_active_doctors_with_counts",
  );
  assertNoError(adminDirectoryError, "load the administrative doctor directory");
  const adminDoctor = adminDirectory.find((member) => member.user_id === doctor.id);
  assert.equal(
    adminDoctor?.email,
    doctor.email,
    "clinic administrator must retain staff contact data",
  );

  const { data: schedulingDirectory, error: schedulingDirectoryError } =
    await receptionist.client.rpc("list_active_doctors_with_counts");
  assertNoError(schedulingDirectoryError, "load the appointment doctor directory");
  const schedulingDoctor = schedulingDirectory.find((member) => member.user_id === doctor.id);
  assert.ok(schedulingDoctor, "receptionist must retain the doctor scheduling option");
  assert.equal(
    schedulingDoctor.email,
    null,
    "appointment-only roles must not receive doctor email",
  );
  assert.equal(
    schedulingDoctor.phone,
    null,
    "appointment-only roles must not receive doctor phone",
  );
  assert.equal(
    schedulingDoctor.administrative_notes,
    null,
    "appointment-only roles must not receive administrative notes",
  );

  const [patientsPublication] = await sql`
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'patients'
  `;
  assert.ok(patientsPublication, "patients must belong to the Supabase Realtime publication");

  let resolveRealtime;
  const realtimeEvent = new Promise((resolve) => {
    resolveRealtime = resolve;
  });
  let resolvePostgresReady;
  const postgresReady = new Promise((resolve) => {
    resolvePostgresReady = resolve;
  });
  const channel = receptionist.client
    .channel(`integration-${randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "patients",
        filter: `hospital_id=eq.${hospital.id}`,
      },
      (payload) => resolveRealtime(payload.new.id),
    )
    .on("system", {}, (payload) => {
      if (payload.extension === "postgres_changes" && payload.status === "ok") {
        resolvePostgresReady();
      }
    });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Realtime subscription timed out")), 10_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        reject(new Error(`Realtime subscription failed: ${status}`));
      }
    });
  });
  await Promise.race([
    postgresReady,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Postgres Changes subscription was not ready")), 10_000),
    ),
  ]);

  const idempotencyKey = () => `integration-${randomUUID()}`;
  const { data: patientId, error: patientError } = await receptionist.client.rpc(
    "register_patient",
    {
      p_first_name: "Synthetic",
      p_last_name: "Patient",
      p_date_of_birth: "1990-01-01",
      p_sex: "not_disclosed",
      p_phone: "+910000000000",
      p_doctor_user_id: doctor.id,
      p_idempotency_key: idempotencyKey(),
    },
  );
  assertNoError(patientError, "receptionist registers patient");
  assert.deepEqual(
    await visibleIds(receptionist.client, "patients", patientId),
    [patientId],
    "receptionist must retain RLS visibility of the registered patient",
  );
  const realtimePatientId = await Promise.race([
    realtimeEvent,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Patient Realtime event did not arrive")), 20_000),
    ),
  ]);
  assert.equal(realtimePatientId, patientId, "Realtime must publish the created patient");
  await receptionist.client.removeChannel(channel);

  assert.deepEqual(
    await visibleIds(doctor.client, "patients", patientId),
    [patientId],
    "assigned doctor must see the patient",
  );
  assert.deepEqual(
    await visibleIds(unrelatedDoctor.client, "patients", patientId),
    [],
    "unrelated doctor must not see the patient",
  );
  assert.deepEqual(
    await visibleIds(superAdmin.client, "patients", patientId),
    [],
    "platform administrator must not see patient data",
  );
  assert.deepEqual(
    await visibleIds(clinicAdmin.client, "patients", patientId),
    [patientId],
    "AAL2 clinic administrator must see hospital patients",
  );

  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: appointmentId, error: appointmentError } = await receptionist.client.rpc(
    "book_appointment",
    {
      p_patient_id: patientId,
      p_doctor_user_id: doctor.id,
      p_starts_at: startsAt,
      p_duration_minutes: 30,
      p_reason: "Synthetic integration appointment",
      p_administrative_notes: null,
      p_idempotency_key: idempotencyKey(),
    },
  );
  assertNoError(appointmentError, "receptionist books appointment");
  assert.deepEqual(
    await visibleIds(doctor.client, "appointments", appointmentId),
    [appointmentId],
    "assigned doctor must see the appointment",
  );
  assert.deepEqual(
    await visibleIds(unrelatedDoctor.client, "appointments", appointmentId),
    [],
    "unrelated doctor must not see the appointment",
  );

  const medicines = [
    {
      name: "Synthetic medicine",
      dosage: "1 tablet",
      frequency: "once daily",
      duration: "3 days",
    },
  ];
  const { data: prescriptionId, error: prescriptionError } = await doctor.client.rpc(
    "sign_prescription",
    {
      p_patient_id: patientId,
      p_diagnosis: "Synthetic integration diagnosis",
      p_clinical_notes: "No real clinical data",
      p_follow_up_at: null,
      p_medicines: medicines,
      p_idempotency_key: idempotencyKey(),
    },
  );
  assertNoError(prescriptionError, "assigned doctor signs prescription");
  assert.deepEqual(
    await visibleIds(clinicAdmin.client, "prescriptions", prescriptionId),
    [prescriptionId],
    "clinic administrator must see the signed prescription",
  );
  assert.deepEqual(
    await visibleIds(unrelatedDoctor.client, "prescriptions", prescriptionId),
    [],
    "unrelated doctor must not see the prescription",
  );
  const { error: receptionistPrescriptionError } = await receptionist.client.rpc(
    "sign_prescription",
    {
      p_patient_id: patientId,
      p_diagnosis: "Must be rejected",
      p_clinical_notes: null,
      p_follow_up_at: null,
      p_medicines: medicines,
      p_idempotency_key: idempotencyKey(),
    },
  );
  assert.ok(receptionistPrescriptionError, "receptionist prescription signing must be denied");

  const { data: invoiceId, error: invoiceError } = await receptionist.client.rpc("create_invoice", {
    p_patient_id: patientId,
    p_description: "Synthetic integration service",
    p_amount: 100,
    p_idempotency_key: idempotencyKey(),
  });
  assertNoError(invoiceError, "receptionist creates invoice");
  assert.deepEqual(
    await visibleIds(receptionist.client, "invoices", invoiceId),
    [invoiceId],
    "receptionist must see the invoice",
  );
  assert.deepEqual(
    await visibleIds(doctor.client, "invoices", invoiceId),
    [],
    "doctor must not see billing records",
  );

  const { data: auditRows, error: auditError } = await clinicAdmin.client
    .from("audit_events")
    .select("action,entity_type")
    .eq("hospital_id", hospital.id);
  assertNoError(auditError, "clinic administrator reads audit trail");
  const auditEvents = new Set((auditRows ?? []).map((row) => `${row.action}:${row.entity_type}`));
  for (const event of [
    "insert:patients",
    "insert:appointments",
    "insert:prescriptions",
    "insert:invoices",
  ]) {
    assert.ok(auditEvents.has(event), `audit trail must contain ${event}`);
  }

  console.log("Cross-portal Supabase integration passed");
}

try {
  await main();
} finally {
  await sql.end({ timeout: 5 });
}
