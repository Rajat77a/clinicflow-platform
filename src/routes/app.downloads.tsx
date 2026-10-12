import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth, type Role } from "@/lib/auth";
import { useWorkspaceData } from "@/lib/workspace-data";
import { downloadCSV, downloadFile } from "@/lib/exporters";
import {
  Download, Building2, UsersRound, Stethoscope, UserCog, ShieldCheck,
  CalendarDays, FileText, Receipt, FlaskConical, History, Database,
  Search, CheckSquare, Square, FileSpreadsheet, CheckCircle2, PackageOpen,
  MapPin, Phone, Mail, Award,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/downloads")({ component: DownloadCenter });

type DatasetCategory = "people" | "operations" | "platform";

type Dataset = {
  key: string;
  label: string;
  description: string;
  category: DatasetCategory;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeColor: string;
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

  const role = user?.role ?? "clinic_admin";
  const [scope, setScope] = useState<string>("all");
  const [activeCategory, setActiveCategory] = useState<"all" | "people" | "operations">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Determine the active clinic for Clinical Admins (or selected clinic for Super Admins)
  const activeClinic = useMemo(() => {
    if (role === "super_admin" && scope !== "all") {
      return clinics.find(c => c.id === scope) || clinics[0] || null;
    }
    if (user?.clinicId) {
      const found = clinics.find(c => c.id === user.clinicId || c.shortId === user.clinicId);
      if (found) return found;
    }
    if (user?.clinic) {
      const found = clinics.find(c => c.name?.toLowerCase() === user.clinic?.toLowerCase());
      if (found) return found;
    }
    return clinics[0] || null;
  }, [clinics, role, scope, user?.clinic, user?.clinicId]);

  // Filter Clinical Admins
  const clinicalAdmins = useMemo(() => {
    return staffMembers.filter(m => m.role === "clinic_admin");
  }, [staffMembers]);

  // Build Unified Users Directory (Patients, Doctors, Receptionists, Clinical Admins)
  const allUsersDirectory = useMemo(() => {
    return getAllUsers(patients, doctors, receptionists, staffMembers);
  }, [patients, doctors, receptionists, staffMembers]);

  // Build Comprehensive Clinic Summary Dataset
  const clinicSummaryData = useMemo(() => {
    const totalRevenue = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
    return [{
      "Clinic ID": activeClinic?.id ?? "N/A",
      "Clinic Name": activeClinic?.name ?? "ClinicFlow Health",
      "City": activeClinic?.city ?? "N/A",
      "Address": activeClinic?.address ?? "N/A",
      "Contact Phone": activeClinic?.phone ?? "N/A",
      "Contact Email": activeClinic?.email ?? "N/A",
      "Subscription Plan": activeClinic?.plan ?? "Standard",
      "Account Status": activeClinic?.status ?? "Active",
      "No. of Patients": patients.length,
      "No. of Doctors": doctors.length,
      "No. of Receptionists": receptionists.length,
      "No. of Clinical Admins": clinicalAdmins.length,
      "Total Clinic Users": allUsersDirectory.length,
      "Total Appointments": appointments.length,
      "Total Prescriptions": prescriptions.length,
      "Total Bills & Invoices": bills.length,
      "Total Revenue (₹)": totalRevenue,
      "Export Date": new Date().toISOString().slice(0, 10),
      "Generated At": new Date().toLocaleString(),
    }];
  }, [activeClinic, allUsersDirectory.length, appointments.length, bills, clinicalAdmins.length, doctors.length, patients.length, prescriptions.length, receptionists.length]);

  // Format Patients Dataset with necessary clinical & contact details
  const formattedPatients = useMemo(() => {
    return patients.map(p => ({
      "Patient ID": p.id,
      "Full Name": p.name,
      "Age": p.age,
      "Date of Birth": p.dateOfBirth,
      "Gender": p.gender,
      "Phone": p.phone,
      "Email": p.email || "",
      "Blood Group": p.bloodGroup || "Not specified",
      "Primary Doctor": p.doctor || "Unassigned",
      "Last Visit": p.lastVisit || "None",
      "Status": p.status,
      "Medical Record Number": p.medicalRecordNumber || "",
      "Address": p.address || "",
      "Emergency Contact Name": p.emergencyContactName || "",
      "Emergency Contact Phone": p.emergencyContactPhone || "",
      "Allergies": (p.allergies || []).join("; "),
      "Chronic Conditions": (p.chronicConditions || []).join("; "),
    }));
  }, [patients]);

  // Format Doctors Dataset with credentials, specialty, fees & status
  const formattedDoctors = useMemo(() => {
    return doctors.map(d => ({
      "Doctor ID": d.id,
      "Full Name": d.name,
      "Specialty": d.specialty,
      "Email": d.email,
      "Phone": d.phone,
      "Gender": d.gender || "",
      "Qualification": d.qualification || "",
      "Medical Registration Number": d.medicalRegistrationNumber || "",
      "Experience (Years)": d.experienceYears ?? "",
      "Consultation Fee (₹)": d.consultationFee ?? "",
      "Working Hours": d.workingHours || "",
      "Patients Handled": d.patients || 0,
      "Status": d.status,
      "Notes": d.notes || "",
    }));
  }, [doctors]);

  // Format Receptionists Dataset
  const formattedReceptionists = useMemo(() => {
    return receptionists.map(r => ({
      "Receptionist ID": r.id,
      "Full Name": r.name,
      "Email": r.email,
      "Phone": r.phone,
      "Assigned Shift": r.shift,
      "Status": r.status,
    }));
  }, [receptionists]);

  // Format Clinical Admins Dataset
  const formattedClinicalAdmins = useMemo(() => {
    return clinicalAdmins.map(a => ({
      "Admin ID": a.id,
      "Full Name": a.name,
      "Email": a.email,
      "Phone": a.phone,
      "Role": "Clinical Admin",
      "Status": a.status,
      "Employee Number": a.employeeNumber || "",
      "Assigned Clinic": activeClinic?.name || "ClinicFlow Health",
    }));
  }, [clinicalAdmins, activeClinic?.name]);

  // Format Appointments Dataset
  const formattedAppointments = useMemo(() => {
    return appointments.map(a => ({
      "Appointment ID": a.id,
      "Patient Name": a.patient,
      "Doctor Name": a.doctor,
      "Date": a.date,
      "Time": a.time,
      "Type": a.type,
      "Duration (Minutes)": a.durationMinutes || 30,
      "Status": a.status,
      "Notes": a.notes || "",
    }));
  }, [appointments]);

  // Format Prescriptions Dataset
  const formattedPrescriptions = useMemo(() => {
    return prescriptions.map(p => ({
      "Prescription ID": p.id,
      "Patient Name": p.patient,
      "Doctor Name": p.doctor,
      "Date": p.date,
      "Diagnosis": p.diagnosis,
      "Number of Medicines": (p.medicines || []).length,
      "Medicines List": (p.medicines || []).map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join("; "),
      "Follow Up Date": p.followUp || "",
      "Notes": p.notes || "",
    }));
  }, [prescriptions]);

  // Format Invoices & Bills Dataset
  const formattedBills = useMemo(() => {
    return bills.map(b => ({
      "Invoice ID": b.id,
      "Patient Name": b.patient,
      "Date": b.date,
      "Subtotal (₹)": b.subtotal,
      "Tax (₹)": b.tax,
      "Discount (₹)": b.discount,
      "Total Amount (₹)": b.amount,
      "Payment Method": b.method,
      "Status": b.status,
      "Notes": b.notes || "",
    }));
  }, [bills]);

  // Format Lab Reports Dataset
  const formattedLabReports = useMemo(() => {
    return labReports.map(l => ({
      "Report ID": l.id,
      "Patient Name": l.patient,
      "Test Name": l.test,
      "Date": l.date,
      "Result": l.result,
      "Status": l.status,
      "Notes": l.notes || "",
    }));
  }, [labReports]);

  // Format Audit Logs Dataset
  const formattedAuditLogs = useMemo(() => {
    return auditLogs.map(a => ({
      "Log ID": a.id,
      "User": a.user,
      "Action": a.action,
      "Date": a.date,
      "Time": a.time,
    }));
  }, [auditLogs]);

  // Build the dataset registry tailored for each role, with complete coverage for Clinical Admins
  const datasets = useMemo<Dataset[]>(() => {
    const byRole: Record<Role, Dataset[]> = {
      super_admin: [
        {
          key: "clinics",
          label: "Clinics Directory",
          description: "All registered hospital & clinic profiles, subscriptions, and capacity statistics.",
          category: "platform",
          icon: Building2,
          accentColor: "from-sky-500/20 to-blue-500/20 text-sky-600 dark:text-sky-400",
          badgeColor: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
          rows: clinics,
        },
        {
          key: "bills",
          label: "Payments & Invoices",
          description: "Global revenue breakdown, transaction statuses, and invoice ledgers.",
          category: "operations",
          icon: Receipt,
          accentColor: "from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400",
          badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
          rows: formattedBills,
        },
        {
          key: "auditLogs",
          label: "Audit Logs",
          description: "System security audit entries, data modifications, and user access records.",
          category: "operations",
          icon: History,
          accentColor: "from-slate-500/20 to-zinc-500/20 text-slate-600 dark:text-slate-400",
          badgeColor: "bg-slate-50 text-slate-700 dark:bg-slate-950/40 dark:text-slate-300",
          rows: formattedAuditLogs,
        },
        {
          key: "allUsers",
          label: "All Users Directory",
          description: "Platform-wide user registry across clinical admins, doctors, receptionists, and patients.",
          category: "people",
          icon: UsersRound,
          accentColor: "from-indigo-500/20 to-violet-500/20 text-indigo-600 dark:text-indigo-400",
          badgeColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
          rows: allUsersDirectory,
        },
      ],
      clinic_admin: [
        {
          key: "clinicSummary",
          label: "Clinic Profile & Summary",
          description: "Complete clinic profile with patient count, doctor count, receptionist count, and capacity stats.",
          category: "people",
          icon: Building2,
          accentColor: "from-sky-500/20 to-cyan-500/20 text-sky-600 dark:text-sky-400",
          badgeColor: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
          rows: clinicSummaryData,
        },
        {
          key: "patients",
          label: "Patients Directory",
          description: "All registered patients with age, demographics, medical history, primary doctor, and contact information.",
          category: "people",
          icon: UsersRound,
          accentColor: "from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400",
          badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
          rows: formattedPatients,
        },
        {
          key: "doctors",
          label: "Doctors Directory",
          description: "All clinic doctors with medical specialties, registration numbers, fees, schedules, and active status.",
          category: "people",
          icon: Stethoscope,
          accentColor: "from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400",
          badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
          rows: formattedDoctors,
        },
        {
          key: "receptionists",
          label: "Receptionists Directory",
          description: "Front-desk personnel with shift schedules, contact details, and account status.",
          category: "people",
          icon: UserCog,
          accentColor: "from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400",
          badgeColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
          rows: formattedReceptionists,
        },
        {
          key: "clinicalAdmins",
          label: "Clinical Admins Directory",
          description: "Hospital administrators and managerial staff with organizational privileges and contact information.",
          category: "people",
          icon: ShieldCheck,
          accentColor: "from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400",
          badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
          rows: formattedClinicalAdmins,
        },
        {
          key: "allUsers",
          label: "Unified Users Directory",
          description: "Unified master roster consolidating all clinic staff and patients into a single searchable export.",
          category: "people",
          icon: UsersRound,
          accentColor: "from-indigo-500/20 to-violet-500/20 text-indigo-600 dark:text-indigo-400",
          badgeColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
          rows: allUsersDirectory,
        },
        {
          key: "appointments",
          label: "Appointments Schedule",
          description: "Complete consultation schedule including patient names, assigned doctors, time slots, and status.",
          category: "operations",
          icon: CalendarDays,
          accentColor: "from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400",
          badgeColor: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
          rows: formattedAppointments,
        },
        {
          key: "prescriptions",
          label: "Prescriptions & Medications",
          description: "Clinical diagnoses, prescribed medications, dosage frequencies, and patient follow-up dates.",
          category: "operations",
          icon: FileText,
          accentColor: "from-rose-500/20 to-red-500/20 text-rose-600 dark:text-rose-400",
          badgeColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
          rows: formattedPrescriptions,
        },
        {
          key: "bills",
          label: "Billing & Invoices",
          description: "Itemized billing records, tax calculations, discounts, payment methods, and revenue status.",
          category: "operations",
          icon: Receipt,
          accentColor: "from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400",
          badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
          rows: formattedBills,
        },
        {
          key: "labReports",
          label: "Lab Test Reports",
          description: "Diagnostic laboratory investigations, test names, recorded findings, and completion status.",
          category: "operations",
          icon: FlaskConical,
          accentColor: "from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400",
          badgeColor: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
          rows: formattedLabReports,
        },
        {
          key: "auditLogs",
          label: "Security Audit Trail",
          description: "Immutable security log of operations performed across the clinic workspace.",
          category: "operations",
          icon: History,
          accentColor: "from-slate-500/20 to-zinc-500/20 text-slate-600 dark:text-slate-400",
          badgeColor: "bg-slate-50 text-slate-700 dark:bg-slate-950/40 dark:text-slate-300",
          rows: formattedAuditLogs,
        },
      ],
      doctor: [
        {
          key: "patients",
          label: "My Patients",
          description: "Patients under your primary care with clinical history and follow-up notes.",
          category: "people",
          icon: UsersRound,
          accentColor: "from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400",
          badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
          rows: formattedPatients,
        },
        {
          key: "prescriptions",
          label: "My Prescriptions",
          description: "Prescriptions authored by you including medication regimens and dosage plans.",
          category: "operations",
          icon: FileText,
          accentColor: "from-rose-500/20 to-red-500/20 text-rose-600 dark:text-rose-400",
          badgeColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
          rows: formattedPrescriptions,
        },
        {
          key: "labReports",
          label: "My Patients' Lab Reports",
          description: "Diagnostic investigations and lab findings for your assigned patients.",
          category: "operations",
          icon: FlaskConical,
          accentColor: "from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400",
          badgeColor: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
          rows: formattedLabReports,
        },
        {
          key: "appointments",
          label: "My Appointments",
          description: "Your daily and upcoming clinical consultation appointments.",
          category: "operations",
          icon: CalendarDays,
          accentColor: "from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400",
          badgeColor: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
          rows: formattedAppointments,
        },
      ],
      receptionist: [
        {
          key: "appointments",
          label: "Appointments Schedule",
          description: "Front-desk appointment calendar and scheduling slots.",
          category: "operations",
          icon: CalendarDays,
          accentColor: "from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400",
          badgeColor: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
          rows: formattedAppointments,
        },
        {
          key: "bills",
          label: "Invoices & Receipts",
          description: "Patient billing receipts, payments collected, and payment modes.",
          category: "operations",
          icon: Receipt,
          accentColor: "from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400",
          badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
          rows: formattedBills,
        },
        {
          key: "labReports",
          label: "Lab Test Reports",
          description: "Registered laboratory records and diagnostic status.",
          category: "operations",
          icon: FlaskConical,
          accentColor: "from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400",
          badgeColor: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
          rows: formattedLabReports,
        },
        {
          key: "patients",
          label: "Patients Directory",
          description: "Patient registration records, contact details, and primary doctors.",
          category: "people",
          icon: UsersRound,
          accentColor: "from-indigo-500/20 to-violet-500/20 text-indigo-600 dark:text-indigo-400",
          badgeColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
          rows: formattedPatients,
        },
      ],
    };
    return byRole[role];
  }, [allUsersDirectory, clinics, formattedAppointments, formattedBills, formattedClinicalAdmins, formattedDoctors, formattedLabReports, formattedPatients, formattedPrescriptions, formattedReceptionists, formattedAuditLogs, clinicSummaryData, role]);

  // Selected state for batch operations
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

  const stamp = new Date().toISOString().slice(0, 10);
  const clinicSlug = (activeClinic?.name || "clinic").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Export single dataset directly
  const downloadSingleDataset = (dataset: Dataset) => {
    const filename = `clinicflow-${clinicSlug}-${dataset.key}-${stamp}.csv`;
    downloadCSV(filename, dataset.rows);
    toast.success(`Exported ${dataset.label} (${dataset.rows.length} records) · CSV downloaded`);
  };

  // Export all datasets as a complete clinic data backup package (JSON archive)
  const downloadCompleteClinicBackup = () => {
    const fullBackup = {
      clinicflow_version: "2.0",
      export_type: "complete_clinic_backup",
      exported_at: new Date().toISOString(),
      clinic_id: activeClinic?.id || "N/A",
      clinic_name: activeClinic?.name || "ClinicFlow Health",
      summary: clinicSummaryData[0],
      datasets: Object.fromEntries(
        datasets.map(d => [d.key, { label: d.label, count: d.rows.length, data: d.rows }])
      ),
    };
    const filename = `clinicflow-${clinicSlug}-complete-backup-${stamp}.json`;
    downloadFile(filename, JSON.stringify(fullBackup, null, 2), "application/json;charset=utf-8;");
    toast.success(`Complete clinic backup exported successfully (${filename})`);
  };

  // Export all datasets as a complete CSV batch
  const downloadAllDatasetsBatch = () => {
    datasets.forEach(d => {
      const filename = `clinicflow-${clinicSlug}-${d.key}-${stamp}.csv`;
      downloadCSV(filename, d.rows);
    });
    toast.success(`Exported all ${datasets.length} datasets for ${activeClinic?.name || "Clinic"} · CSV files downloaded`);
  };

  // Export selected datasets
  const downloadSelectedDatasets = () => {
    const active = datasets.filter(d => selected[d.key]);
    if (active.length === 0) {
      toast.error("Please select at least one dataset to download");
      return;
    }
    active.forEach(d => {
      const prefix = role === "super_admin" && scope !== "all" ? `${scope}-` : "";
      const filename = `clinicflow-${prefix}${clinicSlug}-${d.key}-${stamp}.csv`;
      downloadCSV(filename, d.rows);
    });
    toast.success(`Exported ${active.length} dataset${active.length === 1 ? "" : "s"} · CSV files downloaded`);
  };

  // Filter datasets by active category tab and search query
  const filteredDatasets = useMemo(() => {
    return datasets.filter(d => {
      if (activeCategory !== "all" && d.category !== activeCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          d.label.toLowerCase().includes(query) ||
          d.description.toLowerCase().includes(query) ||
          d.key.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [datasets, activeCategory, searchQuery]);

  const selectedCount = datasets.filter(d => selected[d.key]).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Download Center"
        description="Comprehensive clinic data export engine. Download individual user registries (Patients, Doctors, Receptionists, Clinical Admins) or export the complete clinic data backup."
      />

      {/* Clinic Profile & Stats Overview Banner */}
      <div className="rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-soft space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-sm shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-foreground">
                  {activeClinic?.name || "ClinicFlow Health"}
                </h2>
                <Badge variant="outline" className="text-xs font-mono">
                  {activeClinic?.id || "CL-001"}
                </Badge>
                {activeClinic?.plan && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                    {activeClinic.plan} Plan
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                {activeClinic?.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {activeClinic.city}
                  </span>
                )}
                {activeClinic?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {activeClinic.phone}
                  </span>
                )}
                {activeClinic?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {activeClinic.email}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick One-Click Full Clinic Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={downloadCompleteClinicBackup}
              className="gap-2 shadow-sm font-semibold text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90"
              title="Download all clinic records as a comprehensive JSON backup package"
            >
              <PackageOpen className="h-4 w-4" />
              Download Complete Clinic Data (Backup)
            </Button>
            <Button
              variant="outline"
              onClick={downloadAllDatasetsBatch}
              className="gap-2 font-medium text-xs h-9 hover:bg-muted/60"
              title="Download all datasets simultaneously as individual CSV files"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Download All Datasets (CSVs)
            </Button>
          </div>
        </div>

        {/* High-Level Clinic Metric Pills */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 pt-2 border-t border-border/40">
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Patients</span>
              <UsersRound className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="mt-1 text-xl font-bold text-foreground tabular-nums">
              {patients.length}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Doctors</span>
              <Stethoscope className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="mt-1 text-xl font-bold text-foreground tabular-nums">
              {doctors.length}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Receptionists</span>
              <UserCog className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div className="mt-1 text-xl font-bold text-foreground tabular-nums">
              {receptionists.length}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Clinical Admins</span>
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="mt-1 text-xl font-bold text-foreground tabular-nums">
              {clinicalAdmins.length}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Total Users</span>
              <Database className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div className="mt-1 text-xl font-bold text-foreground tabular-nums">
              {allUsersDirectory.length}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Appointments</span>
              <CalendarDays className="h-3.5 w-3.5 text-cyan-600" />
            </div>
            <div className="mt-1 text-xl font-bold text-foreground tabular-nums">
              {appointments.length}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Dataset Cards & Filter Toolbar */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border w-fit">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeCategory === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Datasets ({datasets.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("people")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeCategory === "people"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                People &amp; Users
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("operations")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeCategory === "operations"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Operations &amp; Clinical
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search datasets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Dataset Cards Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredDatasets.map(d => {
              const Icon = d.icon;
              const isChecked = !!selected[d.key];
              return (
                <div
                  key={d.key}
                  className={`flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
                    isChecked
                      ? "bg-card border-primary/30 shadow-soft ring-1 ring-primary/10"
                      : "bg-muted/20 border-border/60 hover:bg-card"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${d.accentColor} shrink-0`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                            <span>{d.label}</span>
                          </div>
                          <Badge className={`${d.badgeColor} border-none text-[11px] font-mono mt-0.5 px-2 py-0`}>
                            {d.rows.length} records
                          </Badge>
                        </div>
                      </div>

                      {/* Multi-Select Checkbox */}
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggle(d.key)}
                        aria-label={`Select ${d.label} for batch download`}
                        className="mt-1"
                      />
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {d.description}
                    </p>
                  </div>

                  {/* Individual Download Action Button */}
                  <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      .CSV Format
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => downloadSingleDataset(d)}
                      className="h-8 gap-1.5 text-xs font-semibold hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                      title={`Download ${d.label} as CSV`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download CSV</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredDatasets.length === 0 && (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
              <Database className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">No matching datasets found</p>
              <p className="text-xs">Try adjusting your search query or category filter</p>
            </div>
          )}
        </div>

        {/* Right: Batch Controls & Scope Panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-soft space-y-4">
            <h3 className="font-display text-sm font-bold flex items-center gap-2 text-foreground">
              <Download className="h-4 w-4 text-primary" />
              Batch Download Controls
            </h3>

            {/* Scope Selector for Super Admins */}
            {role === "super_admin" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Export Scope</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger className="h-10 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Platform-Wide (All Clinics)</SelectItem>
                    {clinics.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Choose whether to export platform-wide data or isolate a specific clinic.
                </p>
              </div>
            )}

            {/* Multi-Selection Helpers */}
            <div className="space-y-2 pt-1 border-t border-border/40">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Selected Datasets:</span>
                <span className="font-bold font-mono text-foreground">
                  {selectedCount} of {datasets.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  className="h-8 text-xs gap-1.5"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={deselectAll}
                  className="h-8 text-xs gap-1.5"
                >
                  <Square className="h-3.5 w-3.5" />
                  Deselect All
                </Button>
              </div>
            </div>

            {/* Batch Download Button */}
            <Button
              onClick={downloadSelectedDatasets}
              disabled={selectedCount === 0}
              className="w-full gap-2 h-10 font-semibold text-xs shadow-sm"
            >
              <Download className="h-4 w-4" />
              Download Selected ({selectedCount})
            </Button>

            {/* Complete Clinic Backup Shortcut */}
            <div className="pt-2 border-t border-border/40">
              <Label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Complete Clinic Archive
              </Label>
              <Button
                type="button"
                variant="secondary"
                onClick={downloadCompleteClinicBackup}
                className="w-full gap-2 text-xs font-medium h-9"
              >
                <Database className="h-3.5 w-3.5 text-primary" />
                Full Clinic JSON Backup
              </Button>
            </div>

            {/* Export Guidelines & Notice */}
            <div className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Export Compatibility
              </div>
              <p>
                CSV files are compatible with Microsoft Excel, Apple Numbers, and Google Sheets.
                All downloads are authenticated and recorded in the clinic security audit log.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getAllUsers(
  patients: { id: string; name: string; phone: string; email?: string }[],
  doctors: { id: string; name: string; phone: string; email: string; status: string }[],
  receptionists: { id: string; name: string; phone: string; email: string; status: string }[],
  staffMembers: { id: string; name: string; email: string; role: string; status: string; phone?: string }[],
) {
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  const add = (row: Record<string, unknown>) => {
    const key = `${row.role}-${row.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  patients.forEach(p =>
    add({
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email ?? "",
      role: "Patient",
      status: "Active",
      source: "Patients Directory",
    })
  );

  doctors.forEach(d =>
    add({
      id: d.id,
      name: d.name,
      phone: d.phone,
      email: d.email,
      role: "Doctor",
      status: d.status,
      source: "Doctors Directory",
    })
  );

  receptionists.forEach(r =>
    add({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      role: "Receptionist",
      status: r.status,
      source: "Receptionists Directory",
    })
  );

  staffMembers.forEach(s =>
    add({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone || "",
      role: s.role === "clinic_admin" ? "Clinical Admin" : s.role === "super_admin" ? "Super Admin" : s.role,
      status: s.status,
      source: "Staff Directory",
    })
  );

  return rows;
}
