import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PaginationFooter } from "@/components/data/pagination-footer";
import {
  useWorkspaceData,
  type Bill,
  type LabReport,
  type Patient,
  type Prescription,
} from "@/lib/workspace-data";
import { printDocument } from "@/lib/exporters";
import { sendWhatsApp } from "@/lib/whatsapp";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/access-control";
import {
  Phone, MessageCircle, Calendar, FileText, Receipt,
  FolderOpen, FlaskConical, Download, Send, Printer, Edit, Eye,
} from "lucide-react";
import { useRecordPage } from "@/lib/use-record-page";

export const Route = createFileRoute("/app/patients/$id")({
  component: PatientProfile,
});

function PatientProfile() {
  const { user } = useAuth();
  const { id } = Route.useParams();
  const {
    patients,
    getPatient,
    listAppointments,
    listPrescriptions,
    listLabReports,
    listBills,
  } = useWorkspaceData();
  const snapshotPatient = patients.find(candidate => candidate.id === id);
  const [loadedPatient, setLoadedPatient] = useState<Patient | null>(null);
  const [recordLoading, setRecordLoading] = useState(!snapshotPatient);
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);
  const [viewingLab, setViewingLab] = useState<LabReport | null>(null);
  const patient = snapshotPatient ?? loadedPatient;
  const visitsPage = useRecordPage(listAppointments, { patientId: id });
  const prescriptionsPage = useRecordPage(listPrescriptions, { patientId: id });
  const billsPage = useRecordPage(listBills, { patientId: id });
  const labsPage = useRecordPage(listLabReports, { patientId: id });
  const visits = visitsPage.rows;
  const myRx = prescriptionsPage.rows;
  const myBills = billsPage.rows;
  const myLabs = labsPage.rows;

  useEffect(() => {
    if (snapshotPatient) {
      setRecordLoading(false);
      return;
    }
    let current = true;
    setRecordLoading(true);
    void getPatient(id)
      .then((result) => {
        if (current) setLoadedPatient(result);
      })
      .catch(() => {
        if (current) setLoadedPatient(null);
      })
      .finally(() => {
        if (current) setRecordLoading(false);
      });
    return () => {
      current = false;
    };
  }, [getPatient, id, snapshotPatient]);

  if (recordLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading patient record…</div>;
  }
  if (!patient) throw notFound();

  const canEditRx = Boolean(user && hasPermission(user.role, "prescriptions.write"));
  const canAddLab = Boolean(user && hasPermission(user.role, "labs.write"));
  const canBook = Boolean(user && hasPermission(user.role, "appointments.create"));

  const printRx = (rx: Prescription) => {
    printDocument(`
      <h2>${user?.clinic ?? "ClinicFlow"}</h2>
      <div class="muted">Prescription ${rx.id} · ${rx.date}</div>
      <div class="card">
        <div class="row"><b>Patient</b><span>${patient.name} (${patient.id})</span></div>
        <div class="row"><b>Doctor</b><span>${rx.doctor}</span></div>
        <div class="row"><b>Diagnosis</b><span>${rx.diagnosis}</span></div>
        ${rx.followUp ? `<div class="row"><b>Follow-up</b><span>${rx.followUp}</span></div>` : ""}
      </div>
      <h3>Medicines</h3>
      <table><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
      <tbody>${rx.medicines.map(m => `<tr><td>${m.name}</td><td>${m.dosage}</td><td>${m.frequency}</td><td>${m.duration}</td></tr>`).join("")}</tbody></table>
    `, `Prescription ${rx.id}`);
  };

  const shareRx = (rx: Prescription) => {
    const msg = `Hi ${patient.name}, prescription ${rx.id} (${rx.date}):\nDiagnosis: ${rx.diagnosis}\n${rx.medicines.map(m => `• ${m.name} — ${m.dosage} ${m.frequency} × ${m.duration}`).join("\n")}`;
    sendWhatsApp(patient.phone, msg);
  };

  return (
    <>
      <PageHeader title={patient.name} description={`Patient ID ${patient.medicalRecordNumber ?? patient.id}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEditRx && <Button asChild variant="outline"><Link to="/app/prescriptions/new">New prescription</Link></Button>}
            {canBook && <Button asChild><Link to="/app/appointments/new">Book follow-up</Link></Button>}
          </div>
        } />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-info text-primary-foreground text-xl font-bold">
              {patient.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-bold">{patient.name}</div>
              <div className="text-xs text-muted-foreground">{patient.age} y · {patient.gender}</div>
              <Badge variant="outline" className="mt-1">{patient.status}</Badge>
            </div>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> <span>{patient.phone}</span></div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <button className="hover:underline text-left" onClick={() => sendWhatsApp(patient.phone, `Hello ${patient.name}, this is ${user?.clinic}.`)}>
                {patient.phone} (WhatsApp)
              </button>
            </div>
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> <span>Last visit {patient.lastVisit}</span></div>
          </dl>
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
              {myRx.map(r => (
                <div key={r.id} className="rounded-2xl border bg-card p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{r.id} · {r.date}</div>
                      <div className="font-display text-base font-semibold">{r.diagnosis}</div>
                      <div className="text-xs text-muted-foreground">{r.doctor}{r.followUp ? ` · Follow-up ${r.followUp}` : ""}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => printRx(r)} aria-label={`Print ${r.id}`} title={`Print ${r.id}`}><Printer className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => shareRx(r)} aria-label={`Share ${r.id}`} title={`Share ${r.id}`}><Send className="h-3.5 w-3.5" /></Button>
                      {canEditRx && <Button asChild size="sm" variant="ghost">
                        <Link to="/app/prescriptions/new" search={{ edit: r.id }} aria-label={`Edit ${r.id}`} title={`Edit ${r.id}`}><Edit className="h-3.5 w-3.5" /></Link>
                      </Button>}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {r.medicines.map((m, i) => (
                      <li key={i} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-muted-foreground text-xs"> — {m.dosage} · {m.frequency} · {m.duration}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
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
                      <div className="font-mono text-xs text-muted-foreground">{l.id} · {l.date}{l.prescriptionId ? ` · linked ${l.prescriptionId}` : ""}</div>
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
                      <TableCell className="font-mono text-xs">{b.id}</TableCell>
                      <TableCell>{b.date}</TableCell>
                      <TableCell className="text-right tabular-nums">₹{b.amount.toFixed(2)}</TableCell>
                      <TableCell><Badge variant={b.status === "Paid" ? "secondary" : b.status === "Overdue" ? "destructive" : "outline"}>{b.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setViewingBill(b); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
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
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Doctor</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {visitsPage.isLoading && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Loading visits...</TableCell></TableRow>}
                  {!visitsPage.isLoading && visitsPage.error && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-destructive">{visitsPage.error}</TableCell></TableRow>}
                  {!visitsPage.isLoading && !visitsPage.error && (visits.length ? visits.map(v => (
                    <TableRow key={v.id}><TableCell>{v.date} · {v.time}</TableCell><TableCell>{v.doctor}</TableCell><TableCell>{v.type}</TableCell><TableCell><Badge variant="secondary">{v.status}</Badge></TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No visits yet</TableCell></TableRow>)}
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

            <TabsContent value="docs" className="mt-4 rounded-2xl border bg-card p-8 text-center shadow-soft">
              <FolderOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Uploaded documents appear here.</p>
              <Button asChild variant="outline" className="mt-3"><Link to="/app/files">Open file manager</Link></Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={!!viewingBill} onOpenChange={(o) => !o && setViewingBill(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invoice {viewingBill?.id}</DialogTitle></DialogHeader>
          {viewingBill && (() => {
            const linkedRx = null as Prescription | null;
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-xs text-muted-foreground">Patient</div><div className="font-semibold">{viewingBill.patient}</div></div>
                  <div><div className="text-xs text-muted-foreground">Date</div><div>{viewingBill.date}</div></div>
                  <div><div className="text-xs text-muted-foreground">Method</div><div>{viewingBill.method}</div></div>
                  <div><div className="text-xs text-muted-foreground">Status</div>
                    <Badge variant={viewingBill.status === "Paid" ? "secondary" : viewingBill.status === "Overdue" ? "destructive" : "outline"}>{viewingBill.status}</Badge>
                  </div>
                </div>
                {linkedRx && (
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Medicines ({linkedRx.id} — {linkedRx.diagnosis})</div>
                    <div className="rounded-xl border divide-y">
                      {linkedRx.medicines.map((m, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2">
                          <div>
                            <div className="font-medium">{m.name}</div>
                            <div className="text-xs text-muted-foreground">{m.dosage} · {m.frequency} · {m.duration}</div>
                          </div>
                          <div className="tabular-nums text-sm">₹{(m.unitPrice ?? 0).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between rounded-xl bg-muted/40 px-3 py-2 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">₹{viewingBill.amount.toFixed(2)}</span>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => viewingBill && sendWhatsApp(patient.phone, `Invoice ${viewingBill.id} — ₹${viewingBill.amount.toFixed(2)} (${viewingBill.status})`)}>
              <Send className="mr-1.5 h-4 w-4" />Send on WhatsApp
            </Button>
            <Button onClick={() => setViewingBill(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingLab} onOpenChange={(o) => !o && setViewingLab(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewingLab?.test}</DialogTitle></DialogHeader>
          {viewingLab && (
            <div className="space-y-4 text-sm">
              <div className="text-xs text-muted-foreground font-mono">{viewingLab.id} · {viewingLab.date}{viewingLab.prescriptionId ? ` · linked ${viewingLab.prescriptionId}` : ""}</div>
              {viewingLab.fileName && (
                <div className="rounded-xl border bg-muted/30 p-4 flex items-center gap-3">
                  <FolderOpen className="h-6 w-6 text-primary" />
                  <div className="flex-1">
                    <div className="font-medium">{viewingLab.fileName}</div>
                    <div className="text-xs text-muted-foreground">Attached file</div>
                  </div>
                  <Button size="sm" variant="outline"><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button>
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
            <Button variant="outline" onClick={() => viewingLab && sendWhatsApp(patient.phone, `Lab report ${viewingLab.id} — ${viewingLab.test}: ${viewingLab.result} (ref ${viewingLab.reference})`)}>
              <Send className="mr-1.5 h-4 w-4" />Send on WhatsApp
            </Button>
            <Button onClick={() => setViewingLab(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
      {label}
    </div>
  );
}
