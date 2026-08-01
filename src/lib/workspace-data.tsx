import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth, type AuthUser } from "./auth";
import { hasPermission, type Permission } from "./access-control";
import { supabaseConfig } from "./supabase/config";
import { getSupabaseBrowserClient } from "./supabase/client";
import { subscribeToWorkspaceChanges } from "./supabase/workspace-realtime";
import { SupabaseWorkspaceRepository } from "./supabase/workspace-repository";
import type {
  PatientPage,
  PatientSearch,
  RecordPage,
  RecordPageInput,
} from "./backend/workspace-repository";
import { localRecordPage } from "./record-page";
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
export type Patient = (typeof seedPatients)[number] & {
  clinicId: string;
  dateOfBirth?: string;
  medicalRecordNumber?: string;
  bloodGroup?: string;
  email?: string;
  whatsappPhone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string[];
  chronicConditions?: string[];
  version?: number;
};
export type Doctor = (typeof seedDoctors)[number] & {
  clinicId: string;
  phone?: string;
  gender?: string;
  qualification?: string;
  medicalRegistrationNumber?: string;
  experienceYears?: number;
  consultationFee?: number;
  workingHours?: string;
  notes?: string;
  avatarPath?: string;
  avatarUrl?: string;
  photoWarning?: string;
};
export type Receptionist = (typeof seedReceptionists)[number] & { clinicId: string };
export type Appointment = (typeof seedAppointments)[number] & {
  clinicId: string;
  doctorId?: string;
  durationMinutes?: number;
  notes?: string;
  version?: number;
};
export type Prescription = SeedPrescription & { clinicId: string };
export type LabReport = SeedLabReport & { clinicId: string };
export type Bill = (typeof seedBills)[number] & {
  clinicId: string;
  patientId: string;
  databaseId?: string;
  subtotal?: number;
  tax?: number;
  discount?: number;
  items?: BillLineInput[];
};
export type AuditEntry = (typeof seedAuditLogs)[number] & { id: string; clinicId: string | null };
export type StaffMember = {
  id: string;
  clinicId: string;
  name: string;
  email: string;
  phone: string;
  role: AuthUser["role"];
  status: "Active" | "Invited" | "Inactive";
};

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
  staffMembers: StaffMember[];
}

export interface PatientInput {
  name: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  doctorId: string;
  bloodGroup?: string;
  email?: string;
  whatsappPhone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string[];
  chronicConditions?: string[];
}

export interface AppointmentInput {
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  type: string;
  durationMinutes?: number;
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
  method?: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  items: BillLineInput[];
}

export interface BillLineInput {
  category: "Consultation" | "Procedure" | "Medicine" | "Lab" | "Other";
  name: string;
  qty: number;
  unit: number;
}

export interface DoctorInput {
  name: string;
  specialty: string;
  email: string;
  phone: string;
  gender: "female" | "male" | "other" | "";
  qualification: string;
  medicalRegistrationNumber: string;
  experienceYears: number;
  consultationFee: number;
  workingHours: string;
  notes: string;
  photo?: File | null;
}

export interface ReceptionistInput {
  name: string;
  email: string;
  phone: string;
  shift: string;
}

export interface ClinicAdminInput {
  name: string;
  email: string;
  phone: string;
}

export interface ClinicInput {
  name: string;
  city: string;
  email?: string;
  phone?: string;
  address?: string;
  logoName?: string;
  adminName?: string;
  adminEmail?: string;
  adminPhone?: string;
}

