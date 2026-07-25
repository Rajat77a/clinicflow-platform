import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { useAuth, type AuthUser } from "./auth";
import { hasPermission, type Permission } from "./access-control";
import {
  appointments as seedAppointments,
  auditLogs as seedAuditLogs,
  bills as seedBills,
  clinics as seedClinics,
  doctors as seedDoctors,
  labReports as seedLabReports,
  patients as seedPatients,
  prescriptions as seedPrescriptions,
  receptionists as seedReceptionists,
  type LabReport as SeedLabReport,
  type Prescription as SeedPrescription,
} from "./sample-data";

const DEFAULT_CLINIC_ID = "CL-001";

export type Clinic = (typeof seedClinics)[number];
export type Patient = (typeof seedPatients)[number] & { clinicId: string };
export type Doctor = (typeof seedDoctors)[number] & { clinicId: string };
export type Receptionist = (typeof seedReceptionists)[number] & { clinicId: string };
export type Appointment = (typeof seedAppointments)[number] & { clinicId: string; notes?: string };
export type Prescription = SeedPrescription & { clinicId: string };
export type LabReport = SeedLabReport & { clinicId: string };
export type Bill = (typeof seedBills)[number] & { clinicId: string; patientId: string };
export type AuditEntry = (typeof seedAuditLogs)[number] & { id: string; clinicId: string | null };

export interface WorkspaceSnapshot {
  clinics: Clinic[];
  patients: Patient[];
  doctors: Doctor[];
  receptionists: Receptionist[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labReports: LabReport[];
  bills: Bill[];
  auditLogs: AuditEntry[];
}

export interface PatientInput {
  name: string;
  age: number;
  gender: string;
  phone: string;
  doctor: string;
}

export interface AppointmentInput {
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  type: string;
  notes?: string;
}

export interface PrescriptionInput {
  id?: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  notes?: string;
  followUp?: string;
  medicines: SeedPrescription["medicines"];
}

export interface BillInput {
  patientId: string;
  amount: number;
  method?: string;
}

export interface DoctorInput {
  name: string;
  specialty: string;
  email: string;
  phone: string;
}

export interface ReceptionistInput {
  name: string;
  email: string;
  phone: string;
  shift: string;
}

export interface ClinicInput {
  name: string;
  city: string;
}

type Command =
  | { type: "clinic.created"; value: Clinic; actor: AuthUser }
  | { type: "doctor.created"; value: Doctor; actor: AuthUser }
  | { type: "receptionist.created"; value: Receptionist; actor: AuthUser }
  | { type: "patient.created"; value: Patient; actor: AuthUser }
  | { type: "appointment.created"; value: Appointment; actor: AuthUser }
  | { type: "appointment.updated"; value: Appointment; actor: AuthUser }
  | { type: "prescription.saved"; value: Prescription; actor: AuthUser }
  | { type: "labs.saved"; values: LabReport[]; actor: AuthUser }
  | { type: "bill.created"; value: Bill; actor: AuthUser }
  | { type: "bill.updated"; value: Bill; actor: AuthUser };

function createId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8).toUpperCase()
    ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  return `${prefix}-${suffix}`;
}

function initialSnapshot(): WorkspaceSnapshot {
  const patientIdByName = new Map(seedPatients.map(patient => [patient.name, patient.id]));
  return {
    clinics: seedClinics.map(clinic => ({ ...clinic })),
    patients: seedPatients.map(patient => ({ ...patient, clinicId: DEFAULT_CLINIC_ID })),
    doctors: seedDoctors.map(doctor => ({ ...doctor, clinicId: DEFAULT_CLINIC_ID })),
    receptionists: seedReceptionists.map(receptionist => ({ ...receptionist, clinicId: DEFAULT_CLINIC_ID })),
    appointments: seedAppointments.map(appointment => ({ ...appointment, clinicId: DEFAULT_CLINIC_ID })),
    prescriptions: seedPrescriptions.map(prescription => ({ ...prescription, clinicId: DEFAULT_CLINIC_ID })),
    labReports: seedLabReports.map(report => ({ ...report, clinicId: DEFAULT_CLINIC_ID })),
    bills: seedBills.map(bill => ({
      ...bill,
      clinicId: DEFAULT_CLINIC_ID,
      patientId: patientIdByName.get(bill.patient) ?? "",
    })),
    auditLogs: seedAuditLogs.map((entry, index) => ({
      ...entry,
      id: `AUD-${index + 1}`,
      clinicId: entry.user === "Helena Vance" ? null : DEFAULT_CLINIC_ID,
    })),
  };
}

