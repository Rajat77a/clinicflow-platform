import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
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
  const { user } = useAuth();
  const canEditClinic = user?.role === "clinic_admin";
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
          <h3 className="font-display text-base font-semibold">My account</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2"><Label>Full name</Label><Input className="h-11 rounded-xl" defaultValue={user?.name} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input className="h-11 rounded-xl" defaultValue={user?.email} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input className="h-11 rounded-xl" defaultValue="+46 70 884 1100" /></div>
          </div>
          <Button onClick={() => toast.success("Saved")}>Save changes</Button>
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
