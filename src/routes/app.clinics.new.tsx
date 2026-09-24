import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader } from "@/components/forms/file-uploader";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspaceData } from "@/lib/workspace-data";
import { toast } from "sonner";
import { Copy, Check, Mail, ShieldCheck, Send, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { generateMailtoUrl, generateGmailComposeUrl, generateInvitationEmailText, getAppBaseUrl } from "@/lib/email-service";

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
  const [createdInfo, setCreatedInfo] = useState<{
    clinicId: string;
    clinicName: string;
    adminName: string;
    adminEmail: string;
    setupUrl: string;
    mailtoUrl: string;
    gmailUrl: string;
    emailText: string;
    emailSent?: boolean;
    emailId?: string;
    emailError?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.name.trim() || !form.address.trim()) {
      return toast.error("Clinic name and address are required");
    }
    if (!form.adminName.trim() || !form.adminEmail.trim()) {
      return toast.error("Clinical admin name and email are required");
    }
    if (!emailRegex.test(form.adminEmail.trim())) {
      return toast.error("Please enter a valid email address for the Clinical Admin");
    }
    if (form.email.trim() && !emailRegex.test(form.email.trim())) {
      return toast.error("Please enter a valid clinic email address");
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

      const origin = getAppBaseUrl();
      const setupUrl = clinic.setupUrl || `${origin}/setup?token=demo-${clinic.id}`;

      const emailParams = {
        recipientEmail: form.adminEmail.trim(),
        recipientName: form.adminName.trim(),
        clinicName: form.name.trim(),
        clinicId: clinic.id,
        clinicAddress: form.address.trim(),
        clinicCity: city,
        clinicPhone: form.adminPhone.trim() || form.phone.trim(),
        clinicEmail: form.email.trim(),
        setupUrl,
        roleTitle: "Clinical Admin",
        expiresInHours: 24,
      };

      const mailtoUrl = generateMailtoUrl(emailParams);
      const gmailUrl = generateGmailComposeUrl(emailParams);
      const emailText = generateInvitationEmailText(emailParams);

      setCreatedInfo({
        clinicId: clinic.id,
        clinicName: form.name.trim(),
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
        setupUrl,
        mailtoUrl,
        gmailUrl,
        emailText,
        emailSent: clinic.emailSent,
        emailId: clinic.emailId,
        emailError: clinic.emailError,
      });

      if (clinic.emailSent) {
        toast.success(`Clinic ${clinic.id} created successfully! Invitation email sent successfully to ${form.adminEmail.trim()}.`);
      } else if (clinic.emailError) {
        toast.error(`Clinic ${clinic.id} created, but invitation email failed: ${clinic.emailError}`);
      } else {
        toast.success(`Clinic ${clinic.id} created successfully!`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the clinic");
    } finally {
      setIsSaving(false);
    }
  };

  const copyLink = () => {
    if (!createdInfo?.setupUrl) return;
    void navigator.clipboard.writeText(createdInfo.setupUrl);
    setCopied(true);
    toast.success("Password setup link copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  };

  const copyFullEmailText = () => {
    if (!createdInfo?.emailText) return;
    void navigator.clipboard.writeText(createdInfo.emailText);
    setCopiedText(true);
    toast.success("Full invitation email text copied to clipboard!");
    setTimeout(() => setCopiedText(false), 3000);
  };

  const handleFinish = () => {
    setCreatedInfo(null);
    navigate({ to: "/app/clinics" });
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
            <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-primary" />
              A 24-hour setup invitation link will be generated for the Clinical Admin to set their 8+ character password.
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
            <p className="text-sm text-muted-foreground">The clinic starts active. Super Admin can later suspend access or move it to Trash Bin.</p>
          </section>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate({ to: "/app/clinics" })}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? "Creating..." : "Create clinic"}
            </Button>
          </div>
        </aside>
      </form>

      {/* Invitation Link Modal Dialog */}
      <Dialog open={Boolean(createdInfo)} onOpenChange={(open) => { if (!open) handleFinish(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${createdInfo?.emailError ? "text-amber-600" : "text-emerald-600"}`}>
              {createdInfo?.emailError ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600" /> Clinic Created (Email Delivery Action Required)
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" /> Clinic Created &amp; Invitation Email Delivered
                </>
              )}
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>
                <strong>{createdInfo?.clinicName}</strong> ({createdInfo?.clinicId}) has been successfully created.
              </p>
              {createdInfo?.emailError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                  <div className="flex items-center gap-2 font-medium text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Email service alert: <strong>{createdInfo.emailError}</strong></span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    The automated email could not be delivered. Ensure RESEND_API_KEY and a verified EMAIL_FROM are configured in server settings. In the meantime, you can copy the setup link or deliver the invitation directly below.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-3 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-medium text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Invitation email sent successfully to: <strong>{createdInfo?.adminEmail}</strong></span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Confirmed by Resend{createdInfo?.emailId ? ` (ID: ${createdInfo.emailId})` : ""}. The Clinical Admin ({createdInfo?.adminName}) has been sent their 24-hour setup link to activate their account and sign in.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground">24-Hour Password Generation Link</Label>
              <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                Valid for 24 Hours
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={createdInfo?.setupUrl ?? ""}
                className="h-10 font-mono text-xs bg-muted/50 rounded-xl"
              />
              <Button type="button" size="sm" onClick={copyLink} className="shrink-0 gap-1.5">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy Link"}
              </Button>
            </div>

            {/* Direct Email Dispatch Options */}
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2.5">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-primary" /> Deliver Invitation Email Directly
              </div>
              <p className="text-[11px] text-muted-foreground">
                Send the password setup email directly to <strong>{createdInfo?.adminEmail}</strong> using your email application or webmail:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {createdInfo?.mailtoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-9 gap-1.5 text-xs rounded-lg"
                    onClick={() => {
                      window.location.href = createdInfo.mailtoUrl;
                      toast.success("Opening default email client with invitation pre-filled!");
                    }}
                  >
                    <Mail className="h-3.5 w-3.5" /> Send via Email Client
                  </Button>
                )}
                {createdInfo?.gmailUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5 text-xs rounded-lg"
                    onClick={() => window.open(createdInfo.gmailUrl, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open in Gmail
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 text-xs rounded-lg"
                  onClick={copyFullEmailText}
                >
                  {copiedText ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedText ? "Email Copied" : "Copy Email Text"}
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              ⏰ This link expires in 24 hours. The Clinical Admin will use this link to set an 8+ character password, after which they can sign in using their email and newly set password.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {createdInfo?.setupUrl && (
              <Button
                variant="outline"
                type="button"
                className="w-full sm:w-auto"
                onClick={() => window.open(createdInfo.setupUrl, "_blank")}
              >
                Open Setup Link in New Tab
              </Button>
            )}
            <Button onClick={handleFinish} className="w-full sm:w-auto">
              Go to Clinics List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
