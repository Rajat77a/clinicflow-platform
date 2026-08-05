// This file previously contained hardcoded demo data.
// All data is now sourced from the database via WorkspaceDataProvider.
// Do not add static sample data here.

export const SUBSCRIPTION_PRICE = 499; // ₹ per clinic per month

export type PrescriptionMed = { name: string; dosage: string; frequency: string; duration: string; unitPrice?: number };
export type Prescription = {
  id: string; patient: string; patientId: string; doctor: string; date: string;
  diagnosis: string; notes?: string; followUp?: string; medicines: PrescriptionMed[];
};

export type LabReport = {
  id: string; prescriptionId?: string; patient: string; patientId: string;
  test: string; date: string; result: string; reference: string; notes?: string;
  fileName?: string; uploadedBy: string;
};

export type FollowUp = {
  id: string; patient: string; patientId: string; doctor: string;
  date: string; reason: string; status: "Pending" | "Done" | "Rescheduled";
};
