import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData } from "@/lib/workspace-data";
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from "@/lib/password-policy";
const SUBSCRIPTION_PRICE = 499;
import { toast } from "sonner";
import { Eye, EyeOff, Lock, KeyRound } from "lucide-react";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useAuth();
  if (user?.role === "super_admin") return <PlatformSettings />;
  return <ClinicSettings />;
}

export function ChangePasswordCard() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      toast.error(policyError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    setIsSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully. You can now use your new password to sign in.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold">Change Password</h3>
          <p className="text-xs text-muted-foreground">
            Update your account password. Once changed, use your new password on next sign-in.
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        {/* Current Password */}
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <div className="relative">
            <Input
              id="current-password"
              type={showCurrent ? "text" : "password"}
              className="h-11 rounded-xl pr-11"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setShowCurrent(!showCurrent)}
              aria-label={showCurrent ? "Hide current password" : "Show current password"}
              title={showCurrent ? "Hide current password" : "Show current password"}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* New Password */}
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNew ? "text" : "password"}
              className="h-11 rounded-xl pr-11"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setShowNew(!showNew)}
              aria-label={showNew ? "Hide new password" : "Show new password"}
              title={showNew ? "Hide new password" : "Show new password"}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirm-new-password">Confirm new password</Label>
          <div className="relative">
            <Input
              id="confirm-new-password"
              type={showConfirm ? "text" : "password"}
              className="h-11 rounded-xl pr-11"
              placeholder="Re-enter new password"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
              title={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isSaving} className="rounded-xl font-medium">
          <Lock className="mr-2 h-4 w-4" />
          {isSaving ? "Updating password..." : "Update password"}
        </Button>
      </div>
    </form>
  );
}

