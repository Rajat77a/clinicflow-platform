import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EntityPicker, toPatientOptions, type PatientOption } from "@/components/forms/entity-picker";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData, getStoredStaffDetails, type Prescription } from "@/lib/workspace-data";
import { sendWhatsApp, formatBillWhatsAppMessage } from "@/lib/whatsapp";
import { printDocument } from "@/lib/exporters";
import { formatPatientId, formatBillCopyText, formatPrescriptionId, formatInvoiceId, resolveClinicCode } from "@/lib/prescription-fields";
import { Plus, Trash2, Send, Printer, Pill, Copy, Receipt } from "lucide-react";
import { toast } from "sonner";

type NewBillSearch = {
  patient?: string;
};

export const Route = createFileRoute("/app/billing/new")({
  component: NewBill,
  validateSearch: (s: Record<string, unknown>): NewBillSearch => {
    const search: NewBillSearch = {};
    if (typeof s.patient === "string") search.patient = s.patient;
    return search;
  },
});

type Cat = "Consultation" | "Procedure" | "Medicine" | "Lab" | "Other";
type Line = { id: string; category: Cat; name: string; qty: number; unit: number };

const CATS: Cat[] = ["Consultation", "Procedure", "Medicine", "Lab", "Other"];

function NewBill() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user } = useAuth();
  const { patients, doctors, prescriptions, searchPatients, getPatient, createBill, listPrescriptions, clinics } = useWorkspaceData();
  const patientOptions = toPatientOptions(patients);
  const searchPatientOptions = useCallback(
    async (query: string) =>
      toPatientOptions((await searchPatients({ query, limit: 12 })).rows),
    [searchPatients],
  );
  const [patient, setPatient] = useState<PatientOption | null>(() => {
    if (search.patient) {
      const match = patients.find((p) => p.id === search.patient);
      if (match) return toPatientOption(match);
    }
    return null;
  });
  const resolveDoctorFee = (docName?: string): { doctorName: string; fee: number } => {
    if (!docName) return { doctorName: "Doctor", fee: 0 };
    const cleanDocName = docName.replace(/^Dr\.?\s+/i, "").trim().toLowerCase();
    const foundDoc = doctors.find((d) => {
      const dNameClean = (d.name || "").replace(/^Dr\.?\s+/i, "").trim().toLowerCase();
      return d.name === docName || d.name?.toLowerCase() === docName.toLowerCase() || (cleanDocName && dNameClean === cleanDocName);
    });

    if (foundDoc?.consultationFee != null && Number(foundDoc.consultationFee) > 0) {
      return { doctorName: foundDoc.name, fee: Number(foundDoc.consultationFee) };
    }

    const stored = getStoredStaffDetails(foundDoc?.id || cleanDocName, foundDoc?.email || docName);
    if (stored?.consultationFee != null && Number(stored.consultationFee) > 0) {
      return { doctorName: stored.name || foundDoc?.name || docName, fee: Number(stored.consultationFee) };
    }

    if (typeof window !== "undefined") {
      try {
        const rawMap = localStorage.getItem("cf_staff_profile_details");
        if (rawMap) {
          const map = JSON.parse(rawMap);
          for (const val of Object.values(map) as any[]) {
            const valNameClean = (val?.name || "").replace(/^Dr\.?\s+/i, "").trim().toLowerCase();
            if (cleanDocName && (valNameClean === cleanDocName || val?.name?.toLowerCase() === docName.toLowerCase())) {
              if (val?.consultationFee != null && Number(val.consultationFee) > 0) {
                return { doctorName: val.name || docName, fee: Number(val.consultationFee) };
              }
            }
          }
        }

        // Check any doctor profile in localStorage (e.g. cf_profile_doctor_<id/email>)
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("cf_profile_doctor_") || key.startsWith("cf_profile_"))) {
            try {
              const item = JSON.parse(localStorage.getItem(key) || "{}");
              const itemNameClean = (item?.name || "").replace(/^Dr\.?\s+/i, "").trim().toLowerCase();
              if (
                item?.consultationFee != null &&
                Number(item.consultationFee) > 0 &&
                (itemNameClean === cleanDocName || item?.name?.toLowerCase() === docName.toLowerCase())
              ) {
                return { doctorName: item.name || foundDoc?.name || docName, fee: Number(item.consultationFee) };
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // Fallback: If only 1 doctor has a set consultation fee in doctors or storage, or active user is the doctor
    if (user?.role === "doctor" && (user?.name?.toLowerCase() === docName.toLowerCase() || (user?.name || "").replace(/^Dr\.?\s+/i, "").trim().toLowerCase() === cleanDocName)) {
      const userCached = getStoredStaffDetails(user.userId, user.email);
      if (userCached?.consultationFee != null && Number(userCached.consultationFee) > 0) {
        return { doctorName: userCached.name || user.name || docName, fee: Number(userCached.consultationFee) };
      }
    }

    return { doctorName: foundDoc?.name || docName, fee: 0 };
  };

  const getInitialLines = (currentPatient: PatientOption | null): Line[] => {
    if (!currentPatient) {
      return [
        {
          id: crypto.randomUUID(),
          category: "Consultation",
          name: "Doctor consultation",
          qty: 1,
          unit: 0,
        },
      ];
    }
    const { doctorName, fee } = resolveDoctorFee(currentPatient.raw.doctor);
    return [
      {
        id: crypto.randomUUID(),
        category: "Consultation",
        name: doctorName ? `${doctorName} consultation` : "Doctor consultation",
        qty: 1,
        unit: fee,
      },
    ];
  };

  const [lines, setLines] = useState<Line[]>(() => getInitialLines(patient));
  useEffect(() => {
    if (search.patient && !patient) {
      const match = patients.find((p) => p.id === search.patient);
      if (match) {
        selectPatient(toPatientOption(match));
      }
    }
  }, [search.patient, patients]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const selectPatient = (nextPatient: PatientOption | null) => {
    setPatient(nextPatient);
    if (!nextPatient) return;

    const assignedDoctor = doctors.find(
      (doctor) => doctor.name === nextPatient.raw.doctor && doctor.status === "Active",
    );
    const { doctorName, fee } = resolveDoctorFee(nextPatient.raw.doctor);
    const consultationFee = fee > 0
      ? fee
      : (assignedDoctor?.consultationFee != null && assignedDoctor.consultationFee > 0 ? assignedDoctor.consultationFee : 0);

    setLines((current) => {
      const consultationIndex = current.findIndex((line) => line.category === "Consultation");
      const consultation: Line = {
        id: consultationIndex >= 0
          ? current[consultationIndex].id
          : crypto.randomUUID(),
        category: "Consultation",
        name: doctorName ? `${doctorName} consultation` : "Doctor consultation",
        qty: 1,
        unit: consultationFee,
      };
      if (assignedDoctor?.consultationFee == null && consultationFee === 0) {
        // If consultation fee was not entered, keep unit at 0 (displayed as blank)
      }
      if (consultationIndex < 0) return [consultation, ...current];
      return current.map((line, index) => index === consultationIndex ? consultation : line);
    });
  };

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit, 0);
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxableAmount * tax) / 100;
  const total = taxableAmount + taxAmount;
  const bySection = useMemo(() => {
    const m: Record<string, Line[]> = {};
    lines.forEach(l => { (m[l.category] = m[l.category] || []).push(l); });
    return m;
  }, [lines]);

  const addLine = (cat: Cat = "Other") =>
    setLines([...lines, { id: crypto.randomUUID(), category: cat, name: "", qty: 1, unit: 0 }]);

  const updateLine = (id: string, patch: Partial<Line>) =>
    setLines(lines.map(l => l.id === id ? { ...l, ...patch } : l));

  const removeLine = (id: string) => setLines(lines.filter(l => l.id !== id));

  const [loadedRxs, setLoadedRxs] = useState<Prescription[]>([]);
  useEffect(() => {
    if (!patient) {
      setLoadedRxs([]);
      return;
    }
    let current = true;
    void listPrescriptions({ patientId: patient.id }).then((res) => {
      if (current) setLoadedRxs(res.rows);
    });
    return () => { current = false; };
  }, [listPrescriptions, patient]);

  const patientRxs = useMemo(() => {
    if (!patient) return [];
    return loadedRxs.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateDiff !== 0 ? dateDiff : b.id.localeCompare(a.id);
    });
  }, [patient, loadedRxs]);

  const importFromRx = (rx: Prescription) => {
    const medLines: Line[] = rx.medicines.map((m) => ({
      id: crypto.randomUUID(), category: "Medicine", name: m.name, qty: 1, unit: m.unitPrice ?? 0,
    }));

    const docTarget = rx.doctor || patient?.raw?.doctor || "";
    const { doctorName, fee } = resolveDoctorFee(docTarget);
    const doctorDisplayName = doctorName || docTarget || "Doctor";

    setLines((current) => {
      const consultationIndex = current.findIndex((line) => line.category === "Consultation");
      const consultationLine: Line = {
        id: consultationIndex >= 0 ? current[consultationIndex].id : crypto.randomUUID(),
        category: "Consultation",
        name: `${doctorDisplayName} consultation`,
        qty: 1,
        unit: fee,
      };

      if (consultationIndex >= 0) {
        // Update existing consultation line with the doctor fee and name, and append medicine lines
        return current
          .map((line, idx) => (idx === consultationIndex ? consultationLine : line))
          .concat(medLines);
      } else {
        // Prepend consultation line and append medicine lines
        return [consultationLine, ...current, ...medLines];
      }
    });

    const feeMsg = fee > 0 ? ` and Dr. ${doctorDisplayName}'s consultation fee (₹${fee})` : "";
    const rxCode = formatPrescriptionId(rx.id, resolveClinicCode(rx.clinicId, clinics, user?.clinicId));
    toast.success(`Imported ${medLines.length} medicines${feeMsg} from ${rxCode}`);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) { toast.error("Please select a patient"); return; }
    if (lines.length === 0 || lines.some(line => !line.name.trim() || !Number.isFinite(line.qty) || line.qty <= 0 || !Number.isFinite(line.unit) || line.unit < 0)) {
      toast.error("Every invoice line needs a description, positive quantity and valid unit price");
      return;
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) {
      toast.error("Discount must be between zero and the subtotal");
      return;
    }
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
      toast.error("Tax rate must be between 0% and 100%");
      return;
    }
    if (total <= 0) { toast.error("Invoice total must be greater than zero"); return; }
    setIsSaving(true);
    try {
      const bill = await createBill({
        patientId: patient.id,
        subtotal,
        discount,
        taxRate: tax,
        items: lines.map(({ category, name, qty, unit }) => ({
          category,
          name: name.trim(),
          qty,
          unit,
        })),
      });
      const billCode = formatInvoiceId(bill.id, resolveClinicCode(bill.clinicId, clinics, user?.clinicId));
      toast.success(`Bill ${billCode} created`);
      navigate({ to: "/app/billing" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the bill");
    } finally {
      setIsSaving(false);
    }
  };

  const billHtml = () => {
    const displayPatientId = formatPatientId(patient?.id, patient?.raw?.medicalRecordNumber, patient?.raw?.clinicId || user?.clinicId);
    return `
    <h2>${user?.clinic ?? "ClinicFlow"}</h2>
    <div class="muted">Invoice · ${new Date().toLocaleDateString()}</div>
    <div class="card">
      <div class="row"><b>Patient</b><span>${patient?.primary ?? "—"} (${displayPatientId})</span></div>
      <div class="row"><b>Phone</b><span>${patient?.tertiary ?? "—"}</span></div>
    </div>
    ${Object.entries(bySection).map(([sec, items]) => `
      <h3>${sec}</h3>
      <table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${(items as Line[]).map(l => `<tr><td>${l.name || "—"}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">₹${l.unit.toFixed(2)}</td><td style="text-align:right">₹${(l.qty*l.unit).toFixed(2)}</td></tr>`).join("")}</tbody></table>
    `).join("")}
    <div class="card">
      <div class="row"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
      <div class="row"><span>Discount</span><span>- ₹${discount.toFixed(2)}</span></div>
      <div class="row"><span>Tax</span><span>${tax}%</span></div>
      <div class="row total"><span>Total</span><span>₹${total.toFixed(2)}</span></div>
    </div>
  `;
  };

  const printBill = () => printDocument(billHtml(), "Invoice");

  const copyBill = () => {
    const text = formatBillCopyText({
      id: "Draft",
      patient: patient?.primary || "Patient",
      date: new Date().toLocaleDateString(),
      clinicName: user?.clinic,
      items: lines.map(l => ({ category: l.category, name: l.name || "Item", qty: l.qty, unit: l.unit })),
      subtotal,
      discount,
      tax: taxAmount,
      amount: total,
      status: "Draft",
    });
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => toast.success("Copied bill details to clipboard"),
        () => toast.error("Could not copy to clipboard"),
      );
    } else {
      toast.info("Clipboard access unavailable");
    }
  };

  const shareBill = async () => {
    if (!patient) return;
    let targetPhone = patient.raw?.whatsappPhone?.trim() || "";
    if (!targetPhone) {
      try {
        const fullPatient = await getPatient(patient.id);
        if (fullPatient?.whatsappPhone) {
          targetPhone = fullPatient.whatsappPhone.trim();
        }
      } catch {
        // Ignore
      }
    }
    if (!targetPhone) {
      toast.error("WhatsApp number not found");
      return;
    }
    const msg = formatBillWhatsAppMessage({
      patientName: patient.primary,
      invoiceId: "Draft",
      clinicName: user?.clinic,
      date: new Date().toLocaleDateString(),
      status: "Unpaid",
      items: lines.map(l => ({ category: l.category, name: l.name || "Item", qty: l.qty, unit: l.unit })),
      subtotal,
      discount,
      tax: taxAmount,
      amount: total,
    });
    sendWhatsApp(targetPhone, msg);
    toast.success(`Opening WhatsApp chat for ${patient.primary}`);
  };

  return (
    <>
      <PageHeader title="Create bill" description="Itemized invoice with clear breakdown for the patient." />
      <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 min-w-0 space-y-6">
          <section className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
            <div className="space-y-1.5">
              <Label>Patient <span className="text-destructive">*</span></Label>
              <EntityPicker options={patientOptions} onSearch={searchPatientOptions} value={patient} onChange={selectPatient}
                placeholder="Search by name, patient ID or phone…" />
              {patient?.raw.doctor && (
                <p className="text-xs text-muted-foreground">
                  Assigned doctor: <span className="font-medium text-foreground">{patient.raw.doctor}</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline" disabled={!patientRxs.length}>
                    <Pill className="mr-1 h-3.5 w-3.5" />Import medicines from prescription
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {patientRxs.map((rx) => (
                    <DropdownMenuItem key={rx.id} onClick={() => importFromRx(rx)}>
                      {rx.date} — Dr. {rx.doctor} {rx.diagnosis && rx.diagnosis !== "Not recorded" ? `· ${rx.diagnosis}` : ""} ({rx.medicines.length} meds)
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {CATS.map(c => (
                <Button key={c} type="button" size="sm" variant="ghost" onClick={() => addLine(c)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />{c}
                </Button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-soft space-y-3">
            <h3 className="font-display text-base font-semibold">Line items</h3>
            <div className="space-y-2 overflow-x-auto min-w-0 pb-1">
              {lines.map(l => (
                <div
                  key={l.id}
                  className="grid min-w-[580px] sm:min-w-0 gap-2 rounded-xl border bg-muted/30 p-3 md:grid-cols-[minmax(120px,0.8fr)_minmax(240px,2fr)_80px_110px_100px_auto] md:items-center"
                >
                  <Select value={l.category} onValueChange={(v) => updateLine(l.id, { category: v as Cat })}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Item description" className="h-10 rounded-lg" value={l.name}
                    onChange={e => updateLine(l.id, { name: e.target.value })} />
                  <Input type="number" min={1} placeholder="Qty" className="h-10 rounded-lg" value={l.qty || ""}
                    onChange={e => updateLine(l.id, { qty: e.target.value === "" ? 0 : +e.target.value })} />
                  <Input type="number" min={0} step="0.01" placeholder="Unit ₹" className="h-10 rounded-lg" value={l.unit === 0 ? "" : l.unit}
                    onChange={e => updateLine(l.id, { unit: e.target.value === "" ? 0 : +e.target.value })} />
                  <div className="text-right text-sm font-semibold tabular-nums">₹{(l.qty * l.unit).toFixed(2)}</div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(l.id)} aria-label={`Remove ${l.name || "line item"}`} title={`Remove ${l.name || "line item"}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => addLine()}>
                <Plus className="mr-1 h-3.5 w-3.5" />Add line
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <div className="space-y-1.5"><Label>Discount (₹)</Label>
                <Input type="number" min={0} max={subtotal} step="0.01" className="h-11 rounded-xl" value={discount} onChange={e => setDiscount(+e.target.value)} />
              </div>
              <div className="space-y-1.5"><Label>Tax (%)</Label>
                <Input type="number" min={0} max={100} step="0.01" className="h-11 rounded-xl" value={tax} onChange={e => setTax(+e.target.value)} />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 h-fit">
          <section className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
            {/* Header branding */}
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-xs shrink-0">
                <Receipt className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">{user?.clinic ?? "ClinicFlow"}</div>
                <h3 className="font-display text-base font-bold text-foreground leading-tight">Invoice Preview</h3>
              </div>
            </div>

            {/* Patient & Clinic Metadata card */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3 text-xs">
              <div>
                <div className="font-medium text-muted-foreground">Patient</div>
                <div className="font-semibold text-sm text-foreground truncate mt-0.5">{patient?.primary ?? "—"}</div>
                {patient && (
                  <div className="font-mono text-[11px] font-semibold text-primary mt-0.5">
                    {formatPatientId(patient.id, patient.raw?.medicalRecordNumber, patient.raw?.clinicId || user?.clinicId)}
                  </div>
                )}
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Phone / Contact</div>
                <div className="font-medium text-foreground truncate mt-0.5">{patient?.tertiary ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Date: {new Date().toLocaleDateString()}</div>
              </div>
            </div>

            {/* Structured Itemized Breakdown */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Line Items Breakdown</div>
              {lines.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground italic">
                  No items added yet. Click categories above or add lines.
                </div>
              ) : (
                <div className="rounded-xl border divide-y overflow-hidden bg-card">
                  {Object.entries(bySection).map(([sec, items]) => {
                    const secTotal = (items as Line[]).reduce((s, l) => s + l.qty * l.unit, 0);
                    return (
                      <div key={sec} className="p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-primary">
                          <span>{sec}</span>
                          <span className="tabular-nums font-semibold">₹{secTotal.toFixed(2)}</span>
                        </div>
                        <div className="space-y-1.5">
                          {(items as Line[]).map(l => (
                            <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
                              <div className="min-w-0 flex-1 truncate text-foreground font-medium">
                                {l.name || "—"} <span className="text-muted-foreground font-normal">× {l.qty}</span>
                              </div>
                              <div className="shrink-0 tabular-nums font-semibold text-foreground">₹{(l.qty * l.unit).toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Calculations & Summary Card */}
            <dl className="space-y-1.5 rounded-xl border bg-muted/20 p-3.5 text-xs">
              <div className="flex justify-between text-muted-foreground"><dt>Subtotal</dt><dd className="tabular-nums font-medium text-foreground">₹{subtotal.toFixed(2)}</dd></div>
              <div className="flex justify-between text-muted-foreground"><dt>Discount</dt><dd className="tabular-nums font-medium text-destructive">- ₹{discount.toFixed(2)}</dd></div>
              <div className="flex justify-between text-muted-foreground"><dt>Tax ({tax}%)</dt><dd className="tabular-nums font-medium text-foreground">₹{taxAmount.toFixed(2)}</dd></div>
              <div className="flex justify-between items-baseline font-display text-base font-bold pt-2 border-t text-foreground"><dt>Total Amount</dt><dd className="tabular-nums text-primary text-lg">₹{total.toFixed(2)}</dd></div>
            </dl>

            {/* Quick Actions */}
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" className="flex-1 h-9" onClick={printBill} title="Open printer page">
                <Printer className="mr-1.5 h-3.5 w-3.5" />Print
              </Button>
              <Button type="button" size="sm" variant="outline" className="flex-1 h-9" onClick={copyBill} title="Copy bill details">
                <Copy className="mr-1.5 h-3.5 w-3.5" />Copy
              </Button>
              <Button type="button" size="sm" className="flex-1 h-9" onClick={shareBill}>
                <Send className="mr-1.5 h-3.5 w-3.5" />WhatsApp
              </Button>
            </div>
          </section>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => navigate({ to: "/app/billing" })}>Cancel</Button>
            <Button type="submit" className="flex-1 h-11" disabled={isSaving}>
              {isSaving ? "Creating..." : "Create bill"}
            </Button>
          </div>
        </aside>
      </form>
    </>
  );
}
