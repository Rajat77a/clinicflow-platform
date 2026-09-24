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
import { sendInvitationEmail, registerLocalInviteToken, getAppBaseUrl } from "./email-service";
import {
  deactivateClinicAccounts,
  reactivateClinicAccounts,
  deleteClinicAccounts,
  deactivateUserAccount,
  reactivateUserAccount,
  deleteUserAccount,
} from "./account-store";

const DEFAULT_CLINIC_ID = "CL-001";

export type Clinic = {
  id: string;
  name: string;
  city: string;
  doctors: number;
  receptionists: number;
  patients: number;
  plan: string;
  status: string;
  expires: string;
  price: number;
  access: "Allowed" | "Suspended";
  deletedAt?: string;
  deletedBy?: string;
  setupUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  logoName?: string;
  adminName?: string;
  adminEmail?: string;
  adminPhone?: string;
  emailSent?: boolean;
  emailId?: string;
  emailError?: string;
};
export type Patient = {
  id: string;
  clinicId: string;
  name: string;
  age: number;
  dateOfBirth: string;
  gender: string;
  phone: string;
  bloodGroup?: string;
  email?: string;
  whatsappPhone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string[];
  chronicConditions?: string[];
  doctor: string;
  lastVisit: string;
  status: string;
  version?: number;
  medicalRecordNumber?: string;
};
export type Doctor = {
  id: string;
  clinicId: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  gender: string | undefined;
  qualification: string | undefined;
  medicalRegistrationNumber: string | undefined;
  experienceYears: number | undefined;
  consultationFee: number | undefined;
  workingHours: string | undefined;
  notes: string | undefined;
  avatarPath: string | undefined;
  avatarUrl: string | undefined;
  photoWarning: string | undefined;
  patients: number;
  status: string;
};
export type Receptionist = {
  id: string;
  clinicId: string;
  name: string;
  email: string;
  phone: string;
  shift: string;
  status: string;
};
export type Facility = {
  id: string;
  clinicId: string;
  code: string;
  name: string;
  timezone: string | undefined;
  phone: string | undefined;
  email: string | undefined;
  address: string | undefined;
  active: boolean;
};
export type Appointment = {
  id: string;
  clinicId: string;
  patientId: string;
  patient: string;
  doctor: string;
  doctorId: string;
  date: string;
  time: string;
  durationMinutes: number;
  type: string;
  status: string;
  notes: string | undefined;
  version?: number;
};
export type Prescription = {
  id: string;
  clinicId: string;
  patientId: string;
  patient: string;
  doctor: string;
  date: string;
  diagnosis: string;
  notes: string | undefined;
  followUp: string | undefined;
  medicines: { name: string; dosage: string; frequency: string; duration: string; unitPrice?: number }[];
};
export type LabReport = {
  id: string;
  clinicId: string;
  patientId: string;
  patient: string;
  test: string;
  date: string;
  result: string;
  reference: string;
  notes?: string;
  prescriptionId?: string;
  fileName?: string;
  uploadedBy: string;
};
export type Bill = {
  id: string;
  clinicId: string;
  patientId: string;
  patient: string;
  date: string;
  amount: number;
  subtotal: number;
  discount: number;
  tax: number;
  items: BillLineInput[];
  status: string;
  method: string;
  databaseId?: string;
  version?: number;
};
export type AuditEntry = {
  id: string;
  clinicId: string | null;
  user: string;
  action: string;
  date: string;
  time: string;
};
export type StaffMember = {
  id: string;
  clinicId: string | null;
  name: string;
  email: string;
  phone: string;
  role: AuthUser["role"];
  status: "Active" | "Invited" | "Inactive";
  tempPassword?: string;
  deletedAt?: string;
  deletedBy?: string;
  previousClinicId?: string | null;
  previousClinicName?: string | null;
  emailSent?: boolean;
  emailId?: string;
  emailError?: string;
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
  facilities: Facility[];
  permanentlyDeletedIds?: Set<string>;
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
  medicines: { name: string; dosage: string; frequency: string; duration: string; unitPrice?: number }[];
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
  hospitalId?: string;
}

export interface ReceptionistInput {
  name: string;
  email: string;
  phone: string;
  shift: string;
  hospitalId?: string;
}

export interface ClinicAdminInput {
  name: string;
  email: string;
  phone: string;
  hospitalId?: string;
  tempPassword?: string;
}

export interface SuperAdminInput {
  name: string;
  email: string;
  phone: string;
  tempPassword: string;
}

export interface ClinicInput {
  id?: string;
  name: string;
  city: string;
  email?: string;
  phone?: string;
  address?: string;
  logoName?: string;
  logo?: File | null;
  adminName?: string;
  adminEmail?: string;
  adminPhone?: string;
  tempPassword?: string;
}
export interface FacilityInput {
  code: string;
  name: string;
  timezone?: string;
  phone?: string;
  email?: string;
  address?: string;
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
  | { type: "staff.deactivated"; userId: string; actor: AuthUser }
  | { type: "facility.created"; value: Facility; actor: AuthUser }
  | { type: "clinic.soft_deleted"; id: string; actor: AuthUser }
  | { type: "clinic.restored"; id: string; actor: AuthUser }
  | { type: "clinic.permanently_deleted"; id: string; actor: AuthUser }
  | { type: "clinic.updated"; value: ClinicInput; actor: AuthUser }
  | { type: "clinic.bulk_soft_deleted"; ids: string[]; actor: AuthUser }
  | { type: "clinic.bulk_restored"; ids: string[]; actor: AuthUser }
  | { type: "clinic.bulk_permanently_deleted"; ids: string[]; actor: AuthUser }
  | { type: "staff.soft_deleted"; userId: string; actor: AuthUser }
  | { type: "staff.restored"; userId: string; actor: AuthUser }
  | { type: "staff.permanently_deleted"; userId: string; actor: AuthUser }
  | { type: "staff.invitation_resent"; userId: string; actor: AuthUser }
  | { type: "staff.bulk_soft_deleted"; userIds: string[]; actor: AuthUser }
  | { type: "staff.bulk_restored"; userIds: string[]; actor: AuthUser }
  | { type: "staff.bulk_permanently_deleted"; userIds: string[]; actor: AuthUser };

function createId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8).toUpperCase()
    ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  return `${prefix}-${suffix}`;
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
    facilities: [],
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
    case "snapshot.loaded": {
      const softDeletedMap = new Map<string, string>();
      (state.clinics || []).forEach((c) => {
        if (c.deletedAt) {
          softDeletedMap.set(c.id, c.deletedAt);
        }
      });
      const permDeleted = state.permanentlyDeletedIds || new Set<string>();

      const updatedClinics = command.value.clinics
        .filter((c) => !permDeleted.has(c.id))
        .map((c) => {
          const localDeletedAt = softDeletedMap.get(c.id);
          if (localDeletedAt && !c.deletedAt) {
            return { ...c, access: "Suspended" as const, deletedAt: localDeletedAt };
          }
          return c;
        });

      return {
        ...command.value,
        clinics: updatedClinics,
        permanentlyDeletedIds: permDeleted,
      };
    }
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
          patients: command.value.status === "Completed"
            ? state.patients.map((patient) => patient.id === command.value.patientId
              ? { ...patient, lastVisit: command.value.date, status: "Active" }
              : patient)
            : state.patients,
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
    case "facility.created":
      return appendAudit(
        { ...state, facilities: [command.value, ...state.facilities] },
        command.actor,
        `Created facility ${command.value.id}`,
      );
    case "clinic.soft_deleted": {
      deactivateClinicAccounts(command.id);
      const now = new Date().toISOString();
      const clinicObj = state.clinics.find((c) => c.id === command.id);
      return appendAudit(
        {
          ...state,
          clinics: state.clinics.map((c) =>
            c.id === command.id
              ? { ...c, access: "Suspended", deletedAt: now, deletedBy: command.actor.name }
              : c
          ),
          staffMembers: state.staffMembers.map((m) =>
            m.clinicId === command.id
              ? {
                  ...m,
                  status: "Inactive",
                  deletedAt: now,
                  deletedBy: command.actor.name,
                  previousClinicId: m.clinicId,
                  previousClinicName: clinicObj?.name || "Clinic",
                }
              : m
          ),
          doctors: state.doctors.map((d) =>
            d.clinicId === command.id ? { ...d, status: "Inactive" } : d
          ),
          receptionists: state.receptionists.map((r) =>
            r.clinicId === command.id ? { ...r, status: "Inactive" } : r
          ),
        },
        command.actor,
        `Soft deleted clinic ${command.id} and deactivated all associated users`,
      );
    }
    case "clinic.restored": {
      reactivateClinicAccounts(command.id);
      return appendAudit(
        {
          ...state,
          clinics: state.clinics.map((c) =>
            c.id === command.id
              ? { ...c, access: "Allowed", deletedAt: undefined, deletedBy: undefined }
              : c
          ),
          staffMembers: state.staffMembers.map((m) =>
            m.clinicId === command.id || m.previousClinicId === command.id
              ? {
                  ...m,
                  status: m.tempPassword ? "Invited" : "Active",
                  deletedAt: undefined,
                  deletedBy: undefined,
                }
              : m
          ),
          doctors: state.doctors.map((d) =>
            d.clinicId === command.id ? { ...d, status: "Active" } : d
          ),
          receptionists: state.receptionists.map((r) =>
            r.clinicId === command.id ? { ...r, status: "Active" } : r
          ),
        },
        command.actor,
        `Restored clinic ${command.id} and reactivated associated users`,
      );
    }
    case "clinic.permanently_deleted": {
      deleteClinicAccounts(command.id);
      const nextPerm = new Set(state.permanentlyDeletedIds || []);
      nextPerm.add(command.id);
      return appendAudit(
        {
          ...state,
          clinics: state.clinics.filter((c) => c.id !== command.id),
          staffMembers: state.staffMembers.filter(
            (m) => m.clinicId !== command.id && m.previousClinicId !== command.id,
          ),
          doctors: state.doctors.filter((d) => d.clinicId !== command.id),
          receptionists: state.receptionists.filter((r) => r.clinicId !== command.id),
          patients: state.patients.filter((p) => p.clinicId !== command.id),
          appointments: state.appointments.filter((a) => a.clinicId !== command.id),
          prescriptions: state.prescriptions.filter((pr) => pr.clinicId !== command.id),
          labReports: state.labReports.filter((lr) => lr.clinicId !== command.id),
          bills: state.bills.filter((b) => b.clinicId !== command.id),
          facilities: state.facilities.filter((f) => f.clinicId !== command.id),
          permanentlyDeletedIds: nextPerm,
        },
        command.actor,
        `Permanently deleted clinic ${command.id} and removed all associated users`,
      );
    }
    case "clinic.updated": {
      const updated = command.value;
      return appendAudit(
        {
          ...state,
          clinics: state.clinics.map((c) =>
            c.id === updated.id
              ? {
                  ...c,
                  name: updated.name,
                  city: updated.city,
                  email: updated.email ?? c.email,
                  phone: updated.phone ?? c.phone,
                  address: updated.address ?? c.address,
                  logoName: updated.logoName ?? c.logoName,
                  adminName: updated.adminName ?? c.adminName,
                  adminEmail: updated.adminEmail ?? c.adminEmail,
                  adminPhone: updated.adminPhone ?? c.adminPhone,
                }
              : c
          ),
          staffMembers: state.staffMembers.map((m) =>
            m.clinicId === updated.id && m.role === "clinic_admin"
              ? {
                  ...m,
                  name: updated.adminName || m.name,
                  email: updated.adminEmail || m.email,
                  phone: updated.adminPhone || m.phone,
                }
              : m
          ),
        },
        command.actor,
        `Updated clinic ${updated.id}`,
      );
    }
    case "clinic.bulk_soft_deleted": {
      const idSet = new Set(command.ids);
      command.ids.forEach((id) => deactivateClinicAccounts(id));
      const now = new Date().toISOString();
      const clinicMap = new Map(state.clinics.map((c) => [c.id, c.name]));
      return appendAudit(
        {
          ...state,
          clinics: state.clinics.map((c) =>
            idSet.has(c.id)
              ? { ...c, access: "Suspended", deletedAt: now, deletedBy: command.actor.name }
              : c
          ),
          staffMembers: state.staffMembers.map((m) =>
            m.clinicId && idSet.has(m.clinicId)
              ? {
                  ...m,
                  status: "Inactive",
                  deletedAt: now,
                  deletedBy: command.actor.name,
                  previousClinicId: m.clinicId,
                  previousClinicName: clinicMap.get(m.clinicId) || "Clinic",
                }
              : m
          ),
          doctors: state.doctors.map((d) =>
            idSet.has(d.clinicId) ? { ...d, status: "Inactive" } : d
          ),
          receptionists: state.receptionists.map((r) =>
            idSet.has(r.clinicId) ? { ...r, status: "Inactive" } : r
          ),
        },
        command.actor,
        `Soft deleted ${command.ids.length} clinics and deactivated associated users`,
      );
    }
    case "clinic.bulk_restored": {
      const idSet = new Set(command.ids);
      command.ids.forEach((id) => reactivateClinicAccounts(id));
      return appendAudit(
        {
          ...state,
          clinics: state.clinics.map((c) =>
            idSet.has(c.id)
              ? { ...c, access: "Allowed", deletedAt: undefined, deletedBy: undefined }
              : c
          ),
          staffMembers: state.staffMembers.map((m) =>
            (m.clinicId && idSet.has(m.clinicId)) || (m.previousClinicId && idSet.has(m.previousClinicId))
              ? {
                  ...m,
                  status: m.tempPassword ? "Invited" : "Active",
                  deletedAt: undefined,
                  deletedBy: undefined,
                }
              : m
          ),
          doctors: state.doctors.map((d) =>
            idSet.has(d.clinicId) ? { ...d, status: "Active" } : d
          ),
          receptionists: state.receptionists.map((r) =>
            idSet.has(r.clinicId) ? { ...r, status: "Active" } : r
          ),
        },
        command.actor,
        `Restored ${command.ids.length} clinics and reactivated associated users`,
      );
    }
    case "clinic.bulk_permanently_deleted": {
      const idSet = new Set(command.ids);
      command.ids.forEach((id) => deleteClinicAccounts(id));
      const nextPerm = new Set(state.permanentlyDeletedIds || []);
      command.ids.forEach((id) => nextPerm.add(id));
      return appendAudit(
        {
          ...state,
          clinics: state.clinics.filter((c) => !idSet.has(c.id)),
          staffMembers: state.staffMembers.filter(
            (m) => (!m.clinicId || !idSet.has(m.clinicId)) && (!m.previousClinicId || !idSet.has(m.previousClinicId)),
          ),
          doctors: state.doctors.filter((d) => !idSet.has(d.clinicId)),
          receptionists: state.receptionists.filter((r) => !idSet.has(r.clinicId)),
          patients: state.patients.filter((p) => !idSet.has(p.clinicId)),
          appointments: state.appointments.filter((a) => !idSet.has(a.clinicId)),
          prescriptions: state.prescriptions.filter((pr) => !idSet.has(pr.clinicId)),
          labReports: state.labReports.filter((lr) => !idSet.has(lr.clinicId)),
          bills: state.bills.filter((b) => !idSet.has(b.clinicId)),
          facilities: state.facilities.filter((f) => !idSet.has(f.clinicId)),
          permanentlyDeletedIds: nextPerm,
        },
        command.actor,
        `Permanently deleted ${command.ids.length} clinics and removed all associated users`,
      );
    }
    case "staff.soft_deleted": {
      const member = state.staffMembers.find((m) => m.id === command.userId);
      if (member?.email) deactivateUserAccount(member.email);
      const now = new Date().toISOString();
      const clinic = member?.clinicId ? state.clinics.find((c) => c.id === member.clinicId) : null;
      return appendAudit(
        {
          ...state,
          staffMembers: state.staffMembers.map((m) =>
            m.id === command.userId
              ? {
                  ...m,
                  status: "Inactive",
                  deletedAt: now,
                  deletedBy: command.actor.name,
                  previousClinicId: m.clinicId,
                  previousClinicName: clinic?.name || m.previousClinicName || null,
                }
              : m
          ),
          doctors: state.doctors.map((d) =>
            d.id === command.userId ? { ...d, status: "Inactive" } : d
          ),
          receptionists: state.receptionists.map((r) =>
            r.id === command.userId ? { ...r, status: "Inactive" } : r
          ),
        },
        command.actor,
        `Soft deleted staff user ${command.userId}`,
      );
    }
    case "staff.restored": {
      const member = state.staffMembers.find((m) => m.id === command.userId);
      if (member?.email) reactivateUserAccount(member.email);
      return appendAudit(
        {
          ...state,
          staffMembers: state.staffMembers.map((m) =>
            m.id === command.userId
              ? {
                  ...m,
                  status: m.tempPassword ? "Invited" : "Active",
                  deletedAt: undefined,
                  deletedBy: undefined,
                }
              : m
          ),
          doctors: state.doctors.map((d) =>
            d.id === command.userId ? { ...d, status: "Active" } : d
          ),
          receptionists: state.receptionists.map((r) =>
            r.id === command.userId ? { ...r, status: "Active" } : r
          ),
        },
        command.actor,
        `Restored staff user ${command.userId}`,
      );
    }
    case "staff.permanently_deleted": {
      const member = state.staffMembers.find((m) => m.id === command.userId);
      if (member?.email) deleteUserAccount(member.email);
      return appendAudit(
        {
          ...state,
          staffMembers: state.staffMembers.filter((m) => m.id !== command.userId),
          doctors: state.doctors.filter((d) => d.id !== command.userId),
          receptionists: state.receptionists.filter((r) => r.id !== command.userId),
        },
        command.actor,
        `Permanently deleted staff user ${command.userId}`,
      );
    }
    case "staff.invitation_resent": {
      return appendAudit(
        {
          ...state,
          staffMembers: state.staffMembers.map((m) =>
            m.id === command.userId ? { ...m, status: "Invited" } : m
          ),
        },
        command.actor,
        `Resent invitation to staff user ${command.userId}`,
      );
    }
    case "staff.bulk_soft_deleted": {
      const idSet = new Set(command.userIds);
      const now = new Date().toISOString();
      const clinicMap = new Map(state.clinics.map((c) => [c.id, c.name]));
      state.staffMembers.forEach((m) => {
        if (idSet.has(m.id) && m.email) deactivateUserAccount(m.email);
      });
      return appendAudit(
        {
          ...state,
          staffMembers: state.staffMembers.map((m) =>
            idSet.has(m.id)
              ? {
                  ...m,
                  status: "Inactive",
                  deletedAt: now,
                  deletedBy: command.actor.name,
                  previousClinicId: m.clinicId,
                  previousClinicName: m.clinicId ? (clinicMap.get(m.clinicId) || m.previousClinicName || null) : m.previousClinicName || null,
                }
              : m
          ),
          doctors: state.doctors.map((d) =>
            idSet.has(d.id) ? { ...d, status: "Inactive" } : d
          ),
          receptionists: state.receptionists.map((r) =>
            idSet.has(r.id) ? { ...r, status: "Inactive" } : r
          ),
        },
        command.actor,
        `Soft deleted ${command.userIds.length} staff members`,
      );
    }
    case "staff.bulk_restored": {
      const idSet = new Set(command.userIds);
      state.staffMembers.forEach((m) => {
        if (idSet.has(m.id) && m.email) reactivateUserAccount(m.email);
      });
      return appendAudit(
        {
          ...state,
          staffMembers: state.staffMembers.map((m) =>
            idSet.has(m.id)
              ? {
                  ...m,
                  status: m.tempPassword ? "Invited" : "Active",
                  deletedAt: undefined,
                  deletedBy: undefined,
                }
              : m
          ),
          doctors: state.doctors.map((d) =>
            idSet.has(d.id) ? { ...d, status: "Active" } : d
          ),
          receptionists: state.receptionists.map((r) =>
            idSet.has(r.id) ? { ...r, status: "Active" } : r
          ),
        },
        command.actor,
        `Restored ${command.userIds.length} staff members`,
      );
    }
    case "staff.bulk_permanently_deleted": {
      const idSet = new Set(command.userIds);
      state.staffMembers.forEach((m) => {
        if (idSet.has(m.id) && m.email) deleteUserAccount(m.email);
      });
      return appendAudit(
        {
          ...state,
          staffMembers: state.staffMembers.filter((m) => !idSet.has(m.id)),
          doctors: state.doctors.filter((d) => !idSet.has(d.id)),
          receptionists: state.receptionists.filter((r) => !idSet.has(r.id)),
        },
        command.actor,
        `Permanently deleted ${command.userIds.length} staff members`,
      );
    }
  }
}

interface WorkspaceData {
  isLoading: boolean;
  error: string | null;
  syncStatus: "connecting" | "live" | "offline" | "error";
  clinics: Clinic[];
  binClinics: Clinic[];
  patients: Patient[];
  doctors: Doctor[];
  receptionists: Receptionist[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labReports: LabReport[];
  bills: Bill[];
  auditLogs: AuditEntry[];
  staffMembers: StaffMember[];
  binStaffMembers: StaffMember[];
  facilities: Facility[];
  refresh: () => Promise<void>;
  searchPatients: (input?: PatientSearch) => Promise<PatientPage>;
  getPatient: (id: string) => Promise<Patient | null>;
  listAppointments: (input?: RecordPageInput) => Promise<RecordPage<Appointment>>;
  listPrescriptions: (input?: RecordPageInput) => Promise<RecordPage<Prescription>>;
  listLabReports: (input?: RecordPageInput) => Promise<RecordPage<LabReport>>;
  listBills: (input?: RecordPageInput) => Promise<RecordPage<Bill>>;
  listAuditLogs: (input?: RecordPageInput) => Promise<RecordPage<AuditEntry>>;
  createClinic: (input: ClinicInput) => Promise<Clinic>;
  updateClinic: (input: ClinicInput) => Promise<void>;
  deleteClinic: (id: string) => Promise<void>;
  softDeleteClinic: (id: string) => Promise<void>;
  bulkSoftDeleteClinics: (ids: string[]) => Promise<void>;
  restoreClinic: (id: string) => Promise<void>;
  bulkRestoreClinics: (ids: string[]) => Promise<void>;
  permanentlyDeleteClinic: (id: string) => Promise<void>;
  bulkPermanentlyDeleteClinics: (ids: string[]) => Promise<void>;
  emptyTrash: () => Promise<void>;
  setClinicAccess: (id: string, active: boolean) => Promise<void>;
  extendSubscription: (id: string, days: number, proofRef?: string) => Promise<void>;
  createDoctor: (input: DoctorInput) => Promise<Doctor>;
  createReceptionist: (input: ReceptionistInput) => Promise<Receptionist>;
  inviteSuperAdmin: (input: SuperAdminInput) => Promise<StaffMember>;
  inviteClinicAdmin: (input: ClinicAdminInput) => Promise<StaffMember>;
  deactivateStaff: (userId: string, reason: string) => Promise<void>;
  softDeleteStaff: (userId: string) => Promise<void>;
  bulkSoftDeleteStaff: (userIds: string[]) => Promise<void>;
  restoreStaff: (userId: string) => Promise<void>;
  bulkRestoreStaff: (userIds: string[]) => Promise<void>;
  permanentlyDeleteStaff: (userId: string) => Promise<void>;
  bulkPermanentlyDeleteStaff: (userIds: string[]) => Promise<void>;
  resendStaffInvitation: (userId: string) => Promise<void>;
  createPatient: (input: PatientInput) => Promise<Patient>;
  createAppointment: (input: AppointmentInput) => Promise<Appointment>;
  updateAppointment: (appointment: Appointment) => Promise<Appointment>;
  savePrescription: (input: PrescriptionInput) => Promise<Prescription>;
  saveLabReports: (reports: Omit<LabReport, "clinicId">[]) => Promise<LabReport[]>;
  createBill: (input: BillInput) => Promise<Bill>;
  updateBill: (bill: Bill) => Promise<Bill>;
  createFacility: (input: FacilityInput) => Promise<Facility>;
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

function isWithinRetentionPeriod(deletedAt?: string, retentionDays = 30): boolean {
  if (!deletedAt) return false;
  const daysOld = (Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysOld < retentionDays;
}

export function WorkspaceDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(
    reducer,
    false,
    () => emptySnapshot(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<WorkspaceData["syncStatus"]>(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
    return "connecting";
  });
  const loadSequence = useRef(0);
  const visibleLoads = useRef(0);
  const repository = useMemo(() => {
    if (typeof window === "undefined" || !supabaseConfig.configured) {
      return null;
    }
    try {
      return new SupabaseWorkspaceRepository();
    } catch {
      return null;
    }
  }, []);

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
    if (!repository) {
      setIsLoading(false);
      return;
    }
    if (!user) {
      dispatch({ type: "snapshot.loaded", value: emptySnapshot() });
      setIsLoading(false);
      return;
    }
    void refresh().catch(() => undefined);
  }, [refresh, repository, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOffline = () => setSyncStatus("offline");
    const handleOnline = () => {
      setSyncStatus("connecting");
      void refresh().catch(() => setSyncStatus("error"));
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [refresh]);

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
      onStatus: (status) => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setSyncStatus("offline");
        } else {
          setSyncStatus(status);
        }
      },
    });

    return () => {
      disposed = true;
      clearTimeout(refreshTimer);
      void unsubscribe();
    };
  }, [loadSnapshot, repository, user?.clinicId, user?.role, user?.userId]);

  const value = useMemo<WorkspaceData>(() => {
    const clinicId = user?.clinicId;
    const isSuperAdmin = user?.role === "super_admin";
    const clinicScope = <T extends { clinicId: string | null }>(items: T[]) =>
      isSuperAdmin ? items : (clinicId ? items.filter(item => item.clinicId === clinicId) : items);
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
      syncStatus,
      refresh,
      clinics: state.clinics.filter((c) => !c.deletedAt),
      binClinics: state.clinics.filter((c) => isWithinRetentionPeriod(c.deletedAt)),
      patients,
      doctors: clinicScope(state.doctors).filter((d) => d.status !== "Inactive"),
      receptionists: clinicScope(state.receptionists).filter((r) => r.status !== "Inactive"),
      appointments,
      prescriptions,
      labReports: user && (hasPermission(user.role, "labs.write") || hasPermission(user.role, "prescriptions.read"))
        ? clinicScope(state.labReports).filter(report =>
            user.role !== "doctor" || patients.some(patient => patient.id === report.patientId)
          )
        : [],
      bills: user && hasPermission(user.role, "billing.read") ? clinicScope(state.bills) : [],
      auditLogs: isSuperAdmin
        ? state.auditLogs
        : state.auditLogs.filter(entry => entry.clinicId === clinicId),
      staffMembers: user && hasPermission(user.role, "people.manage")
        ? clinicScope(state.staffMembers).filter((m) => !m.deletedAt && m.status !== "Inactive")
        : [],
      binStaffMembers: user && hasPermission(user.role, "people.manage")
        ? (isSuperAdmin ? state.staffMembers : clinicScope(state.staffMembers)).filter((m) => Boolean(m.deletedAt) || m.status === "Inactive")
        : [],
      facilities: user && hasPermission(user.role, "facilities.manage")
        ? clinicScope(state.facilities)
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
        const origin = getAppBaseUrl();
        if (repository) {
          const { id, setupUrl, emailSent, emailId, emailError } = await repository.createClinic(input);
          await refresh().catch(() => undefined);
          const finalSetupUrl = setupUrl || (supabaseConfig.configured && !supabaseConfig.demoMode ? "" : `${origin}/setup?token=TOK-${id}`);
          const saved = state.clinics.find((clinic) => clinic.id === id);
          if (saved) return {
            ...saved,
            setupUrl: finalSetupUrl,
            email: input.email || saved.email,
            phone: input.phone || saved.phone,
            address: input.address || saved.address,
            logoName: input.logoName || saved.logoName,
            adminName: input.adminName || saved.adminName,
            adminEmail: input.adminEmail || saved.adminEmail,
            adminPhone: input.adminPhone || saved.adminPhone,
            emailSent,
            emailId,
            emailError,
          };
          const expires = new Date();
          expires.setDate(expires.getDate() + 14);
          return {
            id,
            name: input.name,
            city: input.city,
            doctors: 0,
            receptionists: 0,
            patients: 0,
            plan: "ClinicFlow",
            status: "Active",
            expires: expires.toISOString().slice(0, 10),
            price: 499,
            access: "Allowed",
            setupUrl: finalSetupUrl,
            email: input.email,
            phone: input.phone,
            address: input.address,
            logoName: input.logoName,
            adminName: input.adminName,
            adminEmail: input.adminEmail,
            adminPhone: input.adminPhone,
            emailSent,
            emailId,
            emailError,
          };
        }
        const expires = new Date();
        expires.setDate(expires.getDate() + 14);
        const dummyToken = createId("TOK");
        const setupUrl = `${origin}/setup?token=${dummyToken}`;

        let emailSent = false;
        let emailId: string | undefined;
        let emailError: string | undefined;

        if (input.adminName && input.adminEmail) {
          registerLocalInviteToken({
            token: dummyToken,
            email: input.adminEmail,
            name: input.adminName,
            phone: input.adminPhone,
            clinicName: input.name,
            clinicId: "",
            clinicAddress: input.address,
            clinicCity: input.city,
            clinicPhone: input.adminPhone || input.phone,
            clinicEmail: input.email,
            roleCode: "clinic_admin",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });

          try {
            const sendResult = await sendInvitationEmail({
              recipientEmail: input.adminEmail,
              recipientName: input.adminName,
              clinicName: input.name,
              clinicId: "",
              clinicAddress: input.address,
              clinicCity: input.city,
              clinicPhone: input.adminPhone || input.phone,
              clinicEmail: input.email,
              setupUrl,
              roleTitle: "Clinical Admin",
              expiresInHours: 24,
            });
            emailSent = sendResult.success;
            emailId = sendResult.emailId;
          } catch (err) {
            emailError = err instanceof Error ? err.message : "Failed to deliver email";
            console.error("[Clinic Creation] Failed to send invitation email:", emailError);
          }
        }

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
          price: 499,
          access: "Allowed",
          setupUrl,
          email: input.email,
          phone: input.phone,
          address: input.address,
          logoName: input.logoName,
          adminName: input.adminName,
          adminEmail: input.adminEmail,
          adminPhone: input.adminPhone,
          emailSent,
          emailId,
          emailError,
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
            tempPassword: input.tempPassword,
            emailSent,
            emailId,
            emailError,
          };
          dispatch({ type: "staff.invited", value: membership, actor });
        }
        return clinic;
      },
      updateClinic: async (input) => {
        const actor = requireUser(user, "platform.clinics.manage");
        if (!input.id) throw new Error("Clinic ID is required");
        dispatch({ type: "clinic.updated", value: input, actor });
        if (repository) {
          await repository.updateClinic(input);
          await refresh().catch(() => undefined);
        }
      },
      deleteClinic: async (id) => {
        const actor = requireUser(user, "platform.clinics.manage");
        dispatch({ type: "clinic.soft_deleted", id, actor });
        if (repository) {
          await repository.deleteClinic(id);
          await refresh().catch(() => undefined);
        }
      },
      softDeleteClinic: async (id) => {
        const actor = requireUser(user, "platform.clinics.manage");
        dispatch({ type: "clinic.soft_deleted", id, actor });
        if (repository) {
          await repository.softDeleteClinic(id);
          await refresh().catch(() => undefined);
        }
      },
      bulkSoftDeleteClinics: async (ids) => {
        const actor = requireUser(user, "platform.clinics.manage");
        if (!ids.length) return;
        dispatch({ type: "clinic.bulk_soft_deleted", ids, actor });
        if (repository) {
          if (repository.bulkSoftDeleteClinics) {
            await repository.bulkSoftDeleteClinics(ids);
          } else {
            await Promise.all(ids.map((id) => repository.softDeleteClinic(id)));
          }
          await refresh().catch(() => undefined);
        }
      },
      restoreClinic: async (id) => {
        const actor = requireUser(user, "platform.clinics.manage");
        dispatch({ type: "clinic.restored", id, actor });
        if (repository) {
          await repository.restoreClinic(id);
          await refresh().catch(() => undefined);
        }
      },
      bulkRestoreClinics: async (ids) => {
        const actor = requireUser(user, "platform.clinics.manage");
        if (!ids.length) return;
        dispatch({ type: "clinic.bulk_restored", ids, actor });
        if (repository) {
          if (repository.bulkRestoreClinics) {
            await repository.bulkRestoreClinics(ids);
          } else {
            await Promise.all(ids.map((id) => repository.restoreClinic(id)));
          }
          await refresh().catch(() => undefined);
        }
      },
      permanentlyDeleteClinic: async (id) => {
        const actor = requireUser(user, "platform.clinics.manage");
        dispatch({ type: "clinic.permanently_deleted", id, actor });
        if (repository) {
          await repository.permanentlyDeleteClinic(id);
          await refresh().catch(() => undefined);
        }
      },
      bulkPermanentlyDeleteClinics: async (ids) => {
        const actor = requireUser(user, "platform.clinics.manage");
        if (!ids.length) return;
        dispatch({ type: "clinic.bulk_permanently_deleted", ids, actor });
        if (repository) {
          if (repository.bulkPermanentlyDeleteClinics) {
            await repository.bulkPermanentlyDeleteClinics(ids);
          } else {
            await Promise.all(ids.map((id) => repository.permanentlyDeleteClinic(id)));
          }
          await refresh().catch(() => undefined);
        }
      },
      emptyTrash: async () => {
        const actor = requireUser(user, "platform.clinics.manage");
        const trashIds = state.clinics.filter((c) => Boolean(c.deletedAt)).map((c) => c.id);
        if (!trashIds.length) return;
        dispatch({ type: "clinic.bulk_permanently_deleted", ids: trashIds, actor });
        if (repository) {
          if (repository.bulkPermanentlyDeleteClinics) {
            await repository.bulkPermanentlyDeleteClinics(trashIds);
          } else {
            await Promise.all(trashIds.map((id) => repository.permanentlyDeleteClinic(id)));
          }
          await refresh().catch(() => undefined);
        }
      },
      setClinicAccess: async (id, active) => {
        requireUser(user, "platform.clinics.manage");
        if (!repository) throw new Error("Clinic access changes require Supabase");
        await repository.setClinicAccess(id, active);
        await refresh();
      },
      extendSubscription: async (id, days, proofRef) => {
        requireUser(user, "platform.subscriptions.manage");
        if (!repository) throw new Error("Subscription changes require Supabase");
        await repository.extendSubscription(id, days, proofRef);
        await refresh();
      },
      createDoctor: async (input) => {
        const actor = requireUser(user, "people.manage");
        const targetHospitalId = input.hospitalId || actor.clinicId || state.clinics[0]?.id;
        if (!targetHospitalId) throw new Error("A clinic workspace is required");
        if (repository) {
          const doctor = await repository.createDoctor({ ...input, hospitalId: targetHospitalId });
          await refresh();
          return doctor;
        }
        const doctor: Doctor = {
          ...input,
          id: createId("DR"),
          clinicId: targetHospitalId,
          patients: 0,
          status: "Active",
          avatarPath: undefined,
          avatarUrl: undefined,
          photoWarning: undefined,
        };
        dispatch({ type: "doctor.created", value: doctor, actor });
        const staff: StaffMember = {
          id: doctor.id,
          clinicId: targetHospitalId,
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone,
          role: "doctor",
          status: "Active",
        };
        dispatch({ type: "staff.invited", value: staff, actor });
        return doctor;
      },
      createReceptionist: async (input) => {
        const actor = requireUser(user, "people.manage");
        const targetHospitalId = input.hospitalId || actor.clinicId || state.clinics[0]?.id;
        if (!targetHospitalId) throw new Error("A clinic workspace is required");
        if (repository) {
          const receptionist = await repository.createReceptionist({ ...input, hospitalId: targetHospitalId });
          await refresh();
          return receptionist;
        }
        const receptionist: Receptionist = {
          ...input,
          id: createId("RC"),
          clinicId: targetHospitalId,
          status: "Active",
        };
        dispatch({ type: "receptionist.created", value: receptionist, actor });
        const staff: StaffMember = {
          id: receptionist.id,
          clinicId: targetHospitalId,
          name: receptionist.name,
          email: receptionist.email,
          phone: receptionist.phone,
          role: "receptionist",
          status: "Active",
        };
        dispatch({ type: "staff.invited", value: staff, actor });
        return receptionist;
      },
      inviteSuperAdmin: async (input) => {
        const actor = requireUser(user, "platform.clinics.manage");
        if (actor.role !== "super_admin") {
          throw new Error("Only a super admin can add a super admin");
        }
        if (repository) {
          const membership = await repository.inviteSuperAdmin(input);
          await refresh();
          return membership;
        }
        const membership: StaffMember = {
          id: createId("SA"),
          clinicId: null,
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: "super_admin",
          status: "Invited",
          tempPassword: input.tempPassword,
        };
        dispatch({ type: "staff.invited", value: membership, actor });
        return membership;
      },
      inviteClinicAdmin: async (input) => {
        const actor = requireUser(user, "people.manage");
        if (actor.role !== "super_admin") {
          throw new Error("Only a super admin can invite a clinic admin");
        }
        const targetHospitalId = input.hospitalId || actor.clinicId;
        if (!targetHospitalId) throw new Error("A hospital must be selected");
        if (repository) {
          const membership = await repository.inviteClinicAdmin({ ...input, hospitalId: targetHospitalId });
          await refresh();
          return membership;
        }
        const origin = getAppBaseUrl();
        const token = (globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? Math.random().toString(36).slice(2)) +
          (globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? Math.random().toString(36).slice(2));
        const setupUrl = `${origin}/setup?token=${token}`;
        const clinic = state.clinics.find((c) => c.id === targetHospitalId);

        let emailSent = false;
        let emailId: string | undefined;
        let emailError: string | undefined;

        try {
          const sendResult = await sendInvitationEmail({
            recipientEmail: input.email,
            recipientName: input.name,
            clinicName: clinic?.name || "ClinicFlow Health",
            clinicId: targetHospitalId,
            clinicAddress: clinic?.address,
            clinicCity: clinic?.city,
            clinicPhone: input.phone || clinic?.phone,
            clinicEmail: clinic?.email,
            setupUrl,
            roleTitle: "Clinical Admin",
            expiresInHours: 24,
          });
          emailSent = sendResult.success;
          emailId = sendResult.emailId;
        } catch (err) {
          emailError = err instanceof Error ? err.message : "Failed to deliver email";
          console.error("[Invite Clinic Admin] Failed to send email:", emailError);
        }

        const membership: StaffMember = {
          id: createId("AD"),
          clinicId: targetHospitalId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: "clinic_admin",
          status: "Invited",
          tempPassword: input.tempPassword,
          emailSent,
          emailId,
          emailError,
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
      softDeleteStaff: async (userId: string) => {
        const actor = requireUser(user, "people.manage");
        const target = state.staffMembers.find((member) => member.id === userId);
        if (!target) throw new Error("Staff member was not found");
        if (target.id === actor.userId) throw new Error("You cannot delete your own account");
        if (actor.role !== "super_admin" && target.clinicId !== actor.clinicId) {
          throw new Error("You can only manage users within your clinic");
        }

        if (repository?.softDeleteStaff) {
          await repository.softDeleteStaff(userId);
          await refresh();
          return;
        }

        if (target.email) {
          deactivateUserAccount(target.email);
        }
        dispatch({ type: "staff.soft_deleted", userId, actor });
      },
      restoreStaff: async (userId: string) => {
        const actor = requireUser(user, "people.manage");
        const target = state.staffMembers.find((member) => member.id === userId);
        if (!target) throw new Error("Staff member was not found");
        if (actor.role !== "super_admin" && target.clinicId !== actor.clinicId && target.previousClinicId !== actor.clinicId) {
          throw new Error("You can only manage users within your clinic");
        }

        const targetClinicId = target.clinicId || target.previousClinicId;
        if (targetClinicId) {
          const clinicInTrash = state.clinics.find((c) => c.id === targetClinicId && Boolean(c.deletedAt));
          if (clinicInTrash) {
            throw new Error("Clinic is currently in Trash. Restore the clinic first.");
          }
        }

        if (repository?.restoreStaff) {
          await repository.restoreStaff(userId);
          await refresh();
          return;
        }

        if (target.email) {
          reactivateUserAccount(target.email);
        }
        dispatch({ type: "staff.restored", userId, actor });
      },
      permanentlyDeleteStaff: async (userId: string) => {
        const actor = requireUser(user, "people.manage");
        const target = state.staffMembers.find((member) => member.id === userId);
        if (actor.role !== "super_admin" && target && target.clinicId !== actor.clinicId && target.previousClinicId !== actor.clinicId) {
          throw new Error("You can only manage users within your clinic");
        }

        if (repository?.permanentlyDeleteStaff) {
          await repository.permanentlyDeleteStaff(userId);
          await refresh();
          return;
        }

        if (target?.email) {
          deleteUserAccount(target.email);
        }
        dispatch({ type: "staff.permanently_deleted", userId, actor });
      },
      bulkSoftDeleteStaff: async (userIds: string[]) => {
        const actor = requireUser(user, "people.manage");
        const filteredIds = userIds.filter((id) => {
          if (id === actor.userId) return false;
          if (actor.role === "super_admin") return true;
          const target = state.staffMembers.find((m) => m.id === id);
          return target && target.clinicId === actor.clinicId;
        });
        if (!filteredIds.length) return;

        if (repository?.bulkSoftDeleteStaff) {
          await repository.bulkSoftDeleteStaff(filteredIds);
          await refresh();
          return;
        } else if (repository?.softDeleteStaff) {
          for (const id of filteredIds) {
            await repository.softDeleteStaff(id);
          }
          await refresh();
          return;
        }

        filteredIds.forEach((id) => {
          const target = state.staffMembers.find((m) => m.id === id);
          if (target?.email) deactivateUserAccount(target.email);
        });
        dispatch({ type: "staff.bulk_soft_deleted", userIds: filteredIds, actor });
      },
      bulkRestoreStaff: async (userIds: string[]) => {
        const actor = requireUser(user, "people.manage");
        const filteredIds = userIds.filter((id) => {
          if (actor.role === "super_admin") return true;
          const target = state.staffMembers.find((m) => m.id === id);
          return target && (target.clinicId === actor.clinicId || target.previousClinicId === actor.clinicId);
        });
        if (!filteredIds.length) return;

        if (repository?.bulkRestoreStaff) {
          await repository.bulkRestoreStaff(filteredIds);
          await refresh();
          return;
        } else if (repository?.restoreStaff) {
          for (const id of filteredIds) {
            await repository.restoreStaff(id);
          }
          await refresh();
          return;
        }

        filteredIds.forEach((id) => {
          const target = state.staffMembers.find((m) => m.id === id);
          if (target?.email) reactivateUserAccount(target.email);
        });
        dispatch({ type: "staff.bulk_restored", userIds: filteredIds, actor });
      },
      bulkPermanentlyDeleteStaff: async (userIds: string[]) => {
        const actor = requireUser(user, "people.manage");
        const filteredIds = userIds.filter((id) => {
          if (actor.role === "super_admin") return true;
          const target = state.staffMembers.find((m) => m.id === id);
          return target && (target.clinicId === actor.clinicId || target.previousClinicId === actor.clinicId);
        });
        if (!filteredIds.length) return;

        if (repository?.bulkPermanentlyDeleteStaff) {
          await repository.bulkPermanentlyDeleteStaff(filteredIds);
          await refresh();
          return;
        } else if (repository?.permanentlyDeleteStaff) {
          for (const id of filteredIds) {
            await repository.permanentlyDeleteStaff(id);
          }
          await refresh();
          return;
        }

        filteredIds.forEach((id) => {
          const target = state.staffMembers.find((m) => m.id === id);
          if (target?.email) deleteUserAccount(target.email);
        });
        dispatch({ type: "staff.bulk_permanently_deleted", userIds: filteredIds, actor });
      },
      resendStaffInvitation: async (userId: string) => {
        const actor = requireUser(user, "people.manage");
        const target = state.staffMembers.find((member) => member.id === userId);
        if (!target) throw new Error("Staff member was not found");
        if (actor.role !== "super_admin" && target.clinicId !== actor.clinicId) {
          throw new Error("You can only manage users within your clinic");
        }

        const origin = getAppBaseUrl();
        const token = (globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? Math.random().toString(36).slice(2)) +
          (globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? Math.random().toString(36).slice(2));
        const setupUrl = `${origin}/setup?token=${token}`;

        const clinicId = target.clinicId || target.previousClinicId;
        const clinic = clinicId ? state.clinics.find((c) => c.id === clinicId) : null;

        await sendInvitationEmail({
          recipientEmail: target.email,
          recipientName: target.name,
          clinicName: clinic?.name || "ClinicFlow Health",
          clinicId: clinic?.id,
          clinicAddress: clinic?.address,
          clinicCity: clinic?.city,
          clinicPhone: target.phone || clinic?.phone,
          clinicEmail: clinic?.email,
          setupUrl,
          roleTitle: target.role === "doctor" ? "Doctor" : target.role === "receptionist" ? "Receptionist" : "Clinical Admin",
          expiresInHours: 24,
        });

        dispatch({ type: "staff.invitation_resent", userId, actor });
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
      createFacility: async (input) => {
        const actor = requireUser(user, "facilities.manage");
        if (repository) {
          const facility = await repository.createFacility(input);
          await refresh();
          return facility;
        }
        const tenantId = requireClinic(actor);
        const facility: Facility = {
          id: createId("FAC"),
          clinicId: tenantId,
          code: input.code,
          name: input.name,
          timezone: input.timezone,
          phone: input.phone,
          email: input.email,
          address: input.address,
          active: true,
        };
        dispatch({ type: "facility.created", value: facility, actor });
        return facility;
      },
    };
  }, [error, isLoading, refresh, repository, state, syncStatus, user]);

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspaceData() {
  const value = useContext(WorkspaceCtx);
  if (!value) throw new Error("useWorkspaceData must be used inside WorkspaceDataProvider");
  return value;
}
