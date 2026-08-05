import type {
  Appointment,
  AppointmentInput,
  Bill,
  BillInput,
  ClinicAdminInput,
  ClinicInput,
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
  listAuditLogs(input?: RecordPageInput): Promise<RecordPage<AuditEntry>>;
  createClinic(input: ClinicInput): Promise<{ id: string }>;
  updateClinic(input: ClinicInput): Promise<void>;
  deleteClinic(id: string): Promise<void>;
  setClinicAccess(id: string, active: boolean): Promise<void>;
  extendSubscription(id: string, days: number, proofRef?: string): Promise<void>;
  createDoctor(input: DoctorInput): Promise<Doctor>;
  createReceptionist(input: ReceptionistInput): Promise<Receptionist>;
  inviteClinicAdmin(input: ClinicAdminInput): Promise<StaffMember>;
  createPatient(input: PatientInput): Promise<Patient>;
  createAppointment(input: AppointmentInput): Promise<Appointment>;
  updateAppointment(appointment: Appointment): Promise<Appointment>;
  savePrescription(input: PrescriptionInput): Promise<Prescription>;
  saveLabReports(reports: Omit<LabReport, "clinicId">[]): Promise<LabReport[]>;
  createBill(input: BillInput): Promise<Bill>;
  updateBill(bill: Bill): Promise<Bill>;
  inviteSuperAdmin(input: { name: string; email: string; phone: string; tempPassword: string }): Promise<StaffMember>;
  deactivateStaff(userId: string, reason: string): Promise<void>;
}
