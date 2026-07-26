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

export interface WorkspaceRepository {
  load(): Promise<WorkspaceSnapshot>;
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
}
