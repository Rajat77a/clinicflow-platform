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
import { SUBSCRIPTION_PRICE } from "@/lib/sample-data";
import { supabaseConfig } from "@/lib/supabase/config";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useAuth();
  if (!supabaseConfig.demoMode) return <ProductionAccountSettings />;

  if (user?.role === "super_admin") return <PlatformSettings />;
  return <ClinicSettings />;
}

function ProductionAccountSettings() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      toast.error(policyError);
      return;
    }
    if (newPassword !== confirmation) {
      toast.error("Passwords do not match");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("Choose a password different from your current password");
      return;
    }

    setIsSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      toast.success("Password updated and other sessions revoked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update password");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Account security"
        description="Review your assigned hospital identity and protect your account."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="font-display text-base font-semibold">Assigned identity</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="account-name">Full name</Label>
              <Input id="account-name" value={user?.name ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-email">Work email</Label>
              <Input id="account-email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-role">Role</Label>
              <Input
                id="account-role"
                value={user?.role.replace("_", " ") ?? ""}
                disabled
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="account-hospital">Hospital</Label>
              <Input id="account-hospital" value={user?.clinic ?? ""} disabled />
            </div>
          </div>
        </section>

        <form className="rounded-lg border bg-card p-6" onSubmit={submitPassword}>
          <h2 className="font-display text-base font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Updating your password revokes your other signed-in sessions.
          </p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </div>
          </div>
          <Button className="mt-4" type="submit" disabled={isSaving}>
            {isSaving ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>
    </>
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
          <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
            <h3 className="font-display text-base font-semibold">Change password</h3>
            <div className="space-y-1.5"><Label>Current password</Label><Input type="password" className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>New password</Label><Input type="password" className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Confirm new password</Label><Input type="password" className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Email OTP confirmation</Label><Input inputMode="numeric" maxLength={6} className="h-11 rounded-xl" placeholder="6-digit OTP" /></div>
            <Button onClick={() => toast.success("Password updated after OTP confirmation")}>Update password</Button>
          </div>
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
          <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
            <h3 className="font-display text-base font-semibold">Password</h3>
            <div className="space-y-1.5"><Label>Current password</Label><Input type="password" className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>New password</Label><Input type="password" className="h-11 rounded-xl" /></div>
            <Button>Update password</Button>
          </div>
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
