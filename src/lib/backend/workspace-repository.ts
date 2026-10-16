import type {
  Appointment,
  AppointmentInput,
  Bill,
  BillInput,
  ClinicAdminInput,
  ClinicInput,
  Doctor,
  DoctorInput,
  Facility,
  FacilityInput,
  LabReport,
  Patient,
  PatientInput,
  Prescription,
  PrescriptionInput,
  Receptionist,
  ReceptionistInput,
  StaffMember,
  WorkspaceDocument,
  WorkspaceSnapshot,
  AuditEntry,
} from "../workspace-data";

export interface RecordPage<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface RecordPageInput {
  query?: string;
  limit?: number;
  offset?: number;
  patientId?: string;
  recordId?: string;
  date?: string;
  scope?: "my" | "all";
}

export type PatientPage = RecordPage<Patient>;
export type PatientSearch = RecordPageInput;

export interface WorkspaceRepository {
  load(): Promise<WorkspaceSnapshot>;
  searchPatients(input?: PatientSearch): Promise<PatientPage>;
  getPatient(id: string): Promise<Patient | null>;
  listAppointments(input?: RecordPageInput): Promise<RecordPage<Appointment>>;
  listPrescriptions(input?: RecordPageInput): Promise<RecordPage<Prescription>>;
  listLabReports(input?: RecordPageInput): Promise<RecordPage<LabReport>>;
  listBills(input?: RecordPageInput): Promise<RecordPage<Bill>>;
  listDocuments(input?: RecordPageInput): Promise<RecordPage<WorkspaceDocument>>;
  listAuditLogs(input?: RecordPageInput): Promise<RecordPage<AuditEntry>>;
  createClinic(input: ClinicInput): Promise<{ id: string; setupUrl?: string; emailSent?: boolean; emailId?: string; emailError?: string }>;
  updateClinic(input: ClinicInput): Promise<void>;
  deleteClinic(id: string): Promise<void>;
  softDeleteClinic(id: string): Promise<void>;
  restoreClinic(id: string): Promise<void>;
  permanentlyDeleteClinic(id: string): Promise<void>;
  bulkSoftDeleteClinics?(ids: string[]): Promise<void>;
  bulkRestoreClinics?(ids: string[]): Promise<void>;
  bulkPermanentlyDeleteClinics?(ids: string[]): Promise<void>;
  setClinicAccess(id: string, active: boolean): Promise<void>;
  extendSubscription(id: string, days: number, proofRef?: string): Promise<void>;
  createDoctor(input: DoctorInput): Promise<{ data: Doctor; setupUrl?: string; emailSent?: boolean; emailId?: string; emailError?: string }>;
  createReceptionist(input: ReceptionistInput): Promise<{ data: Receptionist; setupUrl?: string; emailSent?: boolean; emailId?: string; emailError?: string }>;
  inviteClinicAdmin(input: ClinicAdminInput): Promise<{ data: StaffMember; setupUrl?: string; emailSent?: boolean; emailId?: string; emailError?: string }>;
  createPatient(input: PatientInput): Promise<Patient>;
  updatePatient?(input: Partial<PatientInput> & { id: string }): Promise<Patient>;
  createAppointment(input: AppointmentInput): Promise<Appointment>;
  updateAppointment(appointment: Appointment): Promise<Appointment>;
  savePrescription(input: PrescriptionInput): Promise<Prescription>;
  saveLabReports(reports: Omit<LabReport, "clinicId">[]): Promise<LabReport[]>;
  createBill(input: BillInput): Promise<Bill>;
  updateBill(bill: Bill): Promise<Bill>;
  updateStaff?(input: {
    id: string;
    name?: string;
    phone?: string;
    specialty?: string;
    gender?: "female" | "male" | "other" | "";
    qualification?: string;
    medicalRegistrationNumber?: string;
    experienceYears?: number;
    consultationFee?: number;
    workingHours?: string;
    notes?: string;
    shift?: string;
    status?: "Active" | "Invited" | "Inactive" | "Expired";
  }): Promise<void>;
  deactivateStaff(userId: string, reason: string): Promise<void>;
  softDeleteStaff?(userId: string): Promise<void>;
  bulkSoftDeleteStaff?(userIds: string[]): Promise<void>;
  restoreStaff?(userId: string): Promise<void>;
  bulkRestoreStaff?(userIds: string[]): Promise<void>;
  permanentlyDeleteStaff?(userId: string): Promise<void>;
  bulkPermanentlyDeleteStaff?(userIds: string[]): Promise<void>;
  createFacility(input: FacilityInput): Promise<Facility>;
  resendStaffInvitation?(member: StaffMember): Promise<{ setupUrl: string; emailSent?: boolean; emailId?: string; emailError?: string }>;
}

