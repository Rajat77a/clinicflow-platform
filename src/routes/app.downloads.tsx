import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth, type Role } from "@/lib/auth";

import { useWorkspaceData } from "@/lib/workspace-data";
import { downloadCSV } from "@/lib/exporters";
import { Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/downloads")({ component: DownloadCenter });

type Dataset = { key: string; label: string; rows: Record<string, unknown>[] };

function DownloadCenter() {
  const { user } = useAuth();
  const {
    clinics, patients, doctors, receptionists, appointments, prescriptions,
    bills, labReports, auditLogs, staffMembers,
  } = useWorkspaceData();
  const role = user?.role ?? "clinic_admin";
  const datasets = useMemo(() => {
    const byRole: Record<Role, Dataset[]> = {
      super_admin: [
        { key: "clinics", label: "Clinics", rows: clinics },
        { key: "bills", label: "Payments", rows: bills },
        { key: "auditLogs", label: "Audit Logs", rows: auditLogs },
        { key: "allUsers", label: "All Users", rows: getAllUsers(patients, doctors, receptionists, staffMembers) },
      ],
      clinic_admin: [
        { key: "patients", label: "Patients", rows: patients },
        { key: "doctors", label: "Doctors", rows: doctors },
        { key: "receptionists", label: "Receptionists", rows: receptionists },
        { key: "appointments", label: "Appointments", rows: appointments },
        { key: "prescriptions", label: "Prescriptions", rows: prescriptions.map(p => ({ ...p, medicines: p.medicines.length })) },
        { key: "bills", label: "Bills", rows: bills },
        { key: "labReports", label: "Lab Reports", rows: labReports },
        { key: "auditLogs", label: "Audit Logs", rows: auditLogs },
        { key: "allUsers", label: "All Users", rows: getAllUsers(patients, doctors, receptionists, staffMembers) },
      ],
      doctor: [
        { key: "patients", label: "My patients", rows: patients },
        { key: "prescriptions", label: "My prescriptions", rows: prescriptions.map(p => ({ ...p, medicines: p.medicines.length })) },
        { key: "labReports", label: "My patients' lab reports", rows: labReports },
        { key: "appointments", label: "My appointments", rows: appointments },
        { key: "followUps", label: "Follow-ups", rows: appointments.filter(item => item.doctor === user?.name) },
      ],
      receptionist: [
        { key: "appointments", label: "Appointments", rows: appointments },
        { key: "bills", label: "Bills", rows: bills },
        { key: "labReports", label: "Lab reports", rows: labReports },
        { key: "patients", label: "Patients", rows: patients },
      ],
    };
    return byRole[role];
  }, [appointments, auditLogs, bills, clinics, doctors, labReports, patients, prescriptions, receptionists, role, user?.name]);
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(datasets.map(d => [d.key, true]))
  );
  const [scope, setScope] = useState<string>("all");

  const toggle = (k: string) => setSelected(s => ({ ...s, [k]: !s[k] }));

  const run = () => {
    const active = datasets.filter(d => selected[d.key]);
    if (active.length === 0) { toast.error("Select at least one dataset"); return; }
    const stamp = new Date().toISOString().slice(0, 10);
    active.forEach(d => {
      const prefix = role === "super_admin" && scope !== "all"
        ? `${scope}-` : "";
      const rows = role === "super_admin" && scope !== "all"
        ? d.rows.filter(row => row.clinicId === scope || row.id === scope)
        : d.rows;
      downloadCSV(`clinicflow-${prefix}${d.key}-${stamp}.csv`, rows);
    });
    toast.success(`Exported ${active.length} file${active.length === 1 ? "" : "s"} · audit log recorded`);
  };

  return (
    <>
      <PageHeader
        title="Download Center"
        description="Export your data as CSV. Every export is recorded in the audit log."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <h3 className="font-display text-base font-semibold">Choose what to export</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {datasets.map(d => (
              <label key={d.key} className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 cursor-pointer">
                <Checkbox checked={!!selected[d.key]} onCheckedChange={() => toggle(d.key)} />
                <div>
                  <div className="text-sm font-medium">{d.label}</div>
                  <div className="text-xs text-muted-foreground">{d.rows.length} records</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <h3 className="font-display text-base font-semibold">Options</h3>
          {role === "super_admin" && (
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clinics</SelectItem>
                  {clinics.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Export data for one clinic or the whole platform.</p>
            </div>
          )}
          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            Files download as CSV. Each dataset saves as a separate file so you can open them in Excel, Google Sheets, or import to another system.
          </div>
          <Button onClick={run} className="w-full">
            <Download className="mr-2 h-4 w-4" /> Download selected
          </Button>
        </div>
      </div>
    </>
  );
}

function getAllUsers(
  patients: { id: string; name: string; phone: string; email?: string }[],
  doctors: { id: string; name: string; phone: string; email: string; status: string }[],
  receptionists: { id: string; name: string; phone: string; email: string; status: string }[],
  staffMembers: { id: string; name: string; email: string; role: string; status: string }[],
) {
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  const add = (row: Record<string, unknown>) => {
    if (seen.has(row.id as string)) return;
    seen.add(row.id as string);
    rows.push(row);
  };
  patients.forEach(p => add({ id: p.id, name: p.name, phone: p.phone, email: p.email ?? "", role: "Patient", status: "Active", source: "Patients" }));
  doctors.forEach(d => add({ id: d.id, name: d.name, phone: d.phone, email: d.email, role: "Doctor", status: d.status, source: "Doctors" }));
  receptionists.forEach(r => add({ id: r.id, name: r.name, phone: r.phone, email: r.email, role: "Receptionist", status: r.status, source: "Receptionists" }));
  staffMembers.forEach(s => add({ id: s.id, name: s.name, email: s.email, phone: "", role: s.role, status: s.status, source: "Staff" }));
  return rows;
}
