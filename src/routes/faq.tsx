import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { absoluteUrl } from "@/lib/site";

const FAQ = [
  { q: "Which types of clinics is ClinicFlow built for?", a: "General, multi-specialty, dental, physiotherapy, dermatology, ENT, orthopedic, pediatric, ayurveda, homeopathy, diagnostic centers and private medical practices." },
  { q: "Is my patient data safe?", a: "ClinicFlow is currently a development environment and must not store real patient data. Production use requires the documented backend safeguards, independent security review and applicable compliance approval." },
  { q: "Can multiple clinics share one account?", a: "Each clinic gets its own independent workspace. No clinic can ever view another clinic's data, even on the same platform." },
  { q: "How long does onboarding take?", a: "Most clinics are fully live within a day. Our team helps migrate existing patient data and trains your staff." },
  { q: "Do you support multiple users per clinic?", a: "Yes — you can add unlimited doctors, receptionists and admins to your clinic workspace." },
  { q: "What about prescriptions and invoices?", a: "Both are generated as branded PDFs with your clinic logo. You can preview, print or download instantly, or share on WhatsApp." },
  { q: "Can receptionists edit prescriptions?", a: "No. Receptionists can register patients, book appointments and create invoices, but only doctors can create or edit prescriptions." },
  { q: "What payment methods do you accept?", a: "UPI, bank transfer and all major Indian cards. Invoices include GST and are downloadable from your account." },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — ClinicFlow" },
      { name: "description", content: "Answers to common questions about ClinicFlow — onboarding, security and more." },
      { property: "og:title", content: "FAQ — ClinicFlow" },
      { property: "og:url", content: absoluteUrl("/faq") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/faq") }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question", name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    }],
  }),
  component: Faq,
});

function Faq() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">FAQ</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Questions, answered.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Can't find what you need? <Link to="/contact" className="font-semibold text-primary hover:underline">Get in touch</Link>.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border bg-card p-2 shadow-soft sm:p-4">
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((f, i) => (
              <AccordionItem key={i} value={`q${i}`} className="border-b last:border-0">
                <AccordionTrigger className="px-3 text-left text-base font-semibold hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="px-3 text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </MarketingShell>
  );
}
