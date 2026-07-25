import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityPicker, toPatientOptions, toDoctorOptions, type PatientOption, type DoctorOption } from "@/components/forms/entity-picker";
import { useAuth } from "@/lib/auth";
import { type LabReport } from "@/lib/sample-data";
import { useWorkspaceData } from "@/lib/workspace-data";
import { Activity, Plus, Trash2, Send, Printer, FlaskConical, Upload } from "lucide-react";
import { sendWhatsApp } from "@/lib/whatsapp";
import { printDocument } from "@/lib/exporters";
import { toast } from "sonner";

type PrescriptionSearch = {
  edit?: string;
  mode?: "lab";
  patient?: string;
};

export const Route = createFileRoute("/app/prescriptions/new")({
  component: NewPrescription,
  validateSearch: (s: Record<string, unknown>): PrescriptionSearch => {
    const search: PrescriptionSearch = {};
    if (typeof s.edit === "string") search.edit = s.edit;
    if (s.mode === "lab") search.mode = "lab";
    if (typeof s.patient === "string") search.patient = s.patient;
    return search;
  },
});

type Med = { name: string; dosage: string; frequency: string; duration: string };

function NewPrescription() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    patients, doctors, prescriptions, labReports, savePrescription, saveLabReports,
  } = useWorkspaceData();
  const patientOptions = toPatientOptions(patients);
  const doctorOptions = toDoctorOptions(doctors);
  const { edit, mode, patient: patientParam } = Route.useSearch();
  const isReceptionist = user?.role === "receptionist";
  const isLabMode = mode === "lab";
  const patientLocked = Boolean(patientParam);

  const seed = useMemo(() => edit ? prescriptions.find(p => p.id === edit) : undefined, [edit, prescriptions]);
  const isDoctor = user?.role === "doctor";
  const isOwnRx = !seed || (isDoctor && seed.doctor === user?.name);

  const [patient, setPatient] = useState<PatientOption | null>(
    patientParam
      ? patientOptions.find(p => p.id === patientParam) ?? null
      : seed ? patientOptions.find(p => p.id === seed.patientId) ?? null : null
  );
  const [doctor, setDoctor] = useState<DoctorOption | null>(
    seed
      ? doctorOptions.find(d => d.raw.name === seed.doctor) ?? null
      : isDoctor ? doctorOptions.find(d => d.raw.name === user?.name) ?? null : null
  );
  const [diagnosis, setDiagnosis] = useState(seed?.diagnosis ?? (isLabMode ? "" : "Seasonal allergic rhinitis"));
  const [notes, setNotes] = useState(seed?.notes ?? (isLabMode ? "" : "Rest and hydration. Avoid known triggers."));
  const [followup, setFollowup] = useState(seed?.followUp ?? "");
  const [meds, setMeds] = useState<Med[]>(
    seed?.medicines.map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration })) ??
    (isLabMode ? [] : [{ name: "Amoxicillin 500 mg", dosage: "1 tab", frequency: "3× per day", duration: "5 days" }])
  );
  const [labs, setLabs] = useState<LabReport[]>(
    edit ? labReports.filter(l => l.prescriptionId === edit) : []
  );
  const [newLab, setNewLab] = useState({ test: "", result: "", reference: "", notes: "" });

  const update = (i: number, k: keyof Med, v: string) =>
    setMeds(meds.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)));

  const addLab = () => {
    if (!newLab.test.trim()) { toast.error("Test name required"); return; }
    const id = `LR-${2300 + labs.length + 1}`;
    setLabs([...labs, {
      id, prescriptionId: edit ?? "RX-DRAFT",
      patient: patient?.primary ?? "", patientId: patient?.id ?? "",
      test: newLab.test, date: new Date().toISOString().slice(0, 10),
      result: newLab.result, reference: newLab.reference, notes: newLab.notes,
      uploadedBy: user?.name ?? "User",
    }]);
    setNewLab({ test: "", result: "", reference: "", notes: "" });
    toast.success("Lab report added");
  };

  const uploadLab = (file: File) => {
    const id = `LR-${2300 + labs.length + 1}`;
    setLabs([...labs, {
      id, prescriptionId: edit ?? "RX-DRAFT",
      patient: patient?.primary ?? "", patientId: patient?.id ?? "",
      test: file.name.replace(/\.[^.]+$/, ""), date: new Date().toISOString().slice(0, 10),
      result: "Attached PDF", reference: "See attached", fileName: file.name,
      uploadedBy: user?.name ?? "User",
    }]);
    toast.success(`Uploaded ${file.name}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReceptionist && !isLabMode) return; // guard
    if (!isOwnRx) { toast.error("You can only edit prescriptions you issued"); return; }
    if (!patient) { toast.error("Please select a patient"); return; }
    if (isLabMode) {
      if (labs.length === 0) { toast.error("Add at least one lab report"); return; }
      saveLabReports(labs);
      toast.success("Lab report saved");
      navigate({ to: "/app/patients/$id", params: { id: patient.id } });
      return;
    }
    if (!doctor) { toast.error("Please select a doctor"); return; }
    if (!diagnosis.trim()) { toast.error("Diagnosis is required"); return; }
    if (meds.length === 0 || !meds[0].name.trim()) { toast.error("Add at least one medicine"); return; }
    const saved = savePrescription({
      id: edit,
      patientId: patient.id,
      doctorId: doctor.id,
      diagnosis: diagnosis.trim(),
      notes: notes.trim() || undefined,
      followUp: followup || undefined,
      medicines: meds,
    });
    if (labs.length) {
      saveLabReports(labs.map(report => ({
        ...report,
        prescriptionId: saved.id,
        patient: patient.primary,
        patientId: patient.id,
      })));
    }
    toast.success(edit ? "Prescription updated" : `Prescription ${saved.id} saved`);
    navigate({ to: "/app/prescriptions" });
  };

  const printRx = () => {
    printDocument(`
      <h2>${user?.clinic ?? "ClinicFlow"}</h2>
      <div class="muted">Prescription · ${new Date().toLocaleDateString()}</div>
      <div class="card">
        <div class="row"><b>Patient</b><span>${patient?.primary ?? "—"} (${patient?.id ?? ""})</span></div>
        <div class="row"><b>Doctor</b><span>${doctor?.primary ?? "—"}</span></div>
        <div class="row"><b>Diagnosis</b><span>${diagnosis}</span></div>
        ${followup ? `<div class="row"><b>Follow-up</b><span>${followup}</span></div>` : ""}
      </div>
      <h3>Medicines</h3>
      <table><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
        <tbody>${meds.map(m => `<tr><td>${m.name}</td><td>${m.dosage}</td><td>${m.frequency}</td><td>${m.duration}</td></tr>`).join("")}</tbody></table>
      ${notes ? `<div class="card"><b>Notes:</b> ${notes}</div>` : ""}
    `, `Prescription ${edit ?? ""}`);
  };

  const shareRx = () => {
    if (!patient) return;
    const msg = `Hi ${patient.primary}, here is your prescription from ${user?.clinic}.\nDiagnosis: ${diagnosis}\nMedicines:\n${meds.map(m => `• ${m.name} — ${m.dosage} ${m.frequency} × ${m.duration}`).join("\n")}${followup ? `\nFollow-up: ${followup}` : ""}`;
    sendWhatsApp(patient.tertiary ?? "", msg);
  };

  return (
    <>
      {!isLabMode && !isDoctor ? (
        <>
          <PageHeader title="Prescription access restricted" description="Only doctors can create or edit prescriptions. Use lab mode to attach reports." />
          <Button variant="outline" onClick={() => navigate({ to: "/app/prescriptions" })}>Back to prescriptions</Button>
        </>
      ) : (
      <>
      <PageHeader
        title={edit ? `Edit ${edit}` : isLabMode ? "Add lab report" : isReceptionist ? "Lab report" : "New prescription"}
        description={
          isLabMode
            ? "Attach a lab report to this patient. Doctor is optional."
            : isReceptionist
              ? "You can add or upload lab reports to a prescription."
              : "Compose, sign and share a prescription."
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={onSubmit} className="lg:col-span-3 space-y-6">
          <fieldset disabled={isReceptionist && !isLabMode} className="space-y-6 disabled:opacity-70">
            <section className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
              <div className="space-y-1.5">
                <Label>Patient <span className="text-destructive">*</span></Label>
                {patientLocked && patient ? (
                  <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{patient.primary}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{patient.id}</span>
                        {patient.secondary ? <> · {patient.secondary}</> : null}
                        {patient.tertiary ? <> · {patient.tertiary}</> : null}
                      </div>
                    </div>
                    <span className="ml-2 rounded-md bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Locked</span>
                  </div>
                ) : (
                  <EntityPicker options={patientOptions} value={patient} onChange={setPatient}
                    placeholder="Search by name, patient ID or phone…" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>
                  Doctor {isLabMode ? <span className="text-xs text-muted-foreground font-normal">(optional — leave empty if not assigned)</span> : <span className="text-destructive">*</span>}
                </Label>
                {isDoctor && !isLabMode && doctor ? (
                  <div className="rounded-xl border bg-muted/40 px-3 py-2.5">
                    <div className="text-sm font-semibold">{doctor.primary}</div>
                    <div className="text-xs text-muted-foreground">{doctor.id} · signed-in doctor</div>
                  </div>
                ) : (
                  <EntityPicker options={doctorOptions} value={doctor} onChange={setDoctor}
                    placeholder={isLabMode ? "Search doctor name (optional)…" : "Search by name, doctor ID or phone…"} />
                )}
                {isLabMode && doctor && (
                  <button type="button" onClick={() => setDoctor(null)}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                    Clear doctor
                  </button>
                )}
              </div>
              {!isLabMode && (
                <>
                  <div className="space-y-1.5"><Label>Diagnosis <span className="text-destructive">*</span></Label>
                    <Input className="h-11 rounded-xl" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
                  </div>
                  <div className="space-y-1.5"><Label>Treatment notes</Label>
                    <Textarea rows={3} className="rounded-xl" value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                  <div className="space-y-1.5"><Label>Follow-up date</Label>
                    <Input type="date" className="h-11 rounded-xl" value={followup} onChange={e => setFollowup(e.target.value)} />
                  </div>
                </>
              )}
            </section>

            {!isLabMode && (
              <section className="rounded-2xl border bg-card p-6 shadow-soft">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold">Medicines</h2>
                  <Button type="button" size="sm" variant="outline" onClick={() => setMeds([...meds, { name: "", dosage: "", frequency: "", duration: "" }])}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add medicine
                  </Button>
                </div>
                <div className="space-y-3">
                  {meds.map((m, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border bg-muted/30 p-3 md:grid-cols-[2fr_1fr_1.2fr_1fr_auto]">
                      <Input placeholder="Medicine" className="h-10 rounded-lg" value={m.name} onChange={e => update(i, "name", e.target.value)} />
                      <Input placeholder="Dosage" className="h-10 rounded-lg" value={m.dosage} onChange={e => update(i, "dosage", e.target.value)} />
                      <Input placeholder="Frequency" className="h-10 rounded-lg" value={m.frequency} onChange={e => update(i, "frequency", e.target.value)} />
                      <Input placeholder="Duration" className="h-10 rounded-lg" value={m.duration} onChange={e => update(i, "duration", e.target.value)} />
                      <Button type="button" variant="ghost" size="icon"
                        aria-label={`Remove ${m.name || "medicine"}`} title="Remove medicine"
                        onClick={() => setMeds(meds.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </fieldset>

          {/* Lab reports — accessible by everyone */}
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-info" />Lab reports
              </h2>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="file" accept="application/pdf,image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadLab(f); e.currentTarget.value = ""; }} />
                <span className="inline-flex items-center rounded-md border h-8 px-3 text-xs font-medium hover:bg-muted">
                  <Upload className="mr-1 h-3.5 w-3.5" /> Upload file
                </span>
              </label>
            </div>

            {labs.length > 0 && (
              <div className="space-y-2 mb-4">
                {labs.map(l => (
                  <div key={l.id} className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{l.test}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {l.fileName ? `📎 ${l.fileName}` : `${l.result} · ref ${l.reference}`} · by {l.uploadedBy}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="ghost"
                      onClick={() => patient && sendWhatsApp(patient.tertiary ?? "", `Lab report — ${l.test}: ${l.result} (ref ${l.reference})`)}>
                      <Send className="mr-1 h-3.5 w-3.5" />WhatsApp
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Create structured report</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Test name" className="h-10 rounded-lg" value={newLab.test} onChange={e => setNewLab({ ...newLab, test: e.target.value })} />
                <Input placeholder="Result" className="h-10 rounded-lg" value={newLab.result} onChange={e => setNewLab({ ...newLab, result: e.target.value })} />
                <Input placeholder="Reference range" className="h-10 rounded-lg" value={newLab.reference} onChange={e => setNewLab({ ...newLab, reference: e.target.value })} />
                <Input placeholder="Notes" className="h-10 rounded-lg" value={newLab.notes} onChange={e => setNewLab({ ...newLab, notes: e.target.value })} />
              </div>
              <Button type="button" size="sm" onClick={addLab}><Plus className="mr-1 h-3.5 w-3.5" />Add lab report</Button>
            </div>
          </section>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1"
              onClick={() => navigate(patientLocked && patient ? { to: "/app/patients/$id", params: { id: patient.id } } : { to: "/app/prescriptions" })}>
              Cancel
            </Button>
            {isLabMode
              ? <Button type="submit" className="flex-1">Save lab report</Button>
              : !isReceptionist
                ? <Button type="submit" className="flex-1">{edit ? "Save changes" : "Save & sign"}</Button>
                : <Button type="button" className="flex-1" onClick={() => { toast.success("Lab reports saved"); navigate({ to: "/app/prescriptions" }); }}>Save lab reports</Button>}
          </div>
        </form>

        {/* Preview */}
        <aside className="lg:col-span-2">
          <div className="sticky top-24 rounded-2xl border bg-card p-6 shadow-card">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground">
                <Activity className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div>
                <div className="font-display text-base font-bold">{user?.clinic}</div>
                <div className="text-xs text-muted-foreground">Prescription preview</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><div className="text-muted-foreground">Patient</div><div className="font-semibold">{patient?.primary ?? "—"}</div></div>
              <div><div className="text-muted-foreground">Patient ID</div><div className="font-mono">{patient?.id ?? "—"}</div></div>
              <div><div className="text-muted-foreground">Age / Gender</div><div>{patient?.secondary ?? "—"}</div></div>
              <div><div className="text-muted-foreground">Date</div><div>{new Date().toISOString().slice(0, 10)}</div></div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Diagnosis</div>
              <div className="mt-1 text-sm">{diagnosis}</div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rx</div>
              <ol className="mt-1 space-y-1.5 text-sm">
                {meds.map((m, i) => (
                  <li key={i} className="rounded-lg bg-muted/40 px-3 py-2">
                    <div className="font-semibold">{m.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{m.dosage} · {m.frequency} · {m.duration}</div>
                  </li>
                ))}
              </ol>
            </div>
            {followup && <div className="mt-3 text-sm"><span className="text-muted-foreground">Follow-up:</span> <span className="font-semibold">{followup}</span></div>}
            <div className="mt-6 flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={printRx}>
                <Printer className="mr-1 h-3.5 w-3.5" />Download
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={shareRx}>
                <Send className="mr-1 h-3.5 w-3.5" />WhatsApp
              </Button>
            </div>
          </div>
        </aside>
      </div>
      </>
      )}
    </>
  );
}
