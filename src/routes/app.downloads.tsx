import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData } from "@/lib/workspace-data";
import { downloadCSV } from "@/lib/exporters";
import {
  Download,
  Building2,
  CreditCard,
  Wallet,
  Users,
  ShieldCheck,
  UsersRound,
  Stethoscope,
  UserCog,
  CalendarDays,
  FileText,
  Receipt,
  FlaskConical,
  ShieldAlert,
  CheckCheck,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/downloads")({ component: DownloadCenter });

type Dataset = {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: Record<string, unknown>[];
};

function DownloadCenter() {
  const { user } = useAuth();
  const {
    clinics,
    patients,
    doctors,
    receptionists,
    appointments,
    prescriptions,
    bills,
    labReports,
    auditLogs,
    staffMembers,
  } = useWorkspaceData();

  const role = user?.role;
  const isSuperAdmin = role === "super_admin";
  const isClinicAdmin = role === "clinic_admin";

  const [scope, setScope] = useState<string>("all");

  const datasets: Dataset[] = useMemo(() => {
    if (isSuperAdmin) {
      const filteredClinics = scope === "all" ? clinics : clinics.filter(c => c.id === scope);
      const filteredBills = scope === "all" ? bills : bills.filter(b => b.clinicId === scope);
      const filteredStaff = scope === "all" ? staffMembers : staffMembers.filter(s => s.clinicId === scope);
      const filteredAudit = scope === "all" ? auditLogs : auditLogs.filter(a => a.clinicId === scope);

      return [
        {
          key: "clinics",
          label: "Clinics",
          description: "All registered clinics, contact info, subscription plans, and status.",
          icon: Building2,
          rows: filteredClinics.map(c => ({
            id: c.id,
            name: c.name,
            city: c.city,
            phone: c.phone || "",
            email: c.email || "",
            address: c.address || "",
            plan: c.plan,
            status: c.status,
            expires: c.expires,
            price: c.price,
            access: c.access,
            doctorsCount: c.doctors,
            receptionistsCount: c.receptionists,
            patientsCount: c.patients,
            adminName: c.adminName || "",
            adminEmail: c.adminEmail || "",
          })),
        },
        {
          key: "subscriptions",
          label: "Subscriptions",
          description: "Clinic tier subscriptions, renewal dates, and license status.",
          icon: CreditCard,
          rows: filteredClinics.map(c => ({
            clinicId: c.id,
            clinicName: c.name,
            plan: c.plan,
            price: c.price,
            renewalDate: c.expires,
            status: c.status,
            access: c.access,
          })),
        },
        {
          key: "payments",
          label: "Payments & Invoices",
          description: "Platform-wide billing transactions, payments, and payment methods.",
          icon: Wallet,
          rows: filteredBills.map(b => ({
            paymentId: b.id,
            clinicId: b.clinicId,
            date: b.date,
            amount: b.amount,
            method: b.method,
            status: b.status,
          })),
        },
        {
          key: "staff-users",
          label: "Staff & Platform Users",
          description: "Platform administrators and clinic staff members.",
          icon: Users,
          rows: filteredStaff.map(s => ({
            id: s.id,
            name: s.name,
            email: s.email,
            role: s.role,
            clinicId: s.clinicId || "Platform",
            status: s.status,
          })),
        },
        {
          key: "audit-logs",
          label: "Audit Logs",
          description: "System administrative actions, user logins, and platform events.",
          icon: ShieldCheck,
          rows: filteredAudit.map(a => ({
            id: a.id,
            user: a.user,
            action: a.action,
            clinicId: a.clinicId || "All",
            date: a.date,
            time: a.time,
          })),
        },
      ];
    }

    if (isClinicAdmin) {
      return [
        {
          key: "patients",
          label: "Patients",
          description: "Registered patients with contact details, demographics, and last visit.",
          icon: UsersRound,
          rows: patients.map(p => ({
            id: p.id,
            mrn: p.medicalRecordNumber || "",
            name: p.name,
            age: p.age,
            gender: p.gender,
            phone: p.phone,
            email: p.email || "",
            bloodGroup: p.bloodGroup || "",
            address: p.address || "",
            doctor: p.doctor,
            lastVisit: p.lastVisit,
            status: p.status,
          })),
        },
        {
          key: "doctors",
          label: "Doctors",
          description: "Clinic doctors, specialties, contact info, and active status.",
          icon: Stethoscope,
          rows: doctors.map(d => ({
            id: d.id,
            name: d.name,
            specialty: d.specialty,
            email: d.email,
            phone: d.phone,
            qualification: d.qualification || "",
            registrationNumber: d.medicalRegistrationNumber || "",
            experienceYears: d.experienceYears ?? "",
            consultationFee: d.consultationFee ?? "",
            status: d.status,
          })),
        },
        {
          key: "receptionists",
          label: "Receptionists",
          description: "Front desk staff members, shifts, and contact information.",
          icon: UserCog,
          rows: receptionists.map(r => ({
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone,
            shift: r.shift,
            status: r.status,
          })),
        },
        {
          key: "clinic-staff",
          label: "Clinic Staff & Users",
          description: "All staff logins and accounts assigned to this clinic.",
          icon: Users,
          rows: staffMembers.map(s => ({
            id: s.id,
            name: s.name,
            email: s.email,
            role: s.role,
            status: s.status,
          })),
        },
        {
          key: "appointments",
          label: "Appointments",
          description: "Appointment schedules, booked dates, doctor assignments, and status.",
          icon: CalendarDays,
          rows: appointments.map(a => ({
            id: a.id,
            patient: a.patient,
            doctor: a.doctor,
            date: a.date,
            time: a.time,
            durationMinutes: a.durationMinutes,
            type: a.type,
            status: a.status,
            notes: a.notes || "",
          })),
        },
        {
          key: "prescriptions",
          label: "Prescriptions",
          description: "Prescription records with diagnoses, medicines summary, and follow-ups.",
          icon: FileText,
          rows: prescriptions.map(p => ({
            id: p.id,
            patient: p.patient,
            doctor: p.doctor,
            date: p.date,
            diagnosis: p.diagnosis,
            followUp: p.followUp || "",
            medicinesCount: p.medicines?.length || 0,
            medicines: p.medicines?.map(m => `${m.name} (${m.dosage})`).join("; ") || "",
            notes: p.notes || "",
          })),
        },
        {
          key: "billing",
          label: "Billing & Invoices",
          description: "Patient bills, totals, discounts, taxes, and payment status.",
          icon: Receipt,
          rows: bills.map(b => ({
            id: b.id,
            patient: b.patient,
            date: b.date,
            amount: b.amount,
            subtotal: b.subtotal,
            discount: b.discount,
            tax: b.tax,
            method: b.method,
            status: b.status,
            itemsCount: b.items?.length || 0,
            notes: b.notes || "",
          })),
        },
        {
          key: "lab-reports",
          label: "Lab Reports",
          description: "Diagnostic lab tests, results, reference intervals, and status.",
          icon: FlaskConical,
          rows: labReports.map(l => ({
            id: l.id,
            patient: l.patient,
            test: l.test,
            date: l.date,
            result: l.result,
            reference: l.reference,
            uploadedBy: l.uploadedBy,
            notes: l.notes || "",
          })),
        },
        {
          key: "audit-logs",
          label: "Clinic Audit Logs",
          description: "Audit records for staff actions, updates, and clinic operations.",
          icon: ShieldCheck,
          rows: auditLogs.map(a => ({
            id: a.id,
            user: a.user,
            action: a.action,
            date: a.date,
            time: a.time,
          })),
        },
      ];
    }

    return [];
  }, [
    isSuperAdmin,
    isClinicAdmin,
    scope,
    clinics,
    bills,
    staffMembers,
    auditLogs,
    patients,
    doctors,
    receptionists,
    appointments,
    prescriptions,
    labReports,
  ]);

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(datasets.map(d => [d.key, true]))
  );

  const toggle = (k: string) => setSelected(s => ({ ...s, [k]: !s[k] }));

  const selectAll = () => {
    setSelected(Object.fromEntries(datasets.map(d => [d.key, true])));
  };

  const deselectAll = () => {
    setSelected(Object.fromEntries(datasets.map(d => [d.key, false])));
  };

  const downloadDataset = (dataset: Dataset) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const prefix = isSuperAdmin && scope !== "all" ? `${scope}-` : "";
    downloadCSV(`clinicflow-${prefix}${dataset.key}-${stamp}.csv`, dataset.rows);
    toast.success(`Exported ${dataset.label} (${dataset.rows.length} records)`);
  };

  const downloadSelected = () => {
    const active = datasets.filter(d => selected[d.key]);
    if (active.length === 0) {
      toast.error("Please select at least one dataset to export");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const prefix = isSuperAdmin && scope !== "all" ? `${scope}-` : "";
    active.forEach(d => {
      downloadCSV(`clinicflow-${prefix}${d.key}-${stamp}.csv`, d.rows);
    });
    toast.success(`Successfully exported ${active.length} file${active.length === 1 ? "" : "s"}`);
  };

  if (!isSuperAdmin && !isClinicAdmin) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold">Access Restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The Download Center is exclusively available to Super Administrators and Clinical Administrators.
          </p>
        </div>
      </div>
    );
  }

  const selectedCount = datasets.filter(d => selected[d.key]).length;
  const totalRecords = datasets.reduce((sum, d) => sum + d.rows.length, 0);
  const selectedRecords = datasets
    .filter(d => selected[d.key])
    .reduce((sum, d) => sum + d.rows.length, 0);

  return (
    <>
      <PageHeader
        title="Download Center"
        description={
          isSuperAdmin
            ? "Export platform-level datasets, clinics, subscriptions, and audit records as CSV files."
            : "Export clinic operations, patients, appointments, billing, prescriptions, and lab data as CSV files."
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Datasets List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-soft">
            <div>
              <h2 className="font-display text-base font-semibold">Available Datasets</h2>
              <p className="text-xs text-muted-foreground">
                Download datasets individually using the CSV button or select multiple for batch export.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={selectAll} className="h-8 text-xs">
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Select All
              </Button>
              <Button size="sm" variant="ghost" onClick={deselectAll} className="h-8 text-xs">
                Clear
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {datasets.map(d => {
              const Icon = d.icon;
              const isChecked = !!selected[d.key];
              return (
                <div
                  key={d.key}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4 transition-all ${
                    isChecked
                      ? "border-primary/30 bg-card shadow-soft"
                      : "border-border/60 bg-muted/20 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="pt-0.5">
                      <Checkbox
                        id={`dataset-${d.key}`}
                        checked={isChecked}
                        onCheckedChange={() => toggle(d.key)}
                        aria-label={`Select ${d.label}`}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label
                        htmlFor={`dataset-${d.key}`}
                        className="flex flex-wrap items-center gap-2 font-display text-sm font-semibold cursor-pointer"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{d.label}</span>
                        <Badge variant="secondary" className="text-[11px] font-normal tabular-nums">
                          {d.rows.length} {d.rows.length === 1 ? "record" : "records"}
                        </Badge>
                      </label>
                      <p className="text-xs text-muted-foreground">{d.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadDataset(d)}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download CSV</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Export Options & Full Download */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <h3 className="font-display text-base font-semibold">Export Options</h3>
            </div>

            {isSuperAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="scope-select">Clinic Scope</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger id="scope-select" className="h-10 rounded-xl">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clinics (Platform Wide)</SelectItem>
                    {clinics.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Scope filters data across clinics for individual and batch exports.
                </p>
              </div>
            )}

            <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Selected Datasets:</span>
                <span className="font-medium text-foreground">
                  {selectedCount} of {datasets.length}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Records to export:</span>
                <span className="font-medium text-foreground tabular-nums">
                  {selectedRecords} records
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total available:</span>
                <span className="font-medium text-foreground tabular-nums">
                  {totalRecords} records
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
              Files are generated as standard CSV format compatible with Microsoft Excel, Google Sheets, Apple Numbers, and database imports.
            </div>

            <Button
              onClick={downloadSelected}
              disabled={selectedCount === 0}
              className="w-full gap-2 shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span>Download Selected ({selectedCount})</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