function appendAudit(state: WorkspaceSnapshot, actor: AuthUser, action: string): WorkspaceSnapshot {
  const now = new Date();
  const entry: AuditEntry = {
    id: createId("AUD"),
    user: actor.name,
    action,
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
    clinicId: actor.clinicId,
  };
  return { ...state, auditLogs: [entry, ...state.auditLogs] };
}

function reducer(state: WorkspaceSnapshot, command: Command): WorkspaceSnapshot {
  switch (command.type) {
    case "clinic.created":
      return appendAudit(
        { ...state, clinics: [command.value, ...state.clinics] },
        command.actor,
        `Created clinic ${command.value.id}`,
      );
    case "doctor.created": {
      const clinics = state.clinics.map(clinic =>
        clinic.id === command.value.clinicId ? { ...clinic, doctors: clinic.doctors + 1 } : clinic
      );
      return appendAudit(
        { ...state, clinics, doctors: [command.value, ...state.doctors] },
        command.actor,
        `Added doctor ${command.value.id}`,
      );
    }
    case "receptionist.created": {
      const clinics = state.clinics.map(clinic =>
        clinic.id === command.value.clinicId ? { ...clinic, receptionists: clinic.receptionists + 1 } : clinic
      );
      return appendAudit(
        { ...state, clinics, receptionists: [command.value, ...state.receptionists] },
        command.actor,
        `Added receptionist ${command.value.id}`,
      );
    }
    case "patient.created": {
      const clinics = state.clinics.map(clinic =>
        clinic.id === command.value.clinicId ? { ...clinic, patients: clinic.patients + 1 } : clinic
      );
      return appendAudit(
        { ...state, clinics, patients: [command.value, ...state.patients] },
        command.actor,
        `Registered patient ${command.value.id}`,
      );
    }
    case "appointment.created":
      return appendAudit(
        { ...state, appointments: [command.value, ...state.appointments] },
        command.actor,
        `Created appointment ${command.value.id}`,
      );
    case "appointment.updated":
      return appendAudit(
        {
          ...state,
          appointments: state.appointments.map(item => item.id === command.value.id ? command.value : item),
        },
        command.actor,
        `Updated appointment ${command.value.id}`,
      );
    case "prescription.saved": {
      const exists = state.prescriptions.some(item => item.id === command.value.id);
      return appendAudit(
        {
          ...state,
          prescriptions: exists
            ? state.prescriptions.map(item => item.id === command.value.id ? command.value : item)
            : [command.value, ...state.prescriptions],
        },
        command.actor,
        `${exists ? "Updated" : "Signed"} prescription ${command.value.id}`,
      );
    }
    case "labs.saved":
      return appendAudit(
        { ...state, labReports: [...command.values, ...state.labReports.filter(existing => !command.values.some(item => item.id === existing.id))] },
        command.actor,
        `Saved ${command.values.length} lab report${command.values.length === 1 ? "" : "s"}`,
      );
    case "bill.created":
      return appendAudit(
        { ...state, bills: [command.value, ...state.bills] },
        command.actor,
        `Created invoice ${command.value.id}`,
      );
    case "bill.updated":
      return appendAudit(
        { ...state, bills: state.bills.map(item => item.id === command.value.id ? command.value : item) },
        command.actor,
        `Updated invoice ${command.value.id} to ${command.value.status}`,
      );
  }
}