type Command =
  | { type: "snapshot.loaded"; value: WorkspaceSnapshot }
  | { type: "clinic.created"; value: Clinic; actor: AuthUser }
  | { type: "doctor.created"; value: Doctor; actor: AuthUser }
  | { type: "receptionist.created"; value: Receptionist; actor: AuthUser }
  | { type: "patient.created"; value: Patient; actor: AuthUser }
  | { type: "appointment.created"; value: Appointment; actor: AuthUser }
  | { type: "appointment.updated"; value: Appointment; actor: AuthUser }
  | { type: "prescription.saved"; value: Prescription; actor: AuthUser }
  | { type: "labs.saved"; values: LabReport[]; actor: AuthUser }
  | { type: "bill.created"; value: Bill; actor: AuthUser }
  | { type: "bill.updated"; value: Bill; actor: AuthUser }
  | { type: "staff.invited"; value: StaffMember; actor: AuthUser }
  | { type: "staff.deactivated"; userId: string; actor: AuthUser };

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
    staffMembers: [
      ...seedDoctors.map(doctor => ({
        id: doctor.id,
        clinicId: DEFAULT_CLINIC_ID,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        role: "doctor" as const,
        status: doctor.status as StaffMember["status"],
      })),
      ...seedReceptionists.map(receptionist => ({
        id: receptionist.id,
        clinicId: DEFAULT_CLINIC_ID,
        name: receptionist.name,
        email: receptionist.email,
        phone: receptionist.phone,
        role: "receptionist" as const,
        status: receptionist.status as StaffMember["status"],
      })),
    ],
  };
}

function emptySnapshot(): WorkspaceSnapshot {
  return {
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
    case "snapshot.loaded":
      return command.value;
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
    case "staff.invited":
      return appendAudit(
        { ...state, staffMembers: [command.value, ...state.staffMembers] },
        command.actor,
        `Invited ${command.value.role} ${command.value.email}`,
      );
    case "staff.deactivated":
      return appendAudit(
        {
          ...state,
          staffMembers: state.staffMembers.map((member) =>
            member.id === command.userId ? { ...member, status: "Inactive" } : member
          ),
          doctors: state.doctors.map((doctor) =>
            doctor.id === command.userId ? { ...doctor, status: "Inactive" } : doctor
          ),
          receptionists: state.receptionists.map((receptionist) =>
            receptionist.id === command.userId
              ? { ...receptionist, status: "Inactive" }
              : receptionist
          ),
        },
        command.actor,
        `Deactivated staff member ${command.userId}`,
      );
  }
}

interface WorkspaceData {
  isLoading: boolean;
  error: string | null;
  clinics: Clinic[];
  patients: Patient[];
  doctors: Doctor[];
  receptionists: Receptionist[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labReports: LabReport[];
  bills: Bill[];
  auditLogs: AuditEntry[];
  staffMembers: StaffMember[];
  refresh: () => Promise<void>;
  searchPatients: (input?: PatientSearch) => Promise<PatientPage>;
  getPatient: (id: string) => Promise<Patient | null>;
  listAppointments: (input?: RecordPageInput) => Promise<RecordPage<Appointment>>;
  listPrescriptions: (input?: RecordPageInput) => Promise<RecordPage<Prescription>>;
  listLabReports: (input?: RecordPageInput) => Promise<RecordPage<LabReport>>;
  listBills: (input?: RecordPageInput) => Promise<RecordPage<Bill>>;
  listAuditLogs: (input?: RecordPageInput) => Promise<RecordPage<AuditEntry>>;
  createClinic: (input: ClinicInput) => Promise<Clinic>;
  createDoctor: (input: DoctorInput) => Promise<Doctor>;
  createReceptionist: (input: ReceptionistInput) => Promise<Receptionist>;
  inviteClinicAdmin: (input: ClinicAdminInput) => Promise<StaffMember>;
  deactivateStaff: (userId: string, reason: string) => Promise<void>;
  createPatient: (input: PatientInput) => Promise<Patient>;
  createAppointment: (input: AppointmentInput) => Promise<Appointment>;
  updateAppointment: (appointment: Appointment) => Promise<Appointment>;
  savePrescription: (input: PrescriptionInput) => Promise<Prescription>;
  saveLabReports: (reports: Omit<LabReport, "clinicId">[]) => Promise<LabReport[]>;
  createBill: (input: BillInput) => Promise<Bill>;
  updateBill: (bill: Bill) => Promise<Bill>;
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
  const [state, dispatch] = useReducer(
    reducer,
    supabaseConfig.demoMode,
    (demoMode) => (demoMode ? initialSnapshot() : emptySnapshot()),
  );
  const [isLoading, setIsLoading] = useState(!supabaseConfig.demoMode);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);
  const visibleLoads = useRef(0);
  const repository = useMemo(
    () => (supabaseConfig.demoMode || typeof window === "undefined"
      ? null
      : new SupabaseWorkspaceRepository()),
    [],
  );

