import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData } from "@/lib/workspace-data";
import { hasPermission } from "@/lib/access-control";
import { Plus, FileText, Edit, Eye, Send, Printer } from "lucide-react";
import { PaginationFooter } from "@/components/data/pagination-footer";
import { useRecordPage } from "@/lib/use-record-page";
import { sendWhatsApp } from "@/lib/whatsapp";
import { printDocument } from "@/lib/exporters";
import { resolvePrescriptionDetails, formatPatientId, formatPrescriptionId } from "@/lib/prescription-fields";
import { toast } from "sonner";
import type { Prescription } from "@/lib/workspace-data";

export const Route = createFileRoute("/app/prescriptions/")({ component: PrescriptionsPage });

function PrescriptionsPage() {
  const { user } = useAuth();
  const { patients, getPatient, listPrescriptions } = useWorkspaceData();
  const {
    rows,
    total,
    limit,
    offset,
    setOffset,
    isLoading,
    error,
  } = useRecordPage(listPrescriptions);
  const canCreateRx = Boolean(user && hasPermission(user.role, "prescriptions.write"));
  const canEdit = canCreateRx;

  const [viewingRx, setViewingRx] = useState<Prescription | null>(null);

  const printRx = (rx: Prescription) => {
    const details = resolvePrescriptionDetails(rx);
    const displayPatientId = formatPatientId(rx.patientId, undefined, rx.clinicId || user?.clinicId);
    const displayRxId = formatPrescriptionId(rx.id, rx.clinicId || user?.clinicId);
    const primaryReason = details.primaryIllness || (rx.diagnosis && rx.diagnosis !== "Not recorded" ? rx.diagnosis : "");
    printDocument(`
      <h2>${user?.clinic ?? "ClinicFlow"}</h2>
      <div class="muted">Prescription ${displayRxId} · Issued on ${rx.date}</div>
      <div class="card">
        <div class="row"><b>Patient Name</b><span>${rx.patient} (${displayPatientId})</span></div>
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

  const shareRxWhatsApp = async (rx: Prescription) => {
    let p = patients.find(pt => pt.id === rx.patientId);
    if (!p) {
      try {
        p = (await getPatient(rx.patientId)) ?? undefined;
      } catch {
        // Ignore
      }
    }
    const targetPhone = p?.whatsappPhone?.trim() || "";
    if (!targetPhone) {
      toast.error("WhatsApp number is not available");
      return;
    }
    const details = resolvePrescriptionDetails(rx);
    const parts = [
      `Hi ${rx.patient}, prescription ${rx.id} (${rx.date}):`,
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
    toast.success(`Opening WhatsApp chat for ${rx.patient}`);
  };

  const activeDetails = viewingRx ? resolvePrescriptionDetails(viewingRx) : null;

  return (
    <>
      <PageHeader title="Prescriptions" description="Issued prescriptions and lab reports."
        actions={
          <div className="flex gap-2">
            {canCreateRx && (
              <Button asChild><Link to="/app/prescriptions/new"><Plus className="mr-1.5 h-4 w-4" />New prescription</Link></Button>
            )}
          </div>
        } />

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader><TableRow>
            <TableHead>RX</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Doctor</TableHead>
            <TableHead>Reason / Illness</TableHead>
            <TableHead className="text-right">Medicines</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading prescriptions...</TableCell></TableRow>
            )}
            {!isLoading && error && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-destructive">{error}</TableCell></TableRow>
            )}
            {!isLoading && !error && rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No prescriptions found.</TableCell></TableRow>
            )}
            {rows.map(r => {
              const details = resolvePrescriptionDetails(r);
              const displayReason = details.primaryIllness || r.diagnosis || "General Consultation";
              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setViewingRx(r)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2 font-mono text-xs font-semibold text-primary">
                      <FileText className="h-3.5 w-3.5 text-info" />
                      {formatPrescriptionId(r.id, r.clinicId || user?.clinicId)}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{r.patient}</TableCell>
                  <TableCell>{r.doctor}</TableCell>
                  <TableCell>
                    <div className="max-w-[280px]">
                      <span className="font-medium text-foreground block truncate" title={displayReason}>
                        {displayReason}
                      </span>
                      {details.presentingComplaints && details.presentingComplaints !== displayReason && (
                        <span className="text-xs text-muted-foreground block truncate" title={details.presentingComplaints}>
                          Complaints: {details.presentingComplaints}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.medicines.length}</TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewingRx(r)}
                        title="View prescription details"
                        aria-label={`View prescription ${r.id}`}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => printRx(r)}
                        title="Print prescription"
                        aria-label={`Print prescription ${r.id}`}
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => shareRxWhatsApp(r)}
                        title="Send on WhatsApp"
                        aria-label={`Send prescription ${r.id} on WhatsApp`}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      {canEdit && (
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/app/prescriptions/new" search={{ edit: r.id }}>
                            <Edit className="mr-1 h-3.5 w-3.5" />Edit
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <PaginationFooter
          offset={offset}
          limit={limit}
          total={total}
          onOffsetChange={setOffset}
          disabled={isLoading}
        />
      </div>

      {/* Prescription Full Details Dialog */}
      <Dialog open={!!viewingRx} onOpenChange={(open) => !open && setViewingRx(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {viewingRx && activeDetails && (
            <>
              <DialogHeader className="p-6 pb-4 border-b">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Prescription Details
                    </DialogTitle>
                    <DialogDescription className="font-mono text-xs mt-1">
                      {formatPrescriptionId(viewingRx.id, viewingRx.clinicId || user?.clinicId)} · Issued {viewingRx.date}
                    </DialogDescription>
                  </div>
                  </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Meta details */}
                  <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/20 p-4">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Patient</div>
                      <div className="font-medium text-sm mt-0.5">{viewingRx.patient}</div>
                      <div className="font-mono text-xs font-semibold text-primary">{formatPatientId(viewingRx.patientId, undefined, viewingRx.clinicId || user?.clinicId)}</div>
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
                      {activeDetails.primaryIllness}
                    </p>
                  </div>

                  {activeDetails.presentingComplaints && (
                    <div className="rounded-xl border bg-card p-4 shadow-xs">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                        Presenting Complaints
                      </span>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {activeDetails.presentingComplaints}
                      </p>
                    </div>
                  )}

                  {activeDetails.pastIllnessHistory && (
                    <div className="rounded-xl border bg-card p-4 shadow-xs">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                        History of Past Illness
                      </span>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {activeDetails.pastIllnessHistory}
                      </p>
                    </div>
                  )}

                  {activeDetails.clinicalFindings && (
                    <div className="rounded-xl border bg-card p-4 shadow-xs">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                        Clinical Findings
                      </span>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {activeDetails.clinicalFindings}
                      </p>
                    </div>
                  )}

                  {activeDetails.treatmentNotes && (
                    <div className="rounded-xl border bg-card p-4 shadow-xs">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                        Treatment Notes
                      </span>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {activeDetails.treatmentNotes}
                      </p>
                    </div>
                  )}

                  {activeDetails.additionalNotes && (
                    <div className="rounded-xl border bg-card p-4 shadow-xs">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                        Additional Notes
                      </span>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {activeDetails.additionalNotes}
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
                <Button variant="default" size="sm" onClick={() => shareRxWhatsApp(viewingRx)}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send WhatsApp
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setViewingRx(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