interface WorkspaceData {
  clinics: Clinic[];
  patients: Patient[];
  doctors: Doctor[];
  receptionists: Receptionist[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labReports: LabReport[];
  bills: Bill[];
  auditLogs: AuditEntry[];
  createClinic: (input: ClinicInput) => Clinic;
  createDoctor: (input: DoctorInput) => Doctor;
  createReceptionist: (input: ReceptionistInput) => Receptionist;
  createPatient: (input: PatientInput) => Patient;
  createAppointment: (input: AppointmentInput) => Appointment;
  updateAppointment: (appointment: Appointment) => void;
  savePrescription: (input: PrescriptionInput) => Prescription;
  saveLabReports: (reports: Omit<LabReport, "clinicId">[]) => LabReport[];
  createBill: (input: BillInput) => Bill;
  updateBill: (bill: Bill) => void;
}

const WorkspaceCtx = createContext<WorkspaceData | null>(null);

function requireUser(user: AuthUser | null, permission: Permission) {
  if (!user) throw new Error("An authenticated user is required");
  if (!hasPermission(user.role, permission)) throw new Error(`Missing permission: ${permission}`);
  return user;
}

function requireClinic(user: AuthUser) {
  if (!user.clinicId) throw new Error("A clinic workspace is required");
  return user.clinicId;
}

export function WorkspaceDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, undefined, initialSnapshot);

  const value = useMemo<WorkspaceData>(() => {
    const clinicId = user?.clinicId;
    const clinicScope = <T extends { clinicId: string }>(items: T[]) =>
      clinicId ? items.filter(item => item.clinicId === clinicId) : items;
    const clinicPatients = user && hasPermission(user.role, "patients.read")
      ? clinicScope(state.patients)
      : [];
    const clinicAppointments = user && hasPermission(user.role, "appointments.read")
      ? clinicScope(state.appointments)
      : [];
    const clinicPrescriptions = user && hasPermission(user.role, "prescriptions.read")
      ? clinicScope(state.prescriptions)
      : [];

    const patients = user?.role === "doctor"
      ? clinicPatients.filter(patient => patient.doctor === user.name)
      : clinicPatients;
    const appointments = user?.role === "doctor"
      ? clinicAppointments.filter(appointment => appointment.doctor === user.name)
      : clinicAppointments;
    const prescriptions = user?.role === "doctor"
      ? clinicPrescriptions.filter(prescription => prescription.doctor === user.name)
      : clinicPrescriptions;

    return {
      clinics: state.clinics,
      patients,
      doctors: clinicScope(state.doctors),
      receptionists: clinicScope(state.receptionists),
      appointments,
      prescriptions,
      labReports: user && (hasPermission(user.role, "labs.write") || hasPermission(user.role, "prescriptions.read"))
        ? clinicScope(state.labReports).filter(report =>
            user.role !== "doctor" || patients.some(patient => patient.id === report.patientId)
          )
        : [],
      bills: user && hasPermission(user.role, "billing.read") ? clinicScope(state.bills) : [],
      auditLogs: user?.role === "super_admin"
        ? state.auditLogs
        : state.auditLogs.filter(entry => entry.clinicId === clinicId),
      createClinic: input => {
        const actor = requireUser(user, "platform.clinics.manage");
        const expires = new Date();
        expires.setDate(expires.getDate() + 14);
        const clinic: Clinic = {
          id: createId("CL"),
          name: input.name,
          city: input.city,
          doctors: 0,
          receptionists: 0,
          patients: 0,
          plan: "ClinicFlow",
          status: "Active",
          expires: expires.toISOString().slice(0, 10),
        };
        dispatch({ type: "clinic.created", value: clinic, actor });
        return clinic;
      },
      createDoctor: input => {
        const actor = requireUser(user, "people.manage");
        const tenantId = requireClinic(actor);
        const doctor: Doctor = {
          ...input,
          id: createId("DR"),
          clinicId: tenantId,
          patients: 0,
          status: "Active",
        };
        dispatch({ type: "doctor.created", value: doctor, actor });
        return doctor;
      },
      createReceptionist: input => {
        const actor = requireUser(user, "people.manage");
        const tenantId = requireClinic(actor);
        const receptionist: Receptionist = {
          ...input,
          id: createId("RC"),
          clinicId: tenantId,
          status: "Active",
        };
        dispatch({ type: "receptionist.created", value: receptionist, actor });
        return receptionist;
      },
      createPatient: input => {
        const actor = requireUser(user, "patients.create");
        const tenantId = requireClinic(actor);
        const patient: Patient = {
          ...input,
          id: createId("PT"),
          clinicId: tenantId,
          lastVisit: new Date().toISOString().slice(0, 10),
          status: "New",
        };
        dispatch({ type: "patient.created", value: patient, actor });
        return patient;
      },
      createAppointment: input => {
        const actor = requireUser(user, "appointments.create");
        const tenantId = requireClinic(actor);
        const patient = state.patients.find(item => item.id === input.patientId && item.clinicId === tenantId);
        const doctor = state.doctors.find(item => item.id === input.doctorId && item.clinicId === tenantId);
        if (!patient || !doctor) throw new Error("Patient and doctor must belong to the active clinic");
        if (actor.role === "doctor" && doctor.name !== actor.name) {
          throw new Error("Doctors can only book appointments into their own queue");
        }
        const appointment: Appointment = {
          id: createId("AP"),
          clinicId: tenantId,
          patient: patient.name,
          patientId: patient.id,
          doctor: doctor.name,
          date: input.date,
          time: input.time,
          type: input.type,
          status: "Pending",
          notes: input.notes,
        };
        dispatch({ type: "appointment.created", value: appointment, actor });
        return appointment;
      },
      updateAppointment: appointment => {
        const actor = requireUser(user, "appointments.update");
        if (appointment.clinicId !== requireClinic(actor)) throw new Error("Cross-clinic updates are not allowed");
        dispatch({ type: "appointment.updated", value: appointment, actor });
      },
      savePrescription: input => {
        const actor = requireUser(user, "prescriptions.write");
        const tenantId = requireClinic(actor);
        const patient = state.patients.find(item => item.id === input.patientId && item.clinicId === tenantId);
        const doctor = state.doctors.find(item => item.id === input.doctorId && item.clinicId === tenantId);
        if (!patient || !doctor || doctor.name !== actor.name) throw new Error("Doctors can only sign their own clinic prescriptions");
        const prescription: Prescription = {
          id: input.id ?? createId("RX"),
          clinicId: tenantId,
          patient: patient.name,
          patientId: patient.id,
          doctor: doctor.name,
          date: new Date().toISOString().slice(0, 10),
          diagnosis: input.diagnosis,
          notes: input.notes,
          followUp: input.followUp,
          medicines: input.medicines,
        };
        dispatch({ type: "prescription.saved", value: prescription, actor });
        return prescription;
      },
      saveLabReports: reports => {
        const actor = requireUser(user, "labs.write");
        const tenantId = requireClinic(actor);
        if (reports.some(report => !state.patients.some(patient => patient.id === report.patientId && patient.clinicId === tenantId))) {
          throw new Error("Lab reports must belong to a patient in the active clinic");
        }
        const values = reports.map(report => ({ ...report, clinicId: tenantId }));
        dispatch({ type: "labs.saved", values, actor });
        return values;
      },
      createBill: input => {
        const actor = requireUser(user, "billing.write");
        const tenantId = requireClinic(actor);
        const patient = state.patients.find(item => item.id === input.patientId && item.clinicId === tenantId);
        if (!patient) throw new Error("Patient must belong to the active clinic");
        const bill: Bill = {
          id: createId("INV"),
          clinicId: tenantId,
          patientId: patient.id,
          patient: patient.name,
          date: new Date().toISOString().slice(0, 10),
          amount: input.amount,
          status: "Pending",
          method: input.method ?? "—",
        };
        dispatch({ type: "bill.created", value: bill, actor });
        return bill;
      },
      updateBill: bill => {
        const actor = requireUser(user, "billing.write");
        if (bill.clinicId !== requireClinic(actor)) throw new Error("Cross-clinic updates are not allowed");
        dispatch({ type: "bill.updated", value: bill, actor });
      },
    };
  }, [state, user]);

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspaceData() {
  const value = useContext(WorkspaceCtx);
  if (!value) throw new Error("useWorkspaceData must be used inside WorkspaceDataProvider");
  return value;
}