  const loadSnapshot = useCallback(async (showLoading: boolean) => {
    if (!repository || !user) return;
    const sequence = ++loadSequence.current;
    if (showLoading) {
      visibleLoads.current += 1;
      setIsLoading(true);
      setError(null);
    }
    try {
      const snapshot = await repository.load();
      if (sequence === loadSequence.current) {
        dispatch({ type: "snapshot.loaded", value: snapshot });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to load hospital data";
      if (showLoading && sequence === loadSequence.current) {
        setError(message);
      }
      throw cause;
    } finally {
      if (showLoading) {
        visibleLoads.current = Math.max(0, visibleLoads.current - 1);
        if (visibleLoads.current === 0) setIsLoading(false);
      }
    }
  }, [repository, user]);

  const refresh = useCallback(() => loadSnapshot(true), [loadSnapshot]);

  useEffect(() => {
    if (!repository) return;
    if (!user) {
      dispatch({ type: "snapshot.loaded", value: emptySnapshot() });
      setIsLoading(false);
      return;
    }
    void refresh().catch(() => undefined);
  }, [refresh, repository, user]);

  useEffect(() => {
    if (!repository || !user?.clinicId) return;

    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshInFlight = false;
    let refreshPending = false;

    const runRefresh = async () => {
      if (refreshInFlight) {
        refreshPending = true;
        return;
      }

      refreshInFlight = true;
      do {
        refreshPending = false;
        await loadSnapshot(false).catch(() => undefined);
      } while (!disposed && refreshPending);
      refreshInFlight = false;
    };

    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!disposed) void runRefresh();
      }, 250);
    };

    const unsubscribe = subscribeToWorkspaceChanges({
      client: getSupabaseBrowserClient(),
      hospitalId: user.clinicId,
      role: user.role,
      userId: user.userId,
      onChange: scheduleRefresh,
    });

    return () => {
      disposed = true;
      clearTimeout(refreshTimer);
      void unsubscribe();
    };
  }, [loadSnapshot, repository, user?.clinicId, user?.role, user?.userId]);

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
      isLoading,
      error,
      refresh,
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
      staffMembers: user && hasPermission(user.role, "people.manage")
        ? clinicScope(state.staffMembers)
        : [],
      searchPatients: async (input = {}) => {
        requireUser(user, "patients.read");
        if (repository) return repository.searchPatients(input);

        const query = input.query?.trim().toLocaleLowerCase().replace(/\s/g, "") ?? "";
        const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
        const offset = Math.max(input.offset ?? 0, 0);
        const matches = query
          ? patients.filter((patient) =>
              [
                patient.id,
                patient.medicalRecordNumber ?? "",
                patient.name,
                patient.phone,
              ].some((value) =>
                value.toLocaleLowerCase().replace(/\s/g, "").includes(query),
              ),
            )
          : patients;
        return {
          rows: matches.slice(offset, offset + limit),
          total: matches.length,
          limit,
          offset,
        };
      },
      getPatient: async (id) => {
        requireUser(user, "patients.read");
        if (repository) return repository.getPatient(id);
        return patients.find((patient) => patient.id === id) ?? null;
      },
      listAppointments: async (input = {}) => {
        requireUser(user, "appointments.read");
        if (repository) return repository.listAppointments(input);
        return localRecordPage(
          appointments.filter((item) => !input.patientId || item.patientId === input.patientId),
          input,
        );
      },
      listPrescriptions: async (input = {}) => {
        if (!user || !hasPermission(user.role, "prescriptions.read")) {
          return localRecordPage([], input);
        }
        if (repository) return repository.listPrescriptions(input);
        return localRecordPage(
          prescriptions.filter((item) => !input.patientId || item.patientId === input.patientId),
          input,
        );
      },
      listLabReports: async (input = {}) => {
        if (!user) return localRecordPage([], input);
        const actor = user;
        if (
          !hasPermission(actor.role, "labs.write")
          && !hasPermission(actor.role, "prescriptions.read")
        ) {
          return localRecordPage([], input);
        }
        if (repository) return repository.listLabReports(input);
        const reports = clinicScope(state.labReports).filter(
          (item) => !input.patientId || item.patientId === input.patientId,
        );
        return localRecordPage(reports, input);
      },
      listBills: async (input = {}) => {
        if (!user || !hasPermission(user.role, "billing.read")) {
          return localRecordPage([], input);
        }
        if (repository) return repository.listBills(input);
        return localRecordPage(
          clinicScope(state.bills).filter(
            (item) => !input.patientId || item.patientId === input.patientId,
          ),
          input,
        );
      },
      listAuditLogs: async (input = {}) => {
        const actor = requireUser(user, "audit.read");
        const scoped = actor.role === "super_admin"
          ? state.auditLogs
          : state.auditLogs.filter((entry) => entry.clinicId === clinicId);
        if (repository) return repository.listAuditLogs(input);
        const query = input.query?.trim().toLocaleLowerCase() ?? "";
        return localRecordPage(
          query
            ? scoped.filter((entry) =>
                `${entry.user} ${entry.action}`.toLocaleLowerCase().includes(query),
              )
            : scoped,
          input,
        );
      },
      createClinic: async (input) => {
        const actor = requireUser(user, "platform.clinics.manage");
        if (repository) {
          throw new Error("This installation is dedicated to one hospital");
        }
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
        if (input.adminName && input.adminEmail) {
          const membership: StaffMember = {
            id: createId("AD"),
            clinicId: clinic.id,
            name: input.adminName,
            email: input.adminEmail,
            phone: input.adminPhone ?? "",
            role: "clinic_admin",
            status: "Invited",
          };
          dispatch({ type: "staff.invited", value: membership, actor });
        }
        return clinic;
      },
      createDoctor: async (input) => {
        const actor = requireUser(user, "people.manage");
        if (repository) {
          const doctor = await repository.createDoctor(input);
          await refresh();
          return doctor;
        }
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
      createReceptionist: async (input) => {
        const actor = requireUser(user, "people.manage");
        if (repository) {
          const receptionist = await repository.createReceptionist(input);
          await refresh();
          return receptionist;
        }
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
      inviteClinicAdmin: async (input) => {
        const actor = requireUser(user, "people.manage");
        if (actor.role !== "super_admin") {
          throw new Error("Only a super admin can invite a clinic admin");
        }
        if (repository) {
          const membership = await repository.inviteClinicAdmin(input);
          await refresh();
          return membership;
        }
        const installationClinicId = actor.clinicId ?? state.clinics[0]?.id;
        if (!installationClinicId) throw new Error("A clinic workspace is required");
        const membership: StaffMember = {
          id: createId("AD"),
          clinicId: installationClinicId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: "clinic_admin",
          status: "Invited",
        };
        dispatch({ type: "staff.invited", value: membership, actor });
        return membership;
      },
      deactivateStaff: async (userId, reason) => {
        const actor = requireUser(user, "people.manage");
        const target = state.staffMembers.find((member) => member.id === userId);
        if (!target) throw new Error("Staff member was not found");
        if (target.id === actor.userId) throw new Error("You cannot deactivate your own account");
        if (
          target.role === "super_admin"
          || (actor.role === "clinic_admin" && target.role === "clinic_admin")
        ) {
          throw new Error("You cannot deactivate this staff role");
        }
        const normalizedReason = reason.trim();
        if (normalizedReason.length < 8 || normalizedReason.length > 500) {
          throw new Error("Enter a reason between 8 and 500 characters");
        }
        if (repository) {
          await repository.deactivateStaff(userId, normalizedReason);
          await refresh();
          return;
        }
        dispatch({ type: "staff.deactivated", userId, actor });
      },
      createPatient: async (input) => {
        const actor = requireUser(user, "patients.create");
        if (repository) {
          const patient = await repository.createPatient(input);
          await refresh();
          return patient;
        }
        const tenantId = requireClinic(actor);
        const doctor = state.doctors.find(
          (item) => item.id === input.doctorId && item.clinicId === tenantId,
        );
        if (!doctor) throw new Error("Assigned doctor must belong to the active clinic");
        const birthDate = new Date(`${input.dateOfBirth}T00:00:00`);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        if (
          today.getMonth() < birthDate.getMonth()
          || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
        ) {
          age -= 1;
        }
        const patient: Patient = {
          name: input.name,
          age,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          phone: input.phone,
          bloodGroup: input.bloodGroup,
          email: input.email,
          whatsappPhone: input.whatsappPhone,
          address: input.address,
          emergencyContactName: input.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone,
          allergies: input.allergies,
          chronicConditions: input.chronicConditions,
          doctor: doctor.name,
          id: createId("PT"),
          clinicId: tenantId,
          lastVisit: new Date().toISOString().slice(0, 10),
          status: "New",
        };
        dispatch({ type: "patient.created", value: patient, actor });
        return patient;
      },
      createAppointment: async (input) => {
        const actor = requireUser(user, "appointments.create");
        if (repository) {
          const appointment = await repository.createAppointment(input);
          await refresh();
          return appointment;
        }
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
          doctorId: doctor.id,
          date: input.date,
          time: input.time,
          durationMinutes: input.durationMinutes ?? 30,
          type: input.type,
          status: "Pending",
          notes: input.notes,
        };
        dispatch({ type: "appointment.created", value: appointment, actor });
        return appointment;
      },
      updateAppointment: async (appointment) => {
        const actor = requireUser(user, "appointments.update");
        if (repository) {
          const updated = await repository.updateAppointment(appointment);
          await refresh();
          return updated;
        }
        if (appointment.clinicId !== requireClinic(actor)) throw new Error("Cross-clinic updates are not allowed");
        dispatch({ type: "appointment.updated", value: appointment, actor });
        return appointment;
      },
      savePrescription: async (input) => {
        const actor = requireUser(user, "prescriptions.write");
        if (repository) {
          const prescription = await repository.savePrescription(input);
          await refresh();
          return prescription;
        }
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
      saveLabReports: async (reports) => {
        const actor = requireUser(user, "labs.write");
        if (repository) {
          const saved = await repository.saveLabReports(reports);
          await refresh();
          return saved;
        }
        const tenantId = requireClinic(actor);
        if (reports.some(report => !state.patients.some(patient => patient.id === report.patientId && patient.clinicId === tenantId))) {
          throw new Error("Lab reports must belong to a patient in the active clinic");
        }
        const values = reports.map(report => ({ ...report, clinicId: tenantId }));
        dispatch({ type: "labs.saved", values, actor });
        return values;
      },
      createBill: async (input) => {
        const actor = requireUser(user, "billing.write");
        if (repository) {
          const bill = await repository.createBill(input);
          await refresh();
          return bill;
        }
        const tenantId = requireClinic(actor);
        const patient = state.patients.find(item => item.id === input.patientId && item.clinicId === tenantId);
        if (!patient) throw new Error("Patient must belong to the active clinic");
        const taxAmount = Math.round(Math.max(0, input.subtotal - input.discount) * input.taxRate) / 100;
        const bill: Bill = {
          id: createId("INV"),
          clinicId: tenantId,
          patientId: patient.id,
          patient: patient.name,
          date: new Date().toISOString().slice(0, 10),
          amount: input.subtotal + taxAmount - input.discount,
          subtotal: input.subtotal,
          discount: input.discount,
          tax: taxAmount,
          items: input.items,
          status: "Pending",
          method: input.method ?? "—",
        };
        dispatch({ type: "bill.created", value: bill, actor });
        return bill;
      },
      updateBill: async (bill) => {
        const actor = requireUser(user, "billing.write");
        if (repository) {
          const updated = await repository.updateBill(bill);
          await refresh();
          return updated;
        }
        if (bill.clinicId !== requireClinic(actor)) throw new Error("Cross-clinic updates are not allowed");
        dispatch({ type: "bill.updated", value: bill, actor });
        return bill;
      },
    };
  }, [error, isLoading, refresh, repository, state, user]);

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspaceData() {
  const value = useContext(WorkspaceCtx);
  if (!value) throw new Error("useWorkspaceData must be used inside WorkspaceDataProvider");
  return value;
}