/* ----------------- Super Admin: Platform settings ----------------- */
function PlatformSettings() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Platform settings" description="Manage your ClinicFlow platform account, billing and support." />
      <Tabs defaultValue="account">
        <TabsList className="rounded-xl bg-muted/60 p-1 flex-wrap h-auto">
          <TabsTrigger value="account" className="rounded-lg">Account</TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg">Security</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg">Notifications</TabsTrigger>
          <TabsTrigger value="platform" className="rounded-lg">Platform</TabsTrigger>
          <TabsTrigger value="subscription" className="rounded-lg">Subscription</TabsTrigger>
          <TabsTrigger value="payment" className="rounded-lg">Payment instructions</TabsTrigger>
          <TabsTrigger value="support" className="rounded-lg">Support contact</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border bg-card p-6 shadow-soft space-y-4">
            <h3 className="font-display text-base font-semibold">Account details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Full name</Label><Input className="h-11 rounded-xl" defaultValue={user?.name} /></div>
              <div className="space-y-1.5"><Label>Role</Label><Input className="h-11 rounded-xl" defaultValue="Super Admin" disabled /></div>
              <div className="space-y-1.5 col-span-2"><Label>Email</Label><Input className="h-11 rounded-xl" defaultValue={user?.email} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input className="h-11 rounded-xl" defaultValue="+91 98765 43210" /></div>
              <div className="space-y-1.5"><Label>Timezone</Label><Input className="h-11 rounded-xl" defaultValue="Asia/Kolkata" /></div>
            </div>
            <Button onClick={() => toast.success("Account updated")}>Save changes</Button>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <h3 className="font-display text-base font-semibold">Profile photo</h3>
            <div className="mt-4 grid place-items-center aspect-square rounded-xl border-2 border-dashed bg-muted/30">
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary text-primary-foreground font-display text-2xl font-bold">CF</div>
            </div>
            <Button variant="outline" className="mt-3 w-full">Upload new photo</Button>
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChangePasswordCard />
          <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-3">
            <h3 className="font-display text-base font-semibold">Session protection</h3>
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
              <div>
                <div className="text-sm font-medium">Login alerts</div>
                <div className="text-xs text-muted-foreground">Email me on every new sign-in.</div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
              <div>
                <div className="text-sm font-medium">Session timeout</div>
                <div className="text-xs text-muted-foreground">Auto-logout after 30 minutes idle.</div>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <h3 className="font-display text-base font-semibold">Notification preferences</h3>
          {[
            "New clinic registration request",
            "Payment received from clinic",
            "Subscription expiring soon",
            "Subscription expired",
            "Support request from clinic",
          ].map(t => (
            <div key={t} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
              <div className="text-sm font-medium">{t}</div>
              <Switch defaultChecked />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="platform" className="mt-4 rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <h3 className="font-display text-base font-semibold">Platform configuration</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Platform name</Label><Input className="h-11 rounded-xl" defaultValue="ClinicFlow" /></div>
            <div className="space-y-1.5"><Label>Default currency</Label><Input className="h-11 rounded-xl" defaultValue="INR (₹)" /></div>
            <div className="space-y-1.5"><Label>Default timezone</Label><Input className="h-11 rounded-xl" defaultValue="Asia/Kolkata" /></div>
            <div className="space-y-1.5"><Label>Date format</Label><Input className="h-11 rounded-xl" defaultValue="DD MMM YYYY" /></div>
            <div className="space-y-1.5 col-span-2"><Label>Support email shown to clinics</Label><Input className="h-11 rounded-xl" defaultValue="support@clinicflow.io" /></div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
            <div>
              <div className="text-sm font-medium">Allow new clinic registrations</div>
              <div className="text-xs text-muted-foreground">Pending clinics still require manual approval.</div>
            </div>
            <Switch defaultChecked />
          </div>
          <Button onClick={() => toast.success("Platform settings saved")}>Save changes</Button>
        </TabsContent>

        <TabsContent value="subscription" className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ClinicFlow plan</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold">₹{SUBSCRIPTION_PRICE}</span>
              <span className="text-sm text-muted-foreground">/ month per clinic</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Single plan. Same features for every clinic — no tiers, no upgrades.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                "Unlimited doctors and receptionists",
                "Unlimited patients and prescriptions",
                "Appointments, billing & reports",
                "Document storage & backups",
                "Audit logs & data export",
                "Email support",
              ].map(f => <li key={f} className="flex gap-2"><span className="text-success">✓</span>{f}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
            <h3 className="font-display text-base font-semibold">Update plan price</h3>
            <p className="text-xs text-muted-foreground">Changes apply to new clinic registrations. Existing clinics keep their current price until renewal.</p>
            <div className="space-y-1.5"><Label>Monthly price (₹)</Label><Input type="number" className="h-11 rounded-xl" defaultValue={SUBSCRIPTION_PRICE} /></div>
            <div className="space-y-1.5"><Label>Plan description</Label><Textarea rows={3} className="rounded-xl" defaultValue="Full ClinicFlow access for a single clinic." /></div>
            <Button onClick={() => toast.success("Plan updated")}>Save plan</Button>
          </div>
        </TabsContent>

        <TabsContent value="payment" className="mt-4 rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <h3 className="font-display text-base font-semibold">Payment instructions</h3>
          <p className="text-sm text-muted-foreground">Shown to clinics during subscription registration. They upload a payment screenshot for your manual verification.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5"><Label>UPI ID</Label><Input className="h-11 rounded-xl" defaultValue="clinicflow@okhdfcbank" /></div>
            <div className="space-y-1.5"><Label>Payee name</Label><Input className="h-11 rounded-xl" defaultValue="ClinicFlow Technologies" /></div>
            <div className="space-y-1.5"><Label>Bank name</Label><Input className="h-11 rounded-xl" defaultValue="HDFC Bank" /></div>
            <div className="space-y-1.5"><Label>Account number</Label><Input className="h-11 rounded-xl" defaultValue="50100 4421 09876" /></div>
            <div className="space-y-1.5"><Label>IFSC code</Label><Input className="h-11 rounded-xl" defaultValue="HDFC0001234" /></div>
            <div className="space-y-1.5"><Label>Branch</Label><Input className="h-11 rounded-xl" defaultValue="MG Road, Bengaluru" /></div>
          </div>
          <div className="space-y-1.5"><Label>Additional notes</Label><Textarea rows={3} className="rounded-xl"
            defaultValue="After payment, please upload the screenshot in the registration form. Activation typically completes within 24 hours." /></div>
          <Button onClick={() => toast.success("Payment instructions saved")}>Save instructions</Button>
        </TabsContent>

        <TabsContent value="support" className="mt-4 rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <h3 className="font-display text-base font-semibold">Support contact information</h3>
          <p className="text-sm text-muted-foreground">Shown on the in-app Support page to all clinic users.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Support name</Label><Input className="h-11 rounded-xl" defaultValue="ClinicFlow Support" /></div>
            <div className="space-y-1.5"><Label>Phone number</Label><Input className="h-11 rounded-xl" defaultValue="+91 80 4567 8900" /></div>
            <div className="space-y-1.5"><Label>WhatsApp number</Label><Input className="h-11 rounded-xl" defaultValue="+91 98765 43210" /></div>
            <div className="space-y-1.5"><Label>Email address</Label><Input className="h-11 rounded-xl" defaultValue="support@clinicflow.io" /></div>
          </div>
          <Button onClick={() => toast.success("Support contact saved")}>Save</Button>
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ----------------- Clinic Admin / Doctor / Receptionist ----------------- */
function ClinicSettings() {
  const { user, updateCurrentUserProfile } = useAuth();
  const { doctors, receptionists, staffMembers, updateStaff } = useWorkspaceData();
  const canEditClinic = user?.role === "clinic_admin";

  // Identify matching record for Doctor or Receptionist
  const doctorProfile = user?.role === "doctor"
    ? doctors.find((d) => d.id === user.userId || (d.email && user.email && d.email.toLowerCase() === user.email.toLowerCase()))
      || staffMembers.find((m) => m.role === "doctor" && (m.id === user.userId || (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase())))
    : null;

  const receptionistProfile = user?.role === "receptionist"
    ? receptionists.find((r) => r.id === user.userId || (r.email && user.email && r.email.toLowerCase() === user.email.toLowerCase()))
      || staffMembers.find((m) => m.role === "receptionist" && (m.id === user.userId || (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase())))
    : null;

  // Form states for Doctor & Receptionist with localStorage persistence
  const getStoredDoctor = () => {
    try {
      if (typeof window !== "undefined" && user?.userId) {
        const raw = localStorage.getItem(`cf_profile_doctor_${user.userId}`);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return null;
  };

  const getStoredReceptionist = () => {
    try {
      if (typeof window !== "undefined" && user?.userId) {
        const raw = localStorage.getItem(`cf_profile_receptionist_${user.userId}`);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return null;
  };

  const storedDoc = getStoredDoctor();
  const storedRec = getStoredReceptionist();

  const [docName, setDocName] = useState(storedDoc?.name || "");
  const [docSpecialty, setDocSpecialty] = useState(storedDoc?.specialty || "");
  const [docGender, setDocGender] = useState<"female" | "male" | "other" | "">(storedDoc?.gender || "");
  const [docQualification, setDocQualification] = useState(storedDoc?.qualification || "");
  const [docRegNo, setDocRegNo] = useState(storedDoc?.medicalRegistrationNumber || "");
  const [docExperienceYears, setDocExperienceYears] = useState(storedDoc?.experienceYears || 0);
  const [docPhone, setDocPhone] = useState(storedDoc?.phone || "");
  const [docConsultationFee, setDocConsultationFee] = useState(storedDoc?.consultationFee || 0);
  const [docWorkingHours, setDocWorkingHours] = useState(storedDoc?.workingHours || "");
  const [docNotes, setDocNotes] = useState(storedDoc?.notes || "");

  // Form states for Receptionist
  const [recName, setRecName] = useState(storedRec?.name || "");
  const [recPhone, setRecPhone] = useState(storedRec?.phone || "");
  const [recShift, setRecShift] = useState(storedRec?.shift || "");

  // Generic / Admin user state
  const [genericName, setGenericName] = useState("");
  const [genericPhone, setGenericPhone] = useState("");

  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    if (user?.role === "doctor") {
      const doc = doctorProfile;
      const dAny = doc as any;
      const cached = getStoredDoctor();
      setDocName((prev) => (prev ? prev : (cached?.name || doc?.name || user?.name || "")));
      setDocSpecialty((prev) => (prev ? prev : (cached?.specialty || dAny?.specialty || "")));
      setDocGender((prev) => (prev ? prev : (cached?.gender || dAny?.gender || "")));
      setDocQualification((prev) => (prev ? prev : (cached?.qualification || dAny?.qualification || "")));
      setDocRegNo((prev) => (prev ? prev : (cached?.medicalRegistrationNumber || dAny?.medicalRegistrationNumber || "")));
      setDocExperienceYears((prev) => (prev ? prev : (cached?.experienceYears || dAny?.experienceYears || 0)));
      setDocPhone((prev) => (prev ? prev : (cached?.phone || dAny?.phone || "")));
      setDocConsultationFee((prev) => (prev ? prev : (cached?.consultationFee || dAny?.consultationFee || 0)));
      setDocWorkingHours((prev) => (prev ? prev : (cached?.workingHours || dAny?.workingHours || "")));
      setDocNotes((prev) => (prev ? prev : (cached?.notes || dAny?.notes || "")));
    } else if (user?.role === "receptionist") {
      const rec = receptionistProfile;
      const cached = getStoredReceptionist();
      setRecName((prev) => (prev ? prev : (cached?.name || rec?.name || user?.name || "")));
      setRecPhone((prev) => (prev ? prev : (cached?.phone || rec?.phone || "")));
      setRecShift((prev) => (prev ? prev : (cached?.shift || (rec as any)?.shift || "Morning (9–5)")));
    } else {
      setGenericName((prev) => (prev ? prev : (user?.name || "")));
      setGenericPhone((prev) => (prev ? prev : "+46 70 884 1100"));
    }
  }, [user, doctorProfile, receptionistProfile]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAccount(true);
    try {
      if (user?.role === "doctor") {
        if (!docName.trim()) {
          toast.error("Doctor name is required");
          return;
        }
        const targetId = doctorProfile?.id || user.userId;
        const payload = {
          id: targetId,
          name: docName.trim(),
          phone: docPhone.trim() || undefined,
          specialty: docSpecialty.trim() || undefined,
          gender: docGender || undefined,
          qualification: docQualification.trim() || undefined,
          medicalRegistrationNumber: docRegNo.trim() || undefined,
          experienceYears: Number(docExperienceYears) || 0,
          consultationFee: Number(docConsultationFee) || 0,
          workingHours: docWorkingHours.trim() || undefined,
          notes: docNotes.trim() || undefined,
        };

        if (typeof window !== "undefined" && user?.userId) {
          localStorage.setItem(`cf_profile_doctor_${user.userId}`, JSON.stringify(payload));
        }

        await updateStaff(payload);
        if (updateCurrentUserProfile) {
          updateCurrentUserProfile({ name: docName.trim() });
        }
        toast.success("Doctor details updated successfully");
      } else if (user?.role === "receptionist") {
        if (!recName.trim()) {
          toast.error("Receptionist name is required");
          return;
        }
        const targetId = receptionistProfile?.id || user.userId;
        const payload = {
          id: targetId,
          name: recName.trim(),
          phone: recPhone.trim() || undefined,
          shift: recShift.trim() || undefined,
        };

        if (typeof window !== "undefined" && user?.userId) {
          localStorage.setItem(`cf_profile_receptionist_${user.userId}`, JSON.stringify(payload));
        }

        await updateStaff(payload);
        if (updateCurrentUserProfile) {
          updateCurrentUserProfile({ name: recName.trim() });
        }
        toast.success("Receptionist details updated successfully");
      } else {
        toast.success("Saved");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile details");
    } finally {
      setSavingAccount(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Manage your clinic profile and preferences." />
      <Tabs defaultValue={canEditClinic ? "clinic" : "account"}>
        <TabsList className="rounded-xl bg-muted/60 p-1 flex-wrap h-auto">
          {canEditClinic && <TabsTrigger value="clinic" className="rounded-lg">Clinic profile</TabsTrigger>}
          {canEditClinic && <TabsTrigger value="hours" className="rounded-lg">Working hours</TabsTrigger>}
          <TabsTrigger value="account" className="rounded-lg">Account</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg">Notifications</TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg">Security</TabsTrigger>
        </TabsList>

        {canEditClinic && (
          <TabsContent value="clinic" className="mt-4 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border bg-card p-6 shadow-soft space-y-4">
              <h3 className="font-display text-base font-semibold">Clinic profile</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2"><Label>Clinic name</Label><Input className="h-11 rounded-xl" defaultValue={user?.clinic} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input className="h-11 rounded-xl" defaultValue="+46 8 555 0123" /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input className="h-11 rounded-xl" defaultValue="hello@northwood.health" /></div>
                <div className="space-y-1.5 col-span-2"><Label>Address</Label><Textarea rows={2} className="rounded-xl" defaultValue="Kungsgatan 32, 111 35 Stockholm, Sweden" /></div>
              </div>
              <Button onClick={() => toast.success("Saved")}>Save changes</Button>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-soft">
              <h3 className="font-display text-base font-semibold">Clinic logo</h3>
              <div className="mt-4 grid place-items-center aspect-square rounded-xl border-2 border-dashed bg-muted/30">
                <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary text-primary-foreground font-display text-2xl font-bold">{user?.clinicLogo}</div>
              </div>
              <Button variant="outline" className="mt-3 w-full">Upload new logo</Button>
            </div>
          </TabsContent>
        )}

        {canEditClinic && (
          <TabsContent value="hours" className="mt-4 rounded-2xl border bg-card p-6 shadow-soft">
            <h3 className="font-display text-base font-semibold">Working hours</h3>
            <div className="mt-4 divide-y">
              {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d, i) => (
                <div key={d} className="grid grid-cols-[120px_1fr_auto_auto] items-center gap-3 py-3">
                  <div className="text-sm font-semibold">{d}</div>
                  <div className="text-xs text-muted-foreground">{i >= 5 ? "Weekend" : "Weekday"}</div>
                  <Input type="time" defaultValue="09:00" className="h-10 w-28 rounded-lg" disabled={i === 6} />
                  <Input type="time" defaultValue="18:00" className="h-10 w-28 rounded-lg" disabled={i === 6} />
                </div>
              ))}
            </div>
          </TabsContent>
        )}

        <TabsContent value="account" className="mt-4 rounded-2xl border bg-card p-6 shadow-soft space-y-4 lg:max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">My account</h3>
              <p className="text-xs text-muted-foreground">
                {user?.role === "doctor"
                  ? "Manage your practitioner profile, qualifications and consultation details."
                  : user?.role === "receptionist"
                  ? "Manage your staff profile and shift details."
                  : "Manage your personal profile details."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveAccount} className="space-y-4">
            {user?.role === "doctor" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Full name *</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Specialty *</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={docSpecialty}
                    onChange={(e) => setDocSpecialty(e.target.value)}
                    placeholder="e.g. Cardiology"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select value={docGender} onValueChange={(val: any) => setDocGender(val)}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Qualification</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={docQualification}
                    onChange={(e) => setDocQualification(e.target.value)}
                    placeholder="e.g. MBBS, MD"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Medical Registration Number</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={docRegNo}
                    onChange={(e) => setDocRegNo(e.target.value)}
                    placeholder="e.g. REG-12345"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Experience (Years)</Label>
                  <Input
                    type="number"
                    min="0"
                    className="h-11 rounded-xl"
                    value={docExperienceYears}
                    onChange={(e) => setDocExperienceYears(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone number</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={docPhone}
                    onChange={(e) => setDocPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Consultation Fee (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    className="h-11 rounded-xl"
                    value={docConsultationFee}
                    onChange={(e) => setDocConsultationFee(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Working Hours</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={docWorkingHours}
                    onChange={(e) => setDocWorkingHours(e.target.value)}
                    placeholder="e.g. 9:00 AM - 5:00 PM"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Email</Label>
                  <Input className="h-11 rounded-xl bg-muted/50" value={user?.email || ""} disabled />
                  <p className="text-[11px] text-muted-foreground">Email is tied to your login account and cannot be changed here.</p>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    className="rounded-xl"
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    placeholder="Additional practitioner bio or clinic notes..."
                  />
                </div>
              </div>
            ) : user?.role === "receptionist" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Full name *</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={recName}
                    onChange={(e) => setRecName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone number *</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={recPhone}
                    onChange={(e) => setRecPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Shift</Label>
                  <Select value={recShift} onValueChange={setRecShift}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Morning (9–5)">Morning (9–5)</SelectItem>
                      <SelectItem value="Morning (9 AM - 5 PM)">Morning (9 AM - 5 PM)</SelectItem>
                      <SelectItem value="Evening (1–9)">Evening (1–9)</SelectItem>
                      <SelectItem value="Evening (1 PM - 9 PM)">Evening (1 PM - 9 PM)</SelectItem>
                      <SelectItem value="Night (9 PM - 5 AM)">Night (9 PM - 5 AM)</SelectItem>
                      <SelectItem value="Full Day">Full Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Email</Label>
                  <Input className="h-11 rounded-xl bg-muted/50" value={user?.email || ""} disabled />
                  <p className="text-[11px] text-muted-foreground">Email is tied to your login account and cannot be changed here.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Full name</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={genericName}
                    onChange={(e) => setGenericName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input className="h-11 rounded-xl" defaultValue={user?.email} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={genericPhone}
                    onChange={(e) => setGenericPhone(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button type="submit" disabled={savingAccount} className="rounded-xl font-medium">
              {savingAccount ? "Saving changes..." : "Save changes"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          {(user?.role === "doctor"
            ? ["New appointment booked", "Patient signed prescription", "Follow-up reminder", "Lab report uploaded"]
            : ["New appointment booked", "Payment received", "Subscription expiring", "Subscription expired", "Patient signed prescription"]
          ).map(t => (
            <div key={t} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
              <div className="text-sm font-medium">{t}</div>
              <Switch defaultChecked />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="security" className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChangePasswordCard />
          <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-3">
            <h3 className="font-display text-base font-semibold">Two-factor auth</h3>
            <p className="text-sm text-muted-foreground">Protect your account with a second factor.</p>
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
              <span className="text-sm font-medium">Authenticator app</span><Switch />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
