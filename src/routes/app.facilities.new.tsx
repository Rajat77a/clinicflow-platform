import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceData } from "@/lib/workspace-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/facilities/new")({ component: NewFacility });

function Field({ label, children, span = 6 }: { label: string; children: React.ReactNode; span?: number }) {
  const spanClass = span === 2 ? "md:col-span-2" : span === 3 ? "md:col-span-3" : span === 4 ? "md:col-span-4" : "md:col-span-6";
  return (
    <div className={`${spanClass} space-y-1.5`}>
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NewFacility() {
  const navigate = useNavigate();
  const { createFacility } = useWorkspaceData();
  const [form, setForm] = useState({
    code: "",
    name: "",
    timezone: "",
    phone: "",
    email: "",
    address: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      return toast.error("Facility name and code are required");
    }
    if (!/^[A-Z0-9_-]{2,24}$/.test(form.code.trim())) {
      return toast.error("Code must be 2–24 characters using A–Z, 0–9, dash or underscore");
    }

    setIsSaving(true);
    try {
      const facility = await createFacility({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        timezone: form.timezone.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      });
      toast.success(`Facility ${facility.name} created and active. Staff can now be invited.`);
      navigate({ to: "/app/facilities" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the facility");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Add Facility"
        description="Create an active facility so hospital staff can be invited by email."
      />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-4 font-display text-base font-semibold">Facility details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <Field label="Facility name" span={4}>
                <Input
                  placeholder="Main Hospital Campus"
                  className="h-11 rounded-xl"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="Code" span={2}>
                <Input
                  placeholder="MAIN"
                  className="h-11 rounded-xl uppercase"
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Timezone" span={3}>
                <Input
                  placeholder="Asia/Kolkata"
                  className="h-11 rounded-xl"
                  value={form.timezone}
                  onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                />
              </Field>
              <Field label="Phone" span={3}>
                <Input
                  placeholder="+91 98765 43210"
                  className="h-11 rounded-xl"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </Field>
              <Field label="Email" span={6}>
                <Input
                  type="email"
                  placeholder="frontdesk@clinic.com"
                  className="h-11 rounded-xl"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </Field>
              <Field label="Address" span={6}>
                <Textarea
                  placeholder="Street, city, state"
                  rows={3}
                  className="rounded-xl"
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </Field>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-3 font-display text-base font-semibold">Staff invitations</h2>
            <p className="text-sm text-muted-foreground">
              Staff invitations require an active facility. Once created, invited staff receive an
              email with a secure link to set their password and activate their account.
            </p>
          </section>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate({ to: "/app/facilities" })}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? "Creating..." : "Create facility"}
            </Button>
          </div>
        </aside>
      </form>
    </>
  );
}