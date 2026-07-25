import { createFileRoute } from "@tanstack/react-router";
import {
  UsersRound, CalendarDays, FileText, Receipt, Shield, Stethoscope, FolderOpen,
  BellRing, FileBarChart, ShieldCheck, Building2, Activity,
} from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { absoluteUrl } from "@/lib/site";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — ClinicFlow" },
      { name: "description", content: "Every feature your clinic needs: patients, appointments, prescriptions, billing, reports, audit logs and role-based access." },
      { property: "og:title", content: "Features — ClinicFlow" },
      { property: "og:url", content: absoluteUrl("/features") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/features") }],
  }),
  component: Features,
});

const GROUPS = [
  {
    title: "Patient Care",
    items: [
      { icon: UsersRound, t: "Patient Management", d: "Auto-generated patient ID, demographics, blood group, allergies, chronic conditions and emergency contacts." },
      { icon: Activity, t: "Medical Timeline", d: "Chronological view of every visit, prescription, bill and document." },
      { icon: Stethoscope, t: "Doctor Notes", d: "Private clinical notes per patient — only the treating doctor sees them." },
      { icon: BellRing, t: "Allergy & Critical Alerts", d: "Banners that warn staff about allergies and critical conditions on every patient screen." },
    ],
  },
  {
    title: "Workflow",
    items: [
      { icon: CalendarDays, t: "Appointments", d: "Day, week and calendar views. Book, reschedule or cancel in two clicks." },
      { icon: FileText, t: "Prescriptions", d: "Branded PDFs with clinic logo, medicines, dosage, instructions and doctor signature." },
      { icon: Receipt, t: "Billing", d: "Consultation, treatments and medicines with discounts, taxes and UPI receipts." },
      { icon: FolderOpen, t: "File Management", d: "Upload, categorize, preview and download lab reports, scans and prescriptions." },
    ],
  },
  {
    title: "Platform",
    items: [
      { icon: Shield, t: "Role-Based Access", d: "Super Admin, Clinic Admin, Doctor and Receptionist — each with their own workspace and permissions." },
      { icon: FileBarChart, t: "Reports & Analytics", d: "Revenue, patient, doctor, appointment, billing and subscription reports." },
      { icon: ShieldCheck, t: "Audit Logs", d: "Every action tracked — who did what, when, on which clinic." },
      { icon: Building2, t: "Multi-Clinic", d: "Each clinic has an independent workspace. Data never crosses clinics." },
    ],
  },
];

function Features() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Features</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Everything your clinic runs on.
          </h1>
          <p className="mt-4 text-muted-foreground">
            One platform for patients, appointments, prescriptions and billing — designed to feel calm,
            fast and effortless for everyone on your team.
          </p>
        </div>
      </section>

      {GROUPS.map((g) => (
        <section key={g.title} className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold tracking-tight">{g.title}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {g.items.map((i) => {
              const I = i.icon;
              return (
                <div key={i.t} className="rounded-2xl border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-card">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                    <I className="h-5 w-5" />
                  </div>
                  <div className="mt-4 font-display text-base font-semibold">{i.t}</div>
                  <div className="mt-1.5 text-sm text-muted-foreground">{i.d}</div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border bg-gradient-to-br from-primary-soft/60 to-card p-10 text-center shadow-soft">
          <h3 className="font-display text-2xl font-bold tracking-tight">Ready to simplify your clinic?</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Log in to access your workspace and start managing patients, appointments and billing.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
