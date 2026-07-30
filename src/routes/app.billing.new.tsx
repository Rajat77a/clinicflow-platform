import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityPicker, toPatientOptions, type PatientOption } from "@/components/forms/entity-picker";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData } from "@/lib/workspace-data";
import { sendWhatsApp } from "@/lib/whatsapp";
import { printDocument } from "@/lib/exporters";
import { Plus, Trash2, Send, Printer, Pill } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/billing/new")({ component: NewBill });

type Cat = "Consultation" | "Procedure" | "Medicine" | "Lab" | "Other";
type Line = { id: string; category: Cat; name: string; qty: number; unit: number };

const CATS: Cat[] = ["Consultation", "Procedure", "Medicine", "Lab", "Other"];

function NewBill() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { patients, doctors, prescriptions, searchPatients, createBill } = useWorkspaceData();
  const patientOptions = toPatientOptions(patients);
  const searchPatientOptions = useCallback(
    async (query: string) =>
      toPatientOptions((await searchPatients({ query, limit: 12 })).rows),
    [searchPatients],
  );
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [lines, setLines] = useState<Line[]>([
    { id: crypto.randomUUID(), category: "Consultation", name: "Doctor consultation", qty: 1, unit: 500 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const selectPatient = (nextPatient: PatientOption | null) => {
    setPatient(nextPatient);
    if (!nextPatient) return;

    const assignedDoctor = doctors.find(
      (doctor) => doctor.name === nextPatient.raw.doctor && doctor.status === "Active",
    );
    if (assignedDoctor?.consultationFee == null) return;
    const consultationFee = assignedDoctor.consultationFee;

    setLines((current) => {
      const consultationIndex = current.findIndex((line) => line.category === "Consultation");
      const consultation: Line = {
        id: consultationIndex >= 0
          ? current[consultationIndex].id
          : crypto.randomUUID(),
        category: "Consultation",
        name: `${assignedDoctor.name} consultation`,
        qty: 1,
        unit: consultationFee,
      };
      if (consultationIndex < 0) return [consultation, ...current];
      return current.map((line, index) => index === consultationIndex ? consultation : line);
    });
  };

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit, 0);
  const total = Math.max(0, subtotal - discount) * (1 + tax / 100);
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

  const importFromRx = () => {
    if (!patient) { toast.error("Select a patient first"); return; }
    const rx = prescriptions.find(p => p.patientId === patient.id);
    if (!rx) { toast.error("No prescription found for this patient"); return; }
    const medLines: Line[] = rx.medicines.map(m => ({
      id: crypto.randomUUID(), category: "Medicine", name: m.name, qty: 1, unit: m.unitPrice ?? 100,
    }));
    setLines([...lines, ...medLines]);
    toast.success(`Imported ${medLines.length} medicines from ${rx.id}`);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) { toast.error("Please select a patient"); return; }
    if (total <= 0) { toast.error("Invoice total must be greater than zero"); return; }
    setIsSaving(true);
    try {
      const bill = await createBill({ patientId: patient.id, amount: total });
      toast.success(`Bill ${bill.id} created`);
      navigate({ to: "/app/billing" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the bill");
    } finally {
      setIsSaving(false);
    }
  };

  const billHtml = () => `
    <h2>${user?.clinic ?? "ClinicFlow"}</h2>
    <div class="muted">Invoice · ${new Date().toLocaleDateString()}</div>
    <div class="card">
      <div class="row"><b>Patient</b><span>${patient?.primary ?? "—"} (${patient?.id ?? ""})</span></div>
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

  const printBill = () => printDocument(billHtml(), "Invoice");
  const shareBill = () => {
    if (!patient) return;
    const lineText = lines.map(l => `• ${l.name} (${l.category}) × ${l.qty} = ₹${(l.qty*l.unit).toFixed(2)}`).join("\n");
    const msg = `Hi ${patient.primary}, invoice from ${user?.clinic}:\n${lineText}\n\nSubtotal: ₹${subtotal.toFixed(2)}\nDiscount: ₹${discount.toFixed(2)}\nTax: ${tax}%\nTotal: ₹${total.toFixed(2)}`;
    sendWhatsApp(patient.tertiary ?? "", msg);
  };

  return (
    <>
      <PageHeader title="Create bill" description="Itemized invoice with clear breakdown for the patient." />
      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
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
              <Button type="button" size="sm" variant="outline" onClick={importFromRx}>
                <Pill className="mr-1 h-3.5 w-3.5" />Import medicines from prescription
              </Button>
              {CATS.map(c => (
                <Button key={c} type="button" size="sm" variant="ghost" onClick={() => addLine(c)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />{c}
                </Button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-soft space-y-3">
            <h3 className="font-display text-base font-semibold">Line items</h3>
            <div className="space-y-2">
              {lines.map(l => (
                <div
                  key={l.id}
                  className="grid gap-2 rounded-xl border bg-muted/30 p-3 md:grid-cols-[minmax(120px,0.8fr)_minmax(240px,2fr)_80px_110px_100px_auto] md:items-center"
                >
                  <Select value={l.category} onValueChange={(v) => updateLine(l.id, { category: v as Cat })}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Item description" className="h-10 rounded-lg" value={l.name}
                    onChange={e => updateLine(l.id, { name: e.target.value })} />
                  <Input type="number" min={1} placeholder="Qty" className="h-10 rounded-lg" value={l.qty}
                    onChange={e => updateLine(l.id, { qty: +e.target.value })} />
                  <Input type="number" min={0} step="0.01" placeholder="Unit ₹" className="h-10 rounded-lg" value={l.unit}
                    onChange={e => updateLine(l.id, { unit: +e.target.value })} />
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
                <Input type="number" min={0} className="h-11 rounded-xl" value={discount} onChange={e => setDiscount(+e.target.value)} />
              </div>
              <div className="space-y-1.5"><Label>Tax (%)</Label>
                <Input type="number" min={0} className="h-11 rounded-xl" value={tax} onChange={e => setTax(+e.target.value)} />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{user?.clinic}</div>
            <h3 className="mt-2 font-display text-lg font-bold">Invoice preview</h3>
            <div className="mt-2 text-xs text-muted-foreground">{patient?.primary ?? "—"} · {patient?.tertiary ?? ""}</div>

            <div className="mt-4 space-y-4">
              {Object.entries(bySection).map(([sec, items]) => {
                const secTotal = (items as Line[]).reduce((s, l) => s + l.qty * l.unit, 0);
                return (
                  <div key={sec}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec}</div>
                    <div className="mt-1 space-y-1">
                      {(items as Line[]).map(l => (
                        <div key={l.id} className="flex justify-between text-sm">
                          <span className="truncate pr-2">{l.name || "—"} <span className="text-muted-foreground">× {l.qty}</span></span>
                          <span className="tabular-nums">₹{(l.qty * l.unit).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground border-t pt-1">
                      <span>Section subtotal</span><span className="tabular-nums">₹{secTotal.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">₹{subtotal.toFixed(2)}</dd></div>
              <div className="flex justify-between text-muted-foreground"><dt>Discount</dt><dd className="tabular-nums">- ₹{discount.toFixed(2)}</dd></div>
              <div className="flex justify-between text-muted-foreground"><dt>Tax</dt><dd className="tabular-nums">{tax}%</dd></div>
              <div className="flex justify-between font-display text-base font-bold pt-2 border-t"><dt>Total</dt><dd className="tabular-nums">₹{total.toFixed(2)}</dd></div>
            </dl>

            <div className="mt-4 flex gap-2">
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={printBill}>
                <Printer className="mr-1 h-3.5 w-3.5" />Download
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={shareBill}>
                <Send className="mr-1 h-3.5 w-3.5" />WhatsApp
              </Button>
            </div>
          </section>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate({ to: "/app/billing" })}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? "Creating..." : "Create bill"}
            </Button>
          </div>
        </aside>
      </form>
    </>
  );
}
