import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { absoluteUrl } from "@/lib/site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — ClinicFlow" },
      { name: "description", content: "Get in touch with the ClinicFlow team. Sales, support and partnerships." },
      { property: "og:title", content: "Contact — ClinicFlow" },
      { property: "og:url", content: absoluteUrl("/contact") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/contact") }],
  }),
  component: Contact,
});

function Contact() {
  return (
    <MarketingShell>
      <section className="mx-auto grid min-h-[65vh] max-w-3xl place-items-center px-4 py-20 sm:px-6">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold">Contact channel pending verification</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            ClinicFlow will not collect contact details until a monitored support channel,
            retention policy, and responsible owner are in place.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Return home</Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
