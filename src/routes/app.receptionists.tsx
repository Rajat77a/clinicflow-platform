import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useWorkspaceData } from "@/lib/workspace-data";
import { UserPlus, ShieldCheck, AlertTriangle, CheckCircle2, Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/receptionists")({ component: ReceptionistsPage });

function ReceptionistsPage() {
  const { user } = useAuth();
  const { receptionists: rows, clinics, createReceptionist } = useWorkspaceData();
  const [open, setOpen] = useState(false);
  const [hospitalId, setHospitalId] = useState(clinics[0]?.id || "");
  const [form, setForm] = useState({ name: "", email: "", phone: "", shift: "Morning (9–5)" });
  const [saving, setSaving] = useState(false);

  const [createdStaffInfo, setCreatedStaffInfo] = useState<{
    roleTitle: string;
    staffName: string;
    staffEmail: string;
    setupUrl?: string;
    emailSent?: boolean;
    emailId?: string;
    emailError?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Name, email and phone are required");
      return;
    }
    if (user?.role === "super_admin" && !hospitalId) {
      toast.error("Please select a clinic to assign the receptionist to");
      return;
    }
    setSaving(true);
    try {
      const res = await createReceptionist({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        shift: form.shift,
        hospitalId: user?.role === "super_admin" ? hospitalId : undefined,
      });
      const receptionist = res.data;
      
      setForm({ name: "", email: "", phone: "", shift: "Morning (9–5)" });
      setOpen(false);

      setCreatedStaffInfo({
        roleTitle: "Receptionist",
        staffName: receptionist.name,
        staffEmail: receptionist.email,
        setupUrl: res.setupUrl,
        emailSent: res.emailSent,
        emailId: res.emailId,
        emailError: res.emailError,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to invite receptionist");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Receptionists" description="Front-desk staff at your clinic."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><UserPlus className="mr-1.5 h-4 w-4" />Add receptionist</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add receptionist</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground">A secure invitation link will be emailed so the receptionist can set a password.</p>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Full name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-11 rounded-xl" placeholder="Sofia Romero" /></div>
                <div className="space-y-1.5"><Label>Email (login ID)</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-11 rounded-xl" placeholder="sofia@clinic.com" /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-11 rounded-xl" placeholder="+91 …" /></div>
                <div className="space-y-1.5"><Label>Shift</Label><Input value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })} className="h-11 rounded-xl" /></div>
                {user?.role === "super_admin" && (
                  <div className="space-y-1.5">
                    <Label>Assign to Clinic / Hospital</Label>
                    <Select value={hospitalId} onValueChange={setHospitalId}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select Clinic" />
                      </SelectTrigger>
                      <SelectContent>
                        {clinics.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.city || c.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={submit} className="w-full" disabled={saving}>{saving ? "Inviting..." : "Invite receptionist"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Shift</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground text-xs font-semibold">
                      {r.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="font-semibold">{r.name}</div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell>{r.shift}</TableCell>
                <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Staff Created / Setup Link Dialog */}
      <Dialog open={Boolean(createdStaffInfo)} onOpenChange={(open) => { if (!open) { setCreatedStaffInfo(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${createdStaffInfo?.emailError ? "text-amber-600" : "text-emerald-600"}`}>
              {createdStaffInfo?.emailError ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600" /> Receptionist Invited (Email Delivery Action Required)
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" /> Receptionist Invited &amp; Invitation Delivered
                </>
              )}
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-left">
              <p>
                <strong>{createdStaffInfo?.staffName}</strong> has been added as a {createdStaffInfo?.roleTitle}.
              </p>
              {createdStaffInfo?.emailError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                  <div className="flex items-center gap-2 font-medium text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Email service alert: <strong>{createdStaffInfo.emailError}</strong></span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    The automated email could not be delivered. Ensure RESEND_API_KEY and a verified EMAIL_FROM are configured in server settings. In the meantime, you can manually copy and share the setup link below.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-3 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-medium text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Invitation email sent successfully to: <strong>{createdStaffInfo?.staffEmail}</strong></span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Confirmed by Resend{createdStaffInfo?.emailId ? ` (ID: ${createdStaffInfo.emailId})` : ""}. The user has been sent their 24-hour setup link to activate their account.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-left">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground">24-Hour Password Generation Link</Label>
              <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                Valid for 24 Hours
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={createdStaffInfo?.setupUrl ?? ""}
                className="h-10 font-mono text-xs bg-muted/50 rounded-xl"
              />
              <Button type="button" size="sm" onClick={() => {
                if (createdStaffInfo?.setupUrl) {
                  navigator.clipboard.writeText(createdStaffInfo.setupUrl);
                  setCopiedLink(true);
                  toast.success("Link copied!");
                  setTimeout(() => setCopiedLink(false), 2000);
                }
              }} className="shrink-0 gap-1.5">
                {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? "Copied" : "Copy Link"}
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            {createdStaffInfo?.setupUrl && (
              <Button
                variant="outline"
                type="button"
                className="w-full sm:w-auto"
                onClick={() => window.open(createdStaffInfo.setupUrl, "_blank")}
              >
                Open Setup Link in New Tab
              </Button>
            )}
            <Button onClick={() => { setCreatedStaffInfo(null); }} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
