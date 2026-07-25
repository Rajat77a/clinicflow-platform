import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity, CalendarDays, FileText, Receipt, Shield, Stethoscope,
  UsersRound, FolderOpen, FileBarChart, CheckCircle2, Lock, Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { absoluteUrl } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClinicFlow — Clinic Management Platform" },
      { name: "description", content: "ClinicFlow is a premium clinic management platform for patients, appointments, prescriptions, billing and medical records." },
      { property: "og:title", content: "ClinicFlow — Clinic Management Platform" },
      { property: "og:description", content: "Premium clinic management for healthcare providers across India." },
      { property: "og:url", content: absoluteUrl("/") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
  }),
  component: Home,
});

const FEATURES = [
  { icon: UsersRound, title: "Patient Management", desc: "Register patients instantly, track demographics, allergies and emergency contacts." },
  { icon: CalendarDays, title: "Appointments", desc: "Book, reschedule and cancel appointments with daily and weekly calendar views." },
  { icon: FileText, title: "Prescriptions", desc: "Generate branded prescription PDFs with clinic logo, dosage and doctor signature." },
  { icon: Receipt, title: "Billing", desc: "Create invoices with consultation, treatment and medicine charges, discounts and taxes." },
  { icon: FolderOpen, title: "Medical Records", desc: "Upload, categorize and retrieve lab reports, scans and documents securely." },
  { icon: FileBarChart, title: "Reports", desc: "Revenue, patient, appointment and billing reports to keep your clinic informed." },
];

const CLINIC_TYPES = [
  "General", "Multi-Specialty", "Dental", "Physiotherapy", "Dermatology",
  "ENT", "Orthopedic", "Pediatric", "Ayurveda", "Homeopathy", "Diagnostic", "Private Practice",
];

const SECURITY = [
  { icon: Lock, title: "End-to-End Encryption", desc: "All patient data is encrypted in transit and at rest." },
  { icon: Server, title: "Daily Backups", desc: "Automated encrypted backups every 24 hours with instant recovery." },
  { icon: Shield, title: "Role-Based Access", desc: "Super Admin, Clinic Admin, Doctor and Receptionist — each with controlled permissions." },
];

function Home() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-soft">
            <Activity className="h-8 w-8" strokeWidth={2} />
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
            ClinicFlow
          </h1>
          <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
            The modern clinic management platform for healthcare providers across India.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Patients, appointments, prescriptions, billing and medical records — all in one calm, simple workspace.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="h-12 rounded-xl px-8 text-sm font-semibold shadow-soft">
              <Link to="/login">Log in to ClinicFlow</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Everything your clinic needs
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              One platform for your entire team — designed to be simple, fast and reliable.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Clinic types */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Trusted by every kind of clinic
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {CLINIC_TYPES.map((t) => (
            <div key={t} className="rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium shadow-soft">
              {t}
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Security & Reliability
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your patient data is protected by industry-leading security practices.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {SECURITY.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="flex items-start gap-4 rounded-2xl border bg-card p-5 shadow-soft">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{s.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              ISO 27001 Certified
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              HIPAA & GDPR Aligned
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              99.99% Uptime
            </span>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
