import { createFileRoute } from "@tanstack/react-router";
import { Heart, Shield, Sparkles, Users } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { absoluteUrl } from "@/lib/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — ClinicFlow" },
      { name: "description", content: "We build calm, premium software for clinics across India." },
      { property: "og:title", content: "About — ClinicFlow" },
      { property: "og:url", content: absoluteUrl("/about") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/about") }],
  }),
  component: About,
});

function About() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-4xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">About us</div>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Software that lets doctors be doctors.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          ClinicFlow started in a small clinic in Bengaluru. The doctor was tired of juggling paper files,
          excel sheets and three different apps. We built ClinicFlow to do one thing — give clinics back
          their time, so they can focus on patients.
        </p>
        <p className="mt-4 text-muted-foreground">
          ClinicFlow is currently being developed as a connected platform for solo practices,
          multi-specialty centers and diagnostic workflows.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Heart, t: "Patient-first", d: "Every feature is judged by one question: does this help the patient?" },
            { icon: Sparkles, t: "Calm by design", d: "We obsess over white space, typography and clear language." },
            { icon: Shield, t: "Trust by default", d: "Least-privilege roles, tenant isolation and auditable workflows are core requirements." },
            { icon: Users, t: "Built with clinics", d: "Every release ships from real feedback from real clinic staff." },
          ].map((v) => {
            const I = v.icon;
            return (
              <div key={v.t} className="rounded-2xl border bg-card p-6 shadow-soft">
                <I className="h-6 w-6 text-primary" />
                <div className="mt-3 font-display text-base font-semibold">{v.t}</div>
                <div className="mt-1 text-sm text-muted-foreground">{v.d}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 rounded-3xl border bg-gradient-to-br from-primary-soft/50 to-card p-10 sm:grid-cols-4">
          {[["4", "Role portals"], ["1", "Shared workspace"], ["6", "Tested access rules"], ["0", "Unverified claims"]].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="font-display text-3xl font-bold">{v}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
