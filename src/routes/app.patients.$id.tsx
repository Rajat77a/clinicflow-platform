import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PaginationFooter } from "@/components/data/pagination-footer";
import {
  useWorkspaceData,
  type Bill,
  type LabReport,
  type Patient,
  type Prescription,
  type PatientDocument,
  type WorkspaceDocument,
} from "@/lib/workspace-data";
import { printDocument } from "@/lib/exporters";
import { sendWhatsApp } from "@/lib/whatsapp";
import {
  resolvePrescriptionDetails,
  formatPatientId,
  formatPrescriptionId,
  formatInvoiceId,
  formatLabReportId,
  formatAppointmentId,
  resolveClinicCode,
} from "@/lib/prescription-fields";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/access-control";
import { supabaseConfig } from "@/lib/supabase/config";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone, Mail, MapPin, MessageCircle, Calendar, FileText, Receipt,
  FolderOpen, FlaskConical, Download, Send, Printer, Edit, Eye,
  Trash2, AlertTriangle, Pencil, Check, X, Upload, Plus, File, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useRecordPage } from "@/lib/use-record-page";

export const Route = createFileRoute("/app/patients/$id")({
  component: PatientProfile,
});

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function DocumentCard({ document }: { document: WorkspaceDocument }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-soft">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{document.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{document.category}</Badge>
          <span>{formatBytes(document.sizeBytes)}</span>
          <span>{document.date}</span>
          <span>Uploaded by {document.uploadedBy}</span>
        </div>
      </div>
    </div>
  );
}

function PatientProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const {
    patients,
    allPatients,
    clinics,
    getPatient,
    listAppointments,
    listPrescriptions,
    listLabReports,
    listBills,
    listDocuments,
    updateBillNotes,
    softDeletePatient,
    updatePatient,
    listPatientDocuments,
    uploadPatientDocument,
    deletePatientDocument,
  } = useWorkspaceData();
  const snapshotPatient = (allPatients ?? patients).find(candidate => candidate.id === id);
  const [loadedPatient, setLoadedPatient] = useState<Patient | null>(null);
  const [recordLoading, setRecordLoading] = useState(!snapshotPatient);
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);
  const [viewingRx, setViewingRx] = useState<Prescription | null>(null);
  const [isEditingBillNotes, setIsEditingBillNotes] = useState(false);
  const [billNotesDraft, setBillNotesDraft] = useState("");
  const [isSavingBillNotes, setIsSavingBillNotes] = useState(false);
  const [viewingLab, setViewingLab] = useState<LabReport | null>(null);
  const [showTrashDialog, setShowTrashDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [patientDocs, setPatientDocs] = useState<PatientDocument[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<PatientDocument | null>(null);

  // Edit patient modal state
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editGender, setEditGender] = useState("male");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsappPhone, setEditWhatsappPhone] = useState("");
  const [editBloodGroup, setEditBloodGroup] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editEmergencyName, setEditEmergencyName] = useState("");
  const [editEmergencyPhone, setEditEmergencyPhone] = useState("");
  const [editAllergies, setEditAllergies] = useState("");
  const [editChronicConditions, setEditChronicConditions] = useState("");
  const patient = loadedPatient ?? snapshotPatient;
  const visitsPage = useRecordPage(listAppointments, { patientId: id });
  const prescriptionsPage = useRecordPage(listPrescriptions, { patientId: id });
  const billsPage = useRecordPage(listBills, { patientId: id });
  const labsPage = useRecordPage(listLabReports, { patientId: id });
  const documentsPage = useRecordPage(listDocuments, { patientId: id });
  const visits = visitsPage.rows;
  const myRx = prescriptionsPage.rows;
  const myBills = billsPage.rows;
  const myLabs = labsPage.rows;
  const myDocuments = documentsPage.rows;

  const clinicCode = resolveClinicCode(patient?.clinicId, clinics, user?.clinicId);

  useEffect(() => {
    let current = true;
    setRecordLoading(!snapshotPatient);
    void getPatient(id)
      .then((result) => {
        if (current) setLoadedPatient(result);
      })
      .catch(() => {
        if (current && !snapshotPatient) setLoadedPatient(null);
      })
      .finally(() => {
        if (current) setRecordLoading(false);
      });
    return () => {
      current = false;
    };
  }, [getPatient, id, snapshotPatient]);

  useEffect(() => {
    if (!id) return;
    void listPatientDocuments(id).then(setPatientDocs);
  }, [id, listPatientDocuments]);

  if (recordLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading patient record…</div>;
  }
  if (!patient) throw notFound();

  const canEditRx = Boolean(user && hasPermission(user.role, "prescriptions.write"));
  const canAddLab = Boolean(user && hasPermission(user.role, "labs.write"));
  const canBook = Boolean(user && hasPermission(user.role, "appointments.create"));
  const canDelete = Boolean(user && (user.role === "clinic_admin" || user.role === "super_admin"));
  const canUseExternalSharing = supabaseConfig.demoMode;

  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !patient) return;
    setIsUploadingDoc(true);
    const formatBytes = (bytes: number) => {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };
    const fileType = file.type.includes("pdf") ? "PDF Document" : file.type.includes("image") ? "Image" : "Document";
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const newDoc = await uploadPatientDocument({
          patientId: patient.id,
          clinicId: patient.clinicId,
          name: file.name,
          size: formatBytes(file.size),
          type: fileType,
          fileData: typeof reader.result === "string" ? reader.result : undefined,
          source: "document",
        });
        setPatientDocs(prev => [newDoc, ...prev]);
        toast.success(`Uploaded ${file.name}`);
      } catch (err) {
        toast.error("Failed to upload document");
      } finally {
        setIsUploadingDoc(false);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      setIsUploadingDoc(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDownloadFile = (name: string, fileData?: string) => {
    if (fileData) {
      const link = document.createElement("a");
      link.href = fileData;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloading ${name}`);
    } else {
      // Create a dummy text file blob so user can always open/download
      const blob = new Blob([`ClinicFlow Medical Record Document: ${name}\nPatient: ${patient?.name} (${patient?.id})`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Downloading ${name}`);
    }
  };

  const handleTrashPatient = async () => {
    if (!patient) return;
    setIsDeleting(true);
    try {
      await softDeletePatient(patient.id);
      toast.success(`${patient.name} has been moved to Trash (held for 10 days, purged after 60 days)`);
      setShowTrashDialog(false);
      navigate({ to: "/app/patients" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move patient to Trash");
      setIsDeleting(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!patient) return;
    setEditName(patient.name || "");
    setEditDateOfBirth(patient.dateOfBirth || "");
    setEditGender(
      patient.gender?.toLowerCase() === "male"
        ? "male"
        : patient.gender?.toLowerCase() === "female"
        ? "female"
        : "unknown"
    );
    setEditPhone(patient.phone || "");
    setEditEmail(patient.email || "");
    setEditWhatsappPhone(patient.whatsappPhone || "");
    setEditBloodGroup(patient.bloodGroup || "");
    setEditAddress(patient.address || "");
    setEditEmergencyName(patient.emergencyContactName || "");
    setEditEmergencyPhone(patient.emergencyContactPhone || "");
    setEditAllergies((patient.allergies || []).join(", "));
    setEditChronicConditions((patient.chronicConditions || []).join(", "));
    setIsEditingPatient(true);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    if (!editName.trim()) {
      toast.error("Patient full name is required");
      return;
    }
    if (!editPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    setIsSavingPatient(true);
    try {
      const updated = await updatePatient({
        id: patient.id,
        name: editName.trim(),
        dateOfBirth: editDateOfBirth || patient.dateOfBirth,
        gender: editGender,
        phone: editPhone.trim(),
        email: editEmail.trim() || undefined,
        whatsappPhone: editWhatsappPhone.trim() || undefined,
        bloodGroup: editBloodGroup || undefined,
        address: editAddress.trim() || undefined,
        emergencyContactName: editEmergencyName.trim() || undefined,
        emergencyContactPhone: editEmergencyPhone.trim() || undefined,
        allergies: editAllergies.split(",").map(s => s.trim()).filter(Boolean),
        chronicConditions: editChronicConditions.split(",").map(s => s.trim()).filter(Boolean),
      });
      setLoadedPatient(updated);
      setIsEditingPatient(false);
      toast.success("Patient details updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update patient details");
    } finally {
      setIsSavingPatient(false);
    }
  };

  const printRx = (rx: Prescription) => {
    const details = resolvePrescriptionDetails(rx);
    const displayPatientId = formatPatientId(patient.id, patient.medicalRecordNumber, clinicCode);
    const displayRxId = formatPrescriptionId(rx.id, clinicCode);
    const primaryReason = details.primaryIllness || (rx.diagnosis && rx.diagnosis !== "Not recorded" ? rx.diagnosis : "");
    printDocument(`
      <h2>${user?.clinic ?? "ClinicFlow"}</h2>
      <div class="muted">Prescription ${displayRxId} · Issued on ${rx.date}</div>
      <div class="card">
        <div class="row"><b>Patient Name</b><span>${patient.name} (${displayPatientId})</span></div>
        <div class="row"><b>Consulting Doctor</b><span>${rx.doctor}</span></div>
        ${details.presentingComplaints ? `<div class="section"><div class="label">Presenting Complaints</div><div class="val">${details.presentingComplaints}</div></div>` : ""}
        ${primaryReason ? `<div class="section"><div class="label">Primary Illness / Diagnosis</div><div class="val">${primaryReason}</div></div>` : ""}
        ${details.pastIllnessHistory ? `<div class="section"><div class="label">History of Past Illness</div><div class="val">${details.pastIllnessHistory}</div></div>` : ""}
        ${details.clinicalFindings ? `<div class="section"><div class="label">Clinical Findings</div><div class="val">${details.clinicalFindings}</div></div>` : ""}
        ${details.treatmentNotes ? `<div class="section"><div class="label">Treatment Notes / Advice</div><div class="val">${details.treatmentNotes}</div></div>` : ""}
        ${details.additionalNotes ? `<div class="section"><div class="label">Additional Notes</div><div class="val">${details.additionalNotes}</div></div>` : ""}
        ${rx.followUp ? `<div class="row"><b>Follow-up Date</b><span>${rx.followUp}</span></div>` : ""}
      </div>
      <h3>Prescribed Medicines (Rx)</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 40%">Medicine Name</th>
            <th style="width: 20%">Dosage</th>
            <th style="width: 20%">Frequency</th>
            <th style="width: 20%">Duration</th>
          </tr>
        </thead>
        <tbody>
          ${rx.medicines.map(m => `<tr><td><b>${m.name}</b></td><td>${m.dosage}</td><td>${m.frequency}</td><td>${m.duration}</td></tr>`).join("")}
        </tbody>
      </table>
    `, `Prescription ${rx.id}`);
  };

  const getPatientWhatsAppNumber = () => {
    return patient.whatsappPhone?.trim() || "";
  };

  const shareRx = (rx: Prescription) => {
    const targetPhone = getPatientWhatsAppNumber();
    if (!targetPhone) {
      toast.error("WhatsApp number is not available");
      return;
    }
    const details = resolvePrescriptionDetails(rx);
    const parts = [
      `Hi ${patient.name}, prescription ${rx.id} (${rx.date}):`,
      details.presentingComplaints?.trim() ? `Presenting Complaints:\n${details.presentingComplaints.trim()}` : "",
      details.pastIllnessHistory?.trim() ? `History of Past Illness:\n${details.pastIllnessHistory.trim()}` : "",
      details.clinicalFindings?.trim() ? `Clinical Findings:\n${details.clinicalFindings.trim()}` : "",
      `Diagnosis:\n${rx.diagnosis || details.primaryIllness}`,
      details.treatmentNotes?.trim() ? `Treatment Notes:\n${details.treatmentNotes.trim()}` : "",
      details.additionalNotes?.trim() ? `Additional Notes:\n${details.additionalNotes.trim()}` : "",
      `Medicines:\n${rx.medicines.map(m => `• ${m.name} — ${m.dosage} ${m.frequency} × ${m.duration}`).join("\n")}`,
      rx.followUp ? `Follow-up: ${rx.followUp}` : "",
    ].filter(Boolean);
    const msg = parts.join("\n\n");
    sendWhatsApp(targetPhone, msg);
    toast.success(`Opening WhatsApp chat for ${patient.name}`);
  };

  const shareBill = (b: Bill) => {
    const targetPhone = getPatientWhatsAppNumber();
    if (!targetPhone) {
      toast.error("WhatsApp number is not available");
      return;
    }
    const msg = `Hi ${patient.name}, invoice ${b.id} from ${user?.clinic ?? "ClinicFlow"}:\nAmount: ₹${b.amount.toFixed(2)} (${b.status})\nDate: ${b.date}`;
    sendWhatsApp(targetPhone, msg);
    toast.success(`Opening WhatsApp chat for ${patient.name}`);
  };

  return (
    <>
      <div className="mb-2">
        <Link
          to="/app/patients"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Patients
        </Link>
      </div>
      <PageHeader title={patient.name} description={`Patient ID ${formatPatientId(patient.id, patient.medicalRecordNumber, clinicCode)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleOpenEditModal}
              title="Edit patient details"
            >
              <Pencil className="mr-1.5 h-4 w-4" /> Edit Patient
            </Button>
            {canEditRx && <Button asChild variant="outline"><Link to="/app/prescriptions/new" search={{ patient: patient.id }}>New prescription</Link></Button>}
            {canBook && (
              <Button asChild>
                <Link to="/app/appointments/new" search={{ patient: patient.id }}>
                  Book follow-up
                </Link>
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                onClick={() => setShowTrashDialog(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Move to Trash
              </Button>
            )}
          </div>
        } />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <Link
              to="/app/patients"
              title="Back to Patients list"
              className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-info text-primary-foreground text-xl font-bold shadow-sm transition-all hover:scale-105 hover:opacity-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              {patient.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-bold truncate">{patient.name}</div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handleOpenEditModal}
                  title="Edit patient details"
                  aria-label="Edit patient details"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">{patient.age} y · {patient.gender}</div>
              <Badge variant="outline" className="mt-1">{patient.status}</Badge>
            </div>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> <span>{patient.phone}</span></div>
            {patient.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> <span className="break-all">{patient.email}</span></div>}
            {patient.address && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> <span>{patient.address}</span></div>}
            {canUseExternalSharing && <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <button
                className="hover:underline text-left"
                onClick={() => {
                  const targetPhone = getPatientWhatsAppNumber();
                  if (!targetPhone) {
                    toast.error("WhatsApp number is not available");
                    return;
                  }
                  sendWhatsApp(targetPhone, `Hello ${patient.name}, this is ${user?.clinic ?? "ClinicFlow"}.`);
                  toast.success(`Opening WhatsApp chat for ${patient.name}`);
                }}
              >
                {patient.whatsappPhone ? `${patient.whatsappPhone} (WhatsApp)` : "WhatsApp chat"}
              </button>
            </div>}
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> <span>Last visit {patient.lastVisit}</span></div>
          </dl>
          <div className="mt-5 space-y-3 border-t pt-4 text-sm">
            {patient.bloodGroup && <PatientDetail label="Blood group" value={patient.bloodGroup} />}
            {patient.whatsappPhone && <PatientDetail label="WhatsApp" value={patient.whatsappPhone} />}
            {(patient.emergencyContactName || patient.emergencyContactPhone) && (
              <PatientDetail
                label="Emergency contact"
                value={[patient.emergencyContactName, patient.emergencyContactPhone].filter(Boolean).join(" · ")}
              />
            )}
            {patient.allergies && patient.allergies.length > 0 && (
              <PatientDetail label="Allergies" value={patient.allergies.join(", ")} emphasis />
            )}
            {patient.chronicConditions && patient.chronicConditions.length > 0 && (
              <PatientDetail label="Existing conditions" value={patient.chronicConditions.join(", ")} />
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="rx">
            <TabsList className="rounded-xl bg-muted/60 p-1 flex-wrap h-auto">
              <TabsTrigger value="rx" className="rounded-lg"><FileText className="mr-1.5 h-3.5 w-3.5" />Prescriptions</TabsTrigger>
              <TabsTrigger value="labs" className="rounded-lg"><FlaskConical className="mr-1.5 h-3.5 w-3.5" />Lab reports</TabsTrigger>
              <TabsTrigger value="bills" className="rounded-lg"><Receipt className="mr-1.5 h-3.5 w-3.5" />Bills</TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg"><Calendar className="mr-1.5 h-3.5 w-3.5" />Visits</TabsTrigger>
               <TabsTrigger value="docs" className="rounded-lg"><FolderOpen className="mr-1.5 h-3.5 w-3.5" />Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="rx" className="mt-4 space-y-3">
              {prescriptionsPage.isLoading && <EmptyCard label="Loading prescriptions..." />}
              {!prescriptionsPage.isLoading && prescriptionsPage.error && <EmptyCard label={prescriptionsPage.error} />}
              {!prescriptionsPage.isLoading && !prescriptionsPage.error && myRx.length === 0 && <EmptyCard label="No prescriptions yet" />}
              {myRx.map(r => {
                const details = resolvePrescriptionDetails(r);
                return (
                  <div
                    key={r.id}
                    onClick={() => setViewingRx(r)}
                    className="cursor-pointer rounded-2xl border bg-card p-5 shadow-soft transition-all hover:border-primary/50 hover:shadow-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">{formatPrescriptionId(r.id, clinicCode)}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{r.date}</span>
                        </div>
                        <div className="mt-1 font-display text-base font-semibold text-foreground whitespace-pre-wrap">
                          {details.primaryIllness}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.doctor}{r.followUp ? ` · Follow-up ${r.followUp}` : ""}
                        </div>

                        {/* Concise summary: Presenting complaints only */}
                        {details.presentingComplaints && (
                          <div className="mt-2.5 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                            <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[11px] mr-1.5">
                              PRESENTING COMPLAINTS:
                            </span>
                            <span className="text-foreground">{details.presentingComplaints}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewingRx(r)}
                          aria-label={`View ${r.id}`}
                          title={`View ${r.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => printRx(r)}
                          aria-label={`Print ${r.id}`}
                          title={`Print ${r.id}`}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        {canUseExternalSharing && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => shareRx(r)}
                            aria-label={`Share ${r.id}`}
                            title={`Share ${r.id}`}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canEditRx && supabaseConfig.demoMode && <Button asChild size="sm" variant="ghost">
                          <Link to="/app/prescriptions/new" search={{ edit: r.id }} aria-label={`Edit ${r.id}`} title={`Edit ${r.id}`}><Edit className="h-3.5 w-3.5" /></Link>
                        </Button>}
                      </div>
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {r.medicines.map((m, i) => (
                        <li key={i} className="rounded-lg bg-muted/40 px-2.5 py-1 text-xs">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-muted-foreground text-[11px]"> ({m.dosage} · {m.frequency} · {m.duration})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              <PaginationFooter
                offset={prescriptionsPage.offset}
                limit={prescriptionsPage.limit}
                total={prescriptionsPage.total}
                onOffsetChange={prescriptionsPage.setOffset}
                disabled={prescriptionsPage.isLoading}
              />
            </TabsContent>

            <TabsContent value="labs" className="mt-4 space-y-3">
              {canAddLab && (
                <div className="flex justify-end">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/app/prescriptions/new" search={{ mode: "lab", patient: patient.id }}>
                      <FlaskConical className="mr-1.5 h-3.5 w-3.5" />Add lab report
                    </Link>
                  </Button>
                </div>
              )}
              {labsPage.isLoading && <EmptyCard label="Loading lab reports..." />}
              {!labsPage.isLoading && labsPage.error && <EmptyCard label={labsPage.error} />}
              {!labsPage.isLoading && !labsPage.error && myLabs.length === 0 && <EmptyCard label="No lab reports yet" />}
              {myLabs.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setViewingLab(l)}
                  className="w-full text-left rounded-2xl border bg-card p-5 shadow-soft hover:border-primary/60 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">
                        <span className="font-semibold text-primary">
                          {formatLabReportId(l.id, resolveClinicCode(l.clinicId || patient.clinicId, clinics, user?.clinicId))}
                        </span>
                        {" · "}{l.date}
                        {l.prescriptionId ? ` · linked ${formatPrescriptionId(l.prescriptionId, resolveClinicCode(l.clinicId || patient.clinicId, clinics, user?.clinicId))}` : ""}
                      </div>
                      <div className="font-display text-base font-semibold">{l.test}</div>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {l.fileName ? (
                    <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">📎 {l.fileName}</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><div className="text-xs text-muted-foreground">Result</div><div className="font-semibold">{l.result}</div></div>
                      <div><div className="text-xs text-muted-foreground">Reference</div><div>{l.reference}</div></div>
                    </div>
                  )}
                  <div className="mt-3 text-xs text-muted-foreground">Uploaded by {l.uploadedBy}</div>
                </button>
              ))}
              <PaginationFooter
                offset={labsPage.offset}
                limit={labsPage.limit}
                total={labsPage.total}
                onOffsetChange={labsPage.setOffset}
                disabled={labsPage.isLoading}
              />
            </TabsContent>

            <TabsContent value="bills" className="mt-4 rounded-2xl border bg-card shadow-soft">
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {billsPage.isLoading && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Loading bills...</TableCell></TableRow>}
                  {!billsPage.isLoading && billsPage.error && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-destructive">{billsPage.error}</TableCell></TableRow>}
                  {!billsPage.isLoading && !billsPage.error && (myBills.length ? myBills.map(b => (
                    <TableRow key={b.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewingBill(b)}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">{formatInvoiceId(b.id, clinicCode)}</TableCell>
                      <TableCell>{b.date}</TableCell>
                      <TableCell className="text-right tabular-nums">₹{b.amount.toFixed(2)}</TableCell>
                      <TableCell><Badge variant={b.status === "Paid" ? "secondary" : b.status === "Overdue" ? "destructive" : "outline"}>{b.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setViewingBill(b); }} aria-label={`View ${b.id}`} title={`View ${b.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {canUseExternalSharing && (
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); shareBill(b); }} aria-label={`Share ${b.id} on WhatsApp`} title="Send on WhatsApp">
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No bills</TableCell></TableRow>)}
                </TableBody>
              </Table>
              <PaginationFooter
                offset={billsPage.offset}
                limit={billsPage.limit}
                total={billsPage.total}
                onOffsetChange={billsPage.setOffset}
                disabled={billsPage.isLoading}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-4 rounded-2xl border bg-card shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Appointment ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitsPage.isLoading && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Loading visits...</TableCell></TableRow>}
                  {!visitsPage.isLoading && visitsPage.error && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-destructive">{visitsPage.error}</TableCell></TableRow>}
                  {!visitsPage.isLoading && !visitsPage.error && (visits.length ? visits.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {formatAppointmentId(v.id, resolveClinicCode(v.clinicId || patient.clinicId, clinics, user?.clinicId))}
                      </TableCell>
                      <TableCell>{v.date} · {v.time}</TableCell>
                      <TableCell>{v.doctor}</TableCell>
                      <TableCell>{v.type}</TableCell>
                      <TableCell><Badge variant="secondary">{v.status}</Badge></TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No visits yet</TableCell></TableRow>)}
                </TableBody>
              </Table>
              <PaginationFooter
                offset={visitsPage.offset}
                limit={visitsPage.limit}
                total={visitsPage.total}
                onOffsetChange={visitsPage.setOffset}
                disabled={visitsPage.isLoading}
              />
            </TabsContent>

            <TabsContent value="docs" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Patient Documents & Reports</h3>
                  <p className="text-xs text-muted-foreground">Uploaded documents, prescriptions, and lab report attachments</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isUploadingDoc ? "Uploading..." : "Upload document"}</span>
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,.doc,.docx"
                    className="hidden"
                    disabled={isUploadingDoc}
                    onChange={handleDocumentFileUpload}
                  />
                </label>
              </div>

              {documentsPage.isLoading && <EmptyCard label="Loading documents..." />}

              {(() => {
                const labDocs: PatientDocument[] = myLabs
                  .filter(l => l.fileName)
                  .map(l => ({
                    id: `LAB-DOC-${l.id}`,
                    patientId: l.patientId,
                    name: l.fileName!,
                    size: "Lab Report",
                    type: "Lab Report Attachment",
                    date: l.date,
                    uploadedBy: l.uploadedBy,
                    fileData: l.fileData,
                    source: "lab_report" as const,
                  }));
                const allDocs = [...patientDocs, ...labDocs];

                return (
                  <>
                    {myDocuments.length > 0 && (
                      <div className="space-y-3">
                        {myDocuments.map((document) => (
                          <DocumentCard key={document.id} document={document} />
                        ))}
                      </div>
                    )}

                    {allDocs.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {allDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="group flex items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-soft transition-all hover:border-primary/50 hover:shadow-card"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                                {doc.type.includes("Lab") ? (
                                  <FlaskConical className="h-5 w-5" />
                                ) : (
                                  <File className="h-5 w-5" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold" title={doc.name}>
                                  {doc.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {doc.type} · {doc.size}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {doc.date} · by {doc.uploadedBy}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title={`Download ${doc.name}`}
                                onClick={() => handleDownloadFile(doc.name, doc.fileData)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {doc.source === "document" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  title="Delete document"
                                  onClick={async () => {
                                    await deletePatientDocument(doc.id);
                                    setPatientDocs(prev => prev.filter(d => d.id !== doc.id));
                                    toast.success("Document removed");
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!documentsPage.isLoading && myDocuments.length === 0 && allDocs.length === 0 && (
                      <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
                        <FolderOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">No documents uploaded yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Upload files or attach reports to this patient record.</p>
                      </div>
                    )}
                  </>
                );
              })()}

              {myDocuments.length > 0 && (
                <PaginationFooter
                  offset={documentsPage.offset}
                  limit={documentsPage.limit}
                  total={documentsPage.total}
                  onOffsetChange={documentsPage.setOffset}
                  disabled={documentsPage.isLoading}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog
        open={!!viewingBill}
        onOpenChange={(o) => {
          if (!o) {
            setViewingBill(null);
            setIsEditingBillNotes(false);
            setBillNotesDraft("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Invoice {viewingBill ? formatInvoiceId(viewingBill.id, clinicCode) : ""}</DialogTitle></DialogHeader>
          {viewingBill && (
            <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-xs text-muted-foreground">Patient</div><div className="font-semibold">{viewingBill.patient}</div></div>
                  <div><div className="text-xs text-muted-foreground">Date</div><div>{viewingBill.date}</div></div>
                  <div><div className="text-xs text-muted-foreground">Method</div><div>{viewingBill.method}</div></div>
                  <div><div className="text-xs text-muted-foreground">Status</div>
                    <Badge variant={viewingBill.status === "Paid" ? "secondary" : viewingBill.status === "Overdue" ? "destructive" : "outline"}>{viewingBill.status}</Badge>
                  </div>
                </div>
                {viewingBill.items && viewingBill.items.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Line items</div>
                    <div className="rounded-xl border divide-y max-h-56 overflow-y-auto">
                      {viewingBill.items.map((item, index) => (
                        <div key={`${item.category}-${item.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.category} · {item.qty} × ₹{item.unit.toFixed(2)}</div>
                          </div>
                          <div className="shrink-0 tabular-nums text-sm">₹{(item.qty * item.unit).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(viewingBill.subtotal != null || viewingBill.discount != null || viewingBill.tax != null) && (
                  <dl className="space-y-1 border-t pt-3 text-sm">
                    <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">₹{(viewingBill.subtotal ?? viewingBill.amount).toFixed(2)}</dd></div>
                    <div className="flex justify-between text-muted-foreground"><dt>Discount</dt><dd className="tabular-nums">- ₹{(viewingBill.discount ?? 0).toFixed(2)}</dd></div>
                    <div className="flex justify-between text-muted-foreground"><dt>Tax</dt><dd className="tabular-nums">₹{(viewingBill.tax ?? 0).toFixed(2)}</dd></div>
                  </dl>
                )}
                <div className="flex justify-between rounded-xl bg-muted/40 px-3 py-2 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">₹{viewingBill.amount.toFixed(2)}</span>
                </div>

                {/* Notes section with post-creation editing for Clinical Admin & Receptionist */}
                <div className="rounded-xl border p-3 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Notes / Remarks</div>
                    {(user?.role === "clinic_admin" || user?.role === "receptionist" || user?.role === "super_admin") && !isEditingBillNotes && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 gap-1 text-primary hover:text-primary"
                        onClick={() => {
                          setBillNotesDraft(viewingBill.notes ?? "");
                          setIsEditingBillNotes(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        {viewingBill.notes ? "Edit note" : "Add note"}
                      </Button>
                    )}
                  </div>
                  {isEditingBillNotes ? (
                    <div className="space-y-2 pt-1">
                      <Textarea
                        placeholder="Add additional bill notes, remarks or payment adjustments..."
                        value={billNotesDraft}
                        onChange={(e) => setBillNotesDraft(e.target.value)}
                        className="text-xs min-h-[70px] resize-none"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2"
                          disabled={isSavingBillNotes}
                          onClick={() => {
                            setIsEditingBillNotes(false);
                            setBillNotesDraft("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs px-3"
                          disabled={isSavingBillNotes}
                          onClick={async () => {
                            setIsSavingBillNotes(true);
                            try {
                              await updateBillNotes(viewingBill.id, billNotesDraft);
                              setViewingBill(prev => prev ? { ...prev, notes: billNotesDraft.trim() || undefined } : null);
                              setIsEditingBillNotes(false);
                              toast.success("Bill notes updated successfully");
                            } catch (err: any) {
                              toast.error(err?.message || "Failed to update notes");
                            } finally {
                              setIsSavingBillNotes(false);
                            }
                          }}
                        >
                          {isSavingBillNotes ? "Saving..." : "Save note"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap italic">
                      {viewingBill.notes ? viewingBill.notes : "No notes added to this invoice yet."}
                    </p>
                  )}
                </div>
            </div>
          )}
          <DialogFooter>
            {canUseExternalSharing && (
              <Button variant="outline" onClick={() => viewingBill && shareBill(viewingBill)}>
                <Send className="mr-1.5 h-4 w-4" />Send on WhatsApp
              </Button>
            )}
            <Button onClick={() => {
              setViewingBill(null);
              setIsEditingBillNotes(false);
            }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingLab} onOpenChange={(o) => !o && setViewingLab(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewingLab?.test}</DialogTitle></DialogHeader>
          {viewingLab && (
            <div className="space-y-4 text-sm">
              <div className="text-xs text-muted-foreground font-mono">
                <span className="font-semibold text-primary">
                  {formatLabReportId(viewingLab.id, resolveClinicCode(viewingLab.clinicId || patient.clinicId, clinics, user?.clinicId))}
                </span>
                {" · "}{viewingLab.date}
                {viewingLab.prescriptionId ? ` · linked ${formatPrescriptionId(viewingLab.prescriptionId, resolveClinicCode(viewingLab.clinicId || patient.clinicId, clinics, user?.clinicId))}` : ""}
              </div>
              {viewingLab.fileName && (
                <div className="rounded-xl border bg-muted/30 p-4 flex items-center gap-3">
                  <FolderOpen className="h-6 w-6 text-primary" />
                  <div className="flex-1">
                    <div className="font-medium">{viewingLab.fileName}</div>
                    <div className="text-xs text-muted-foreground">Attached file</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadFile(viewingLab.fileName!, viewingLab.fileData)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />Download
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Result</div><div className="font-semibold">{viewingLab.result}</div></div>
                <div><div className="text-xs text-muted-foreground">Reference range</div><div>{viewingLab.reference}</div></div>
              </div>
              {viewingLab.notes && (
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Notes</div>
                  <div>{viewingLab.notes}</div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">Uploaded by {viewingLab.uploadedBy}</div>
            </div>
          )}
          <DialogFooter>
            {canUseExternalSharing && (
              <Button
                variant="outline"
                onClick={() =>
                  viewingLab &&
                  sendWhatsApp(
                    patient.phone,
                    `Lab report ${formatLabReportId(viewingLab.id, resolveClinicCode(viewingLab.clinicId || patient.clinicId, clinics, user?.clinicId))} — ${viewingLab.test}: ${viewingLab.result} (ref ${viewingLab.reference})`
                  )
                }
              >
                <Send className="mr-1.5 h-4 w-4" />Send on WhatsApp
              </Button>
            )}
            <Button onClick={() => setViewingLab(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to Trash Dialog */}
      <Dialog open={showTrashDialog} onOpenChange={setShowTrashDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Move Patient to Trash
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                Are you sure you want to move <strong className="text-foreground">{patient.name}</strong> to the Trash?
              </p>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-medium">Trash Retention Policy:</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Record is retained in Trash for <strong>10 days</strong> before permanent deletion can be performed.</li>
                  <li>After <strong>60 days</strong>, the item will be automatically purged from the system.</li>
                  <li>Can be restored back to active patients at any time prior to permanent deletion.</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrashDialog(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleTrashPatient} disabled={isDeleting}>
              {isDeleting ? "Moving to Trash..." : "Move to Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prescription Full Details Dialog */}
      <Dialog open={!!viewingRx} onOpenChange={(open) => !open && setViewingRx(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {viewingRx && (() => {
            const details = resolvePrescriptionDetails(viewingRx);
            const displayPatientId = formatPatientId(patient.id, patient.medicalRecordNumber, clinicCode);
            const displayRxId = formatPrescriptionId(viewingRx.id, clinicCode);
            return (
              <>
                <DialogHeader className="p-6 pb-4 border-b">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Prescription Details
                      </DialogTitle>
                      <DialogDescription className="font-mono text-xs mt-1">
                        {displayRxId} · Issued {viewingRx.date}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Meta details */}
                  <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/20 p-4">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Patient</div>
                      <div className="font-medium text-sm mt-0.5">{patient.name}</div>
                      <div className="font-mono text-xs font-semibold text-primary">{displayPatientId}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Doctor</div>
                      <div className="font-medium text-sm mt-0.5">{viewingRx.doctor}</div>
                      {viewingRx.followUp && (
                        <div className="text-xs text-info mt-0.5 font-medium">Follow-up: {viewingRx.followUp}</div>
                      )}
                    </div>
                  </div>

                  {/* Clinical Assessment Sections */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clinical Assessment & Notes</h4>

                    {/* Primary Illness / Reason */}
                    <div className="rounded-xl border bg-card p-4 shadow-xs">
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wide block mb-1">
                        Primary Illness / Reason / Diagnosis
                      </span>
                      <p className="text-sm font-semibold text-foreground whitespace-pre-wrap">
                        {details.primaryIllness}
                      </p>
                    </div>

                    {details.presentingComplaints && (
                      <div className="rounded-xl border bg-card p-4 shadow-xs">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          Presenting Complaints
                        </span>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {details.presentingComplaints}
                        </p>
                      </div>
                    )}

                    {details.pastIllnessHistory && (
                      <div className="rounded-xl border bg-card p-4 shadow-xs">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          History of Past Illness
                        </span>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {details.pastIllnessHistory}
                        </p>
                      </div>
                    )}

                    {details.clinicalFindings && (
                      <div className="rounded-xl border bg-card p-4 shadow-xs">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          Clinical Findings
                        </span>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {details.clinicalFindings}
                        </p>
                      </div>
                    )}

                    {details.treatmentNotes && (
                      <div className="rounded-xl border bg-card p-4 shadow-xs">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          Treatment Notes
                        </span>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {details.treatmentNotes}
                        </p>
                      </div>
                    )}

                    {details.additionalNotes && (
                      <div className="rounded-xl border bg-card p-4 shadow-xs">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          Additional Notes
                        </span>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {details.additionalNotes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Medicines List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prescribed Medicines</h4>
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="font-semibold text-xs">Medicine</TableHead>
                            <TableHead className="font-semibold text-xs">Dosage</TableHead>
                            <TableHead className="font-semibold text-xs">Frequency</TableHead>
                            <TableHead className="font-semibold text-xs">Duration</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewingRx.medicines.map((m, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium text-sm">{m.name}</TableCell>
                              <TableCell className="text-sm">{m.dosage}</TableCell>
                              <TableCell className="text-sm">{m.frequency}</TableCell>
                              <TableCell className="text-sm">{m.duration}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                <DialogFooter className="p-4 border-t bg-muted/10 flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => printRx(viewingRx)}>
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    Print
                  </Button>
                  {canUseExternalSharing && (
                    <Button variant="default" size="sm" onClick={() => shareRx(viewingRx)}>
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Send WhatsApp
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setViewingRx(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Patient Details Dialog */}
      <Dialog open={isEditingPatient} onOpenChange={setIsEditingPatient}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSavePatient}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Edit Patient Details
              </DialogTitle>
              <DialogDescription>
                Update demographic, contact and medical info for {patient.name} ({formatPatientId(patient.id, patient.medicalRecordNumber, clinicCode)}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Section 1: Personal information */}
              <section className="rounded-2xl border bg-card p-5 shadow-soft">
                <h3 className="mb-4 font-display text-sm font-semibold text-foreground">Personal information</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-name">Full name *</Label>
                    <Input
                      id="edit-name"
                      required
                      className="h-11 rounded-xl"
                      placeholder="Liam Andersson"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-dob">Date of birth</Label>
                    <Input
                      id="edit-dob"
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      className="h-11 rounded-xl"
                      value={editDateOfBirth}
                      onChange={(e) => setEditDateOfBirth(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-gender">Gender</Label>
                    <Select value={editGender} onValueChange={setEditGender}>
                      <SelectTrigger id="edit-gender" className="h-11 rounded-xl">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="unknown">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-blood-group">Blood group</Label>
                    <Select value={editBloodGroup} onValueChange={setEditBloodGroup}>
                      <SelectTrigger id="edit-blood-group" className="h-11 rounded-xl">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                          <SelectItem key={bg} value={bg}>
                            {bg}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Section 2: Contact */}
              <section className="rounded-2xl border bg-card p-5 shadow-soft">
                <h3 className="mb-4 font-display text-sm font-semibold text-foreground">Contact</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-phone">Phone *</Label>
                    <Input
                      id="edit-phone"
                      required
                      maxLength={40}
                      className="h-11 rounded-xl"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+91 …"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      maxLength={254}
                      className="h-11 rounded-xl"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="patient@example.com"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-whatsapp">WhatsApp</Label>
                    <Input
                      id="edit-whatsapp"
                      maxLength={40}
                      className="h-11 rounded-xl"
                      value={editWhatsappPhone}
                      onChange={(e) => setEditWhatsappPhone(e.target.value)}
                      placeholder="+91 …"
                    />
                  </div>
                  <div className="md:col-span-6 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-address">Address</Label>
                    <Textarea
                      id="edit-address"
                      maxLength={1000}
                      rows={2}
                      className="rounded-xl"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Residential address"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-emergency-name">Emergency contact name</Label>
                    <Input
                      id="edit-emergency-name"
                      maxLength={200}
                      className="h-11 rounded-xl"
                      value={editEmergencyName}
                      onChange={(e) => setEditEmergencyName(e.target.value)}
                      placeholder="Contact person name"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-emergency-phone">Emergency contact phone</Label>
                    <Input
                      id="edit-emergency-phone"
                      maxLength={40}
                      className="h-11 rounded-xl"
                      value={editEmergencyPhone}
                      onChange={(e) => setEditEmergencyPhone(e.target.value)}
                      placeholder="+91 …"
                    />
                  </div>
                </div>
              </section>

              {/* Section 3: Medical */}
              <section className="rounded-2xl border bg-card p-5 shadow-soft">
                <h3 className="mb-4 font-display text-sm font-semibold text-foreground">Medical</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-allergies">Allergies</Label>
                    <Input
                      id="edit-allergies"
                      maxLength={1000}
                      value={editAllergies}
                      onChange={(e) => setEditAllergies(e.target.value)}
                      className="h-11 rounded-xl"
                      placeholder="None / penicillin / …"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-chronic">Existing conditions</Label>
                    <Input
                      id="edit-chronic"
                      maxLength={1000}
                      value={editChronicConditions}
                      onChange={(e) => setEditChronicConditions(e.target.value)}
                      className="h-11 rounded-xl"
                      placeholder="Hypertension, asthma…"
                    />
                  </div>
                </div>
              </section>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingPatient(false)}
                disabled={isSavingPatient}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingPatient}>
                {isSavingPatient ? "Saving changes..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PatientDetail({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={emphasis ? "font-semibold text-destructive" : "font-medium"}>{value}</div>
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
      {label}
    </div>
  );
}
