import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [loading, setLoading] = useState(false);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Message sent — we'll get back within 1 business day.");
      (e.target as HTMLFormElement).reset();
    }, 700);
  };

  return (
    <MarketingShell>
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Contact</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            We'd love to hear from you.
          </h1>
          <p className="mt-4 text-muted-foreground">
            Whether you're a solo doctor or a 20-branch chain — let's chat.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-4">
            {[
              { icon: Phone, t: "Phone", d: "+91 80 4567 8900", s: "Mon–Sat · 9 AM – 7 PM IST" },
              { icon: MessageCircle, t: "WhatsApp", d: "+91 98765 43210", s: "Fastest response, 24/7" },
              { icon: Mail, t: "Email", d: "hello@clinicflow.io", s: "We reply within 4 hours" },
              { icon: MapPin, t: "Office", d: "HSR Layout, Bengaluru, India", s: "Visit by appointment" },
            ].map((c) => {
              const I = c.icon;
              return (
                <div key={c.t} className="flex items-start gap-4 rounded-2xl border bg-card p-5 shadow-soft">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <I className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.t}</div>
                    <div className="mt-0.5 font-semibold">{c.d}</div>
                    <div className="text-xs text-muted-foreground">{c.s}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={onSubmit} className="lg:col-span-3 rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
            <h2 className="font-display text-xl font-bold">Send us a message</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" required className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clinic">Clinic name</Label>
                <Input id="clinic" required className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" required className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="msg">Message</Label>
              <Textarea id="msg" rows={5} required className="rounded-xl" />
            </div>
            <Button type="submit" disabled={loading} className="mt-5 h-11 rounded-xl px-6 font-semibold">
              {loading ? "Sending…" : "Send message"}
            </Button>
          </form>
        </div>
      </section>
    </MarketingShell>
  );
}
