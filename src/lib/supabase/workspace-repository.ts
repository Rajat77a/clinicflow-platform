import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PatientPage,
  PatientSearch,
  WorkspaceRepository,
} from "../backend/workspace-repository";
import type {
  Appointment,
  AppointmentInput,
  Bill,
  BillInput,
  ClinicAdminInput,
  Doctor,
  DoctorInput,
  LabReport,
  Patient,
  PatientInput,
  Prescription,
  PrescriptionInput,
  Receptionist,
  ReceptionistInput,
  StaffMember,
  WorkspaceSnapshot,
} from "../workspace-data";
import { getSupabaseBrowserClient } from "./client";

// Supabase query results are validated and normalized at this repository boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const EMPTY_SNAPSHOT: WorkspaceSnapshot = {
  clinics: [],
  patients: [],
  doctors: [],
  receptionists: [],
  appointments: [],
  prescriptions: [],
  labReports: [],
  bills: [],
  auditLogs: [],
  staffMembers: [],
};

function randomKey() {
  return globalThis.crypto.randomUUID();
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function yearsSince(date: string) {
  const birth = new Date(`${date}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return Math.max(0, age);
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts.shift() ?? "",
    lastName: parts.join(" ") || "Unknown",
  };
}

function patientSex(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "m" || normalized === "male") return "male";
  if (normalized === "f" || normalized === "female") return "female";
  if (normalized === "intersex") return "intersex";
  if (normalized === "unknown") return "unknown";
  return "not_disclosed";
}

function displaySex(value: string | null) {
  if (!value) return "Not disclosed";
  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function mapPatient(row: Row, doctorName?: string): Patient {
  return {
    id: row.id,
    clinicId: row.hospital_id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    age: yearsSince(row.date_of_birth),
    dateOfBirth: row.date_of_birth,
    gender: displaySex(row.sex),
    phone: row.phone || "",
    doctor: doctorName ?? row.doctor_name ?? "Unassigned",
    lastVisit: row.updated_at.slice(0, 10),
    status: row.status === "active" ? "Active" : row.status,
    version: row.version,
    medicalRecordNumber: row.medical_record_number,
  };
}

const appointmentStatusToUi: Record<string, string> = {
  scheduled: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked-in",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const appointmentStatusToDb: Record<string, string> = Object.fromEntries(
  Object.entries(appointmentStatusToUi).map(([database, ui]) => [ui, database]),
);

function firstRelation(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row | undefined) ?? null;
  return value && typeof value === "object" ? (value as Row) : null;
}

function relatedPatientName(row: Row) {
  const patient = firstRelation(row.patients);
  if (!patient) return "Restricted patient";
  return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Restricted patient";
}

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly client: SupabaseClient = getSupabaseBrowserClient()) {}

  async load(): Promise<WorkspaceSnapshot> {
    const [
      hospitalResult,
      doctorsResult,
      membershipsResult,
      patientsResult,
      appointmentsResult,
      prescriptionsResult,
      labOrdersResult,
      invoicesResult,
      auditResult,
    ] = await Promise.all([
      this.client.from("hospitals").select("id,name,configuration").maybeSingle(),
      this.client.rpc("list_active_doctors_with_counts"),
      this.client
        .from("staff_memberships")
        .select(
          "user_id,hospital_id,role_code,active,specialty,shift,profiles!staff_memberships_user_id_fkey(display_name,email,phone)",
        ),
      this.client.rpc("search_patients", {
        p_query: "",
        p_limit: 50,
        p_offset: 0,
      }),
      this.client
        .from("appointments")
        .select(
          "id,hospital_id,patient_id,doctor_user_id,starts_at,ends_at,status,reason,administrative_notes,version,patients(first_name,last_name)",
        )
        .order("starts_at", { ascending: true }),
      this.client
        .from("prescriptions")
        .select(
          "id,hospital_id,patient_id,prescriber_user_id,status,instructions,follow_up_at,signed_at,created_at,patients(first_name,last_name),encounters(diagnoses),prescription_items(medicine_name,dosage,frequency,duration)",
        )
        .order("created_at", { ascending: false }),
      this.client
        .from("lab_orders")
        .select(
          "id,hospital_id,patient_id,test_name,completed_at,ordered_at,patients(first_name,last_name),lab_results(id,result,interpretation,recorded_at,status,recorded_by)",
        )
        .order("ordered_at", { ascending: false }),
      this.client
        .from("invoices")
        .select(
          "id,hospital_id,patient_id,invoice_number,status,total,issued_at,created_at,patients(first_name,last_name),payments(method,status,received_at)",
        )
        .order("created_at", { ascending: false }),
      this.client
        .from("audit_events")
        .select(
          "id,hospital_id,actor_user_id,action,entity_type,entity_id,occurred_at,profiles!audit_events_actor_user_id_fkey(display_name)",
        )
        .order("occurred_at", { ascending: false })
        .limit(250),
    ]);

    [
      hospitalResult,
      doctorsResult,
      membershipsResult,
      patientsResult,
      appointmentsResult,
      prescriptionsResult,
      labOrdersResult,
      invoicesResult,
      auditResult,
    ].forEach((result) => throwIfError(result.error));

    const hospital = hospitalResult.data as Row | null;
    if (!hospital) return EMPTY_SNAPSHOT;

    const doctors: Doctor[] = ((doctorsResult.data ?? []) as Row[]).map((row) => ({
      id: row.user_id,
      clinicId: hospital.id,
      name: row.display_name,
      specialty: row.specialty || "General Medicine",
      email: row.email || "",
      phone: row.phone || "",
      patients: Number(row.patient_count ?? 0),
      status: "Active",
    }));
    const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]));

    const careTeamDoctor = new Map<string, string>();
    for (const row of (patientsResult.data ?? []) as Row[]) {
      if (row.doctor_user_id && doctorById.has(row.doctor_user_id)) {
        careTeamDoctor.set(row.id, row.doctor_user_id);
      }
    }

    const patients: Patient[] = ((patientsResult.data ?? []) as Row[]).map((row) =>
      mapPatient(row, doctorById.get(careTeamDoctor.get(row.id) ?? "")?.name),
    );
    const patientById = new Map(patients.map((patient) => [patient.id, patient]));

    const receptionists: Receptionist[] = ((membershipsResult.data ?? []) as Row[])
      .filter((row) => row.role_code === "receptionist")
      .map((row) => {
        const profile = firstRelation(row.profiles);
        return {
          id: row.user_id,
          clinicId: row.hospital_id,
          name: profile?.display_name ?? "Invited staff",
          email: profile?.email ?? "",
          phone: profile?.phone ?? "",
          shift: row.shift || "Unassigned",
          status: row.active ? "Active" : "Inactive",
        };
      });
    const staffMembers: StaffMember[] = ((membershipsResult.data ?? []) as Row[]).map((row) => {
      const profile = firstRelation(row.profiles);
      return {
        id: row.user_id,
        clinicId: row.hospital_id,
        name: profile?.display_name ?? "Invited staff",
        email: profile?.email ?? "",
        phone: profile?.phone ?? "",
        role: row.role_code,
        status: row.active ? "Active" : "Inactive",
      };
    });

    const appointments: Appointment[] = ((appointmentsResult.data ?? []) as Row[]).map((row) => {
      const start = new Date(row.starts_at);
      const end = new Date(row.ends_at);
      return {
        id: row.id,
        clinicId: row.hospital_id,
        patientId: row.patient_id,
        patient: patientById.get(row.patient_id)?.name ?? relatedPatientName(row),
        doctor: doctorById.get(row.doctor_user_id)?.name ?? "Unknown doctor",
        doctorId: row.doctor_user_id,
        date: start.toISOString().slice(0, 10),
        time: start.toISOString().slice(11, 16),
        durationMinutes: Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)),
        type: row.reason,
        status: appointmentStatusToUi[row.status] ?? row.status,
        notes: row.administrative_notes || undefined,
        version: row.version,
      };
    });

    const prescriptions: Prescription[] = ((prescriptionsResult.data ?? []) as Row[]).map((row) => {
      const encounter = firstRelation(row.encounters);
      return {
        id: row.id,
        clinicId: row.hospital_id,
        patientId: row.patient_id,
        patient: patientById.get(row.patient_id)?.name ?? relatedPatientName(row),
        doctor: doctorById.get(row.prescriber_user_id)?.name ?? "Unknown doctor",
        date: (row.signed_at || row.created_at).slice(0, 10),
        diagnosis: encounter?.diagnoses?.[0] ?? "Not recorded",
        notes: row.instructions || undefined,
        followUp: row.follow_up_at?.slice(0, 10),
        medicines: ((row.prescription_items ?? []) as Row[]).map((item) => ({
          name: item.medicine_name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
        })),
      };
    });

    const labReports: LabReport[] = [];
    for (const order of (labOrdersResult.data ?? []) as Row[]) {
      for (const result of (order.lab_results ?? []) as Row[]) {
        const structured = (result.result ?? {}) as Record<string, string>;
        labReports.push({
          id: result.id,
          clinicId: order.hospital_id,
          patientId: order.patient_id,
          patient: patientById.get(order.patient_id)?.name ?? relatedPatientName(order),
          test: order.test_name,
          date: (result.recorded_at || order.completed_at || order.ordered_at).slice(0, 10),
          result: structured.value ?? structured.result ?? "",
          reference: structured.reference ?? "",
          notes: result.interpretation || undefined,
          uploadedBy: doctorById.get(result.recorded_by)?.name ?? "Hospital staff",
        });
      }
    }

    const bills: Bill[] = ((invoicesResult.data ?? []) as Row[]).map((row) => {
      const payment = ((row.payments ?? []) as Row[]).find((item) => item.status === "confirmed");
      return {
        id: row.invoice_number,
        databaseId: row.id,
        clinicId: row.hospital_id,
        patientId: row.patient_id,
        patient: patientById.get(row.patient_id)?.name ?? relatedPatientName(row),
        date: (row.issued_at || row.created_at).slice(0, 10),
        amount: Number(row.total),
        status:
          row.status === "paid"
            ? "Paid"
            : row.status === "void"
              ? "Void"
              : row.status === "issued"
                ? "Pending"
                : row.status,
        method: payment?.method ?? "-",
      };
    });

    const clinic = {
      id: hospital.id,
      name: hospital.name,
      city: String(hospital.configuration?.city ?? ""),
      doctors: doctors.length,
      receptionists: receptionists.length,
      patients: Number(((patientsResult.data ?? []) as Row[])[0]?.total_count ?? 0),
      plan: "Dedicated installation",
      status: "Active",
      expires: "Not applicable",
    };

    return {
      clinics: [clinic],
      patients,
      doctors,
      receptionists,
      appointments,
      prescriptions,
      labReports,
      bills,
      auditLogs: ((auditResult.data ?? []) as Row[]).map((row) => {
        const occurred = new Date(row.occurred_at);
        const profile = firstRelation(row.profiles);
        return {
          id: String(row.id),
          clinicId: row.hospital_id,
          user: profile?.display_name ?? "System",
          action: `${row.action} ${row.entity_type}${row.entity_id ? ` ${row.entity_id}` : ""}`,
          date: occurred.toISOString().slice(0, 10),
          time: occurred.toISOString().slice(11, 16),
        };
      }),
      staffMembers,
    };
  }

  async searchPatients(input: PatientSearch = {}): Promise<PatientPage> {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const { data, error } = await this.client.rpc("search_patients", {
      p_query: input.query?.trim() ?? "",
      p_limit: limit,
      p_offset: offset,
    });
    throwIfError(error);

    const rows = (data ?? []) as Row[];
    return {
      rows: rows.map((row) => mapPatient(row)),
      total: rows.length ? Number(rows[0].total_count) : 0,
      limit,
      offset,
    };
  }

  async getPatient(id: string) {
    const page = await this.searchPatients({ query: id, limit: 20 });
    return page.rows.find((patient) => patient.id === id) ?? null;
  }

  private async reloadAndFind<T>(
    collection: keyof WorkspaceSnapshot,
    id: string,
  ): Promise<T> {
    const snapshot = await this.load();
    const value = (snapshot[collection] as Array<{ id: string }>).find((item) => item.id === id);
    if (!value) throw new Error("Saved record is not visible to the current role");
    return value as T;
  }

  private async inviteStaff(
    input: DoctorInput | ReceptionistInput | ClinicAdminInput,
    roleCode: "clinic_admin" | "doctor" | "receptionist",
  ) {
    const { data, error } = await this.client.functions.invoke("invite-staff", {
      headers: { "Idempotency-Key": randomKey() },
      body: {
        email: input.email,
        fullName: input.name,
        roleCode,
        specialty: "specialty" in input ? input.specialty : undefined,
        shift: "shift" in input ? input.shift : undefined,
        redirectTo: `${globalThis.location.origin}/login`,
      },
    });
    throwIfError(error);
    return data.userId as string;
  }

  async createDoctor(input: DoctorInput) {
    const id = await this.inviteStaff(input, "doctor");
    return this.reloadAndFind<Doctor>("doctors", id);
  }

  async createReceptionist(input: ReceptionistInput) {
    const id = await this.inviteStaff(input, "receptionist");
    return this.reloadAndFind<Receptionist>("receptionists", id);
  }

  async inviteClinicAdmin(input: ClinicAdminInput) {
    const id = await this.inviteStaff(input, "clinic_admin");
    return this.reloadAndFind<StaffMember>("staffMembers", id);
  }

  async createPatient(input: PatientInput) {
    const { firstName, lastName } = splitName(input.name);
    const { data, error } = await this.client.rpc("register_patient", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_date_of_birth: input.dateOfBirth,
      p_sex: patientSex(input.gender),
      p_phone: input.phone,
      p_doctor_user_id: input.doctorId,
      p_idempotency_key: randomKey(),
    });
    throwIfError(error);
    return this.reloadAndFind<Patient>("patients", data as string);
  }

  async createAppointment(input: AppointmentInput) {
    const { data, error } = await this.client.rpc("book_appointment", {
      p_patient_id: input.patientId,
      p_doctor_user_id: input.doctorId,
      p_starts_at: new Date(`${input.date}T${input.time}:00`).toISOString(),
      p_duration_minutes: input.durationMinutes ?? 30,
      p_reason: input.type,
      p_administrative_notes: input.notes ?? null,
      p_idempotency_key: randomKey(),
    });
    throwIfError(error);
    return this.reloadAndFind<Appointment>("appointments", data as string);
  }

  async updateAppointment(appointment: Appointment) {
    const { error } = await this.client.rpc("update_appointment", {
      p_appointment_id: appointment.id,
      p_expected_version: appointment.version,
      p_starts_at: new Date(`${appointment.date}T${appointment.time}:00`).toISOString(),
      p_duration_minutes: appointment.durationMinutes ?? 30,
      p_status: appointmentStatusToDb[appointment.status] ?? appointment.status,
      p_reason: appointment.type,
      p_administrative_notes: appointment.notes ?? null,
    });
    throwIfError(error);
    return this.reloadAndFind<Appointment>("appointments", appointment.id);
  }

  async savePrescription(input: PrescriptionInput) {
    if (input.id) {
      throw new Error("Signed prescriptions are immutable; create a replacement prescription");
    }
    const { data, error } = await this.client.rpc("sign_prescription", {
      p_patient_id: input.patientId,
      p_diagnosis: input.diagnosis,
      p_clinical_notes: input.notes ?? null,
      p_follow_up_at: input.followUp ? `${input.followUp}T00:00:00.000Z` : null,
      p_medicines: input.medicines,
      p_idempotency_key: randomKey(),
    });
    throwIfError(error);
    return this.reloadAndFind<Prescription>("prescriptions", data as string);
  }

  async saveLabReports(reports: Omit<LabReport, "clinicId">[]) {
    const saved: LabReport[] = [];
    for (const report of reports) {
      const { data, error } = await this.client.rpc("record_lab_result", {
        p_patient_id: report.patientId,
        p_test_name: report.test,
        p_result: { value: report.result, reference: report.reference },
        p_interpretation: report.notes ?? null,
        p_idempotency_key: randomKey(),
      });
      throwIfError(error);
      saved.push(await this.reloadAndFind<LabReport>("labReports", data as string));
    }
    return saved;
  }

  async createBill(input: BillInput) {
    const { data, error } = await this.client.rpc("create_invoice", {
      p_patient_id: input.patientId,
      p_description: "Clinical services",
      p_amount: input.amount,
      p_idempotency_key: randomKey(),
    });
    throwIfError(error);
    const snapshot = await this.load();
    const bill = snapshot.bills.find((item) => item.databaseId === data);
    if (!bill) throw new Error("Saved invoice is not visible to the current role");
    return bill;
  }

  async updateBill(bill: Bill) {
    if (!bill.databaseId) throw new Error("Invoice database identifier is missing");
    if (bill.status !== "Paid") {
      throw new Error("Use the payment workflow to close an invoice");
    }
    const { error } = await this.client.rpc("record_invoice_payment", {
      p_invoice_id: bill.databaseId,
      p_method: bill.method,
      p_idempotency_key: randomKey(),
    });
    throwIfError(error);
    const snapshot = await this.load();
    const updated = snapshot.bills.find((item) => item.databaseId === bill.databaseId);
    if (!updated) throw new Error("Updated invoice is not visible to the current role");
    return updated;
  }
}
