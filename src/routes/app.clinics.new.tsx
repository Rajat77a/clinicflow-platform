import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader } from "@/components/forms/file-uploader";
import { useWorkspaceData } from "@/lib/workspace-data";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Mail, CheckCircle, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/app/clinics/new")({ component: AddClinic });

function Field({ label, children, span = 6 }: { label: string; children: React.ReactNode; span?: number }) {
  const spanClass = span === 2 ? "md:col-span-2" : span === 3 ? "md:col-span-3" : span === 4 ? "md:col-span-4" : "md:col-span-6";
  return (
    <div className={`${spanClass} space-y-1.5`}>
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function AddClinic() {
  const navigate = useNavigate();
  const { createClinic } = useWorkspaceData();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    logoName: "",
    adminName: "",
    adminEmail: "",
    adminPhone: "",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Setup link copied to clipboard");
  };

  const sendInvitationEmail = async () => {
    if (!setupUrl || !form.adminEmail) return;
    setSendingEmail(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        throw new Error("Supabase configuration not found");
      }
      const response = await fetch(`${supabaseUrl}/functions/v1/send-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          email: form.adminEmail,
          fullName: form.adminName,
          phone: form.adminPhone,
          roleCode: "clinic_admin",
          hospitalId: "", // Will be filled by the function
          clinicName: form.name,
          clinicEmail: form.email,
          clinicPhone: form.phone,
          clinicAddress: form.address,
          setupUrl,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send invitation email");
      }
      setEmailSent(true);
      toast.success(`Invitation email sent to ${form.adminEmail}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invitation email");
    } finally {
      setSendingEmail(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.address.trim()) return toast.error("Clinic name and address are required");
    if (!form.adminName.trim() || !form.adminEmail.trim()) {
      return toast.error("Clinical admin name and email are required");
    }

    setIsSaving(true);
    try {
      const city = form.address.split(",").map(part => part.trim()).filter(Boolean).at(-1) ?? form.address.trim();
      const clinic = await createClinic({
        name: form.name.trim(),
        city,
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        logoName: form.logoName.trim(),
        logo,
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
        adminPhone: form.adminPhone.trim(),
      });
      if (clinic.adminSetupUrl) {
        setSetupUrl(clinic.adminSetupUrl);
        setSetupDialogOpen(true);
        setEmailSent(false);
      } else {
        toast.success(`Clinic ${clinic.id} created. A secure setup invitation was sent to ${form.adminEmail.trim()}`);
        navigate({ to: "/app/clinics" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the clinic");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Add Clinic" description="Create the clinic workspace and its first Clinical Admin account." />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-4 font-display text-base font-semibold">Clinic details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <Field label="Clinic name" span={4}>
                <Input placeholder="Northwood Health" className="h-11 rounded-xl" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Plan" span={2}>
                <Input value="ClinicFlow - single plan" disabled className="h-11 rounded-xl" />
              </Field>
              <Field label="Clinic email" span={3}>
                <Input type="email" placeholder="frontdesk@clinic.com" className="h-11 rounded-xl" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
              </Field>
              <Field label="Clinic phone" span={3}>
                <Input placeholder="+91 98765 43210" className="h-11 rounded-xl" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} />
              </Field>
              <Field label="Address" span={6}>
                <Textarea placeholder="Street, city, state" rows={3} className="rounded-xl" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-4 font-display text-base font-semibold">Clinical Admin</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <Field label="Full name" span={3}>
                <Input className="h-11 rounded-xl" value={form.adminName} onChange={event => setForm({ ...form, adminName: event.target.value })} />
              </Field>
              <Field label="Email" span={3}>
                <Input type="email" className="h-11 rounded-xl" value={form.adminEmail} onChange={event => setForm({ ...form, adminEmail: event.target.value })} />
              </Field>
              <Field label="Phone" span={3}>
                <Input className="h-11 rounded-xl" value={form.adminPhone} onChange={event => setForm({ ...form, adminPhone: event.target.value })} />
              </Field>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              A one-time account setup invitation is sent to the clinical admin's email.
            </p>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-3 font-display text-base font-semibold">Branding</h2>
            <FileUploader label="Drop logo or click to upload" accept="image/png,image/jpeg,image/webp" hint="PNG, JPG or WebP, up to 2 MB" maxSizeBytes={2 * 1024 * 1024} onFile={setLogo} />
            <Input className="mt-3 h-10 rounded-xl" placeholder="Logo filename or note" value={form.logoName} onChange={event => setForm({ ...form, logoName: event.target.value })} />
          </section>
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-3 font-display text-base font-semibold">Access control</h2>
            <p className="text-sm text-muted-foreground">The clinic starts active. Super Admin can later suspend access without deleting clinic data.</p>
          </section>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate({ to: "/app/clinics" })}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? "Creating..." : "Create clinic"}
            </Button>
          </div>
        </aside>
      </form>

      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clinic Created Successfully</DialogTitle>
            <DialogDescription>
              Share this secure setup link with the Clinical Admin so they can set their password and access the clinic.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Clinical Admin Email</Label>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{form.adminEmail}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Setup Link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={setupUrl ?? ""}
                  className="flex-1 h-11 rounded-xl bg-muted/50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(setupUrl ?? "")}
                  disabled={!setupUrl}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This link expires in 24 hours. The Clinical Admin will use it to create their password and log in.
            </p>
            <div className="flex gap-2">
              <Button
                variant={emailSent ? "default" : "outline"}
                onClick={sendInvitationEmail}
                disabled={sendingEmail || emailSent || !setupUrl}
                className="flex-1"
              >
                {sendingEmail ? (
                  <>
                    <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    Sending...
                  </>
                ) : emailSent ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Email Sent
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invitation Email
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => copyToClipboard(setupUrl ?? "")} disabled={!setupUrl} className="flex-1">
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
            </div>
            {emailSent && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Invitation email has been sent to {form.adminEmail}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => { setSetupDialogOpen(false); navigate({ to: "/app/clinics" }); }} className="w-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}