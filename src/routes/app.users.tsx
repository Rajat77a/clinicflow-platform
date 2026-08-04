import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth, type Role } from "@/lib/auth";
import { useWorkspaceData, type StaffMember } from "@/lib/workspace-data";
import { UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/users")({ component: UsersPage });

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  clinic_admin: "Clinic Admin",
  doctor: "Doctor",
  receptionist: "Receptionist",
};

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function UsersPage() {
  const { user } = useAuth();
  const { staffMembers, inviteSuperAdmin, deactivateStaff } = useWorkspaceData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [deactivationTarget, setDeactivationTarget] = useState<StaffMember | null>(null);
  const [deactivationReason, setDeactivationReason] = useState("");
  const [isDeactivating, setIsDeactivating] = useState(false);

  const canDeactivate = (member: StaffMember) => (
    member.status !== "Inactive"
    && member.id !== user?.userId
    && member.role !== "super_admin"
    && (
      user?.role === "super_admin"
      || (user?.role === "clinic_admin" && member.role !== "clinic_admin")
    )
  );

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setIsSending(true);
    try {
      const tempPassword = generateTempPassword();
      await inviteSuperAdmin({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        tempPassword,
      });
      toast.success(`Super Admin added · temporary password sent to ${form.email.trim()}`);
      setDialogOpen(false);
      setForm({ name: "", email: "", phone: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add the super admin");
    } finally {
      setIsSending(false);
    }
  };

  const confirmDeactivation = async () => {
    if (!deactivationTarget) return;
    setIsDeactivating(true);
    try {
      await deactivateStaff(deactivationTarget.id, deactivationReason);
      toast.success(`${deactivationTarget.name} no longer has hospital access`);
      setDeactivationTarget(null);
      setDeactivationReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to deactivate staff member");
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Hospital staff with access to ClinicFlow."
        actions={user?.role === "super_admin" ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="mr-1.5 h-4 w-4" />Add Super Admin</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Super Admin</DialogTitle>
                <DialogDescription>
                  A temporary password will be generated and sent to the email address provided.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className="h-11 rounded-xl"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="h-11 rounded-xl"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    className="h-11 rounded-xl"
                    autoComplete="tel"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={isSending} className="w-full">
                  {isSending ? "Adding..." : "Add Super Admin"}
                </Button>
              </DialogFooter>
              </DialogContent>
          </Dialog>
        ) : undefined}
      />

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div className="font-semibold">{member.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{member.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{member.email || "Invitation pending"}</TableCell>
                <TableCell><Badge variant="outline">{roleLabels[member.role]}</Badge></TableCell>
                <TableCell>
                  <Badge variant={member.status === "Active" ? "secondary" : "outline"}>{member.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canDeactivate(member) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title={`Deactivate ${member.name}`}
                      aria-label={`Deactivate ${member.name}`}
                      onClick={() => setDeactivationTarget(member)}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {staffMembers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No staff memberships are visible for this account.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(deactivationTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeactivating) {
            setDeactivationTarget(null);
            setDeactivationReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate staff access</DialogTitle>
            <DialogDescription>
              {deactivationTarget?.name} will immediately lose hospital data access and be removed
              from active care teams. Existing clinical and audit records will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="deactivation-reason">Reason</Label>
            <Textarea
              id="deactivation-reason"
              value={deactivationReason}
              onChange={(event) => setDeactivationReason(event.target.value)}
              minLength={8}
              maxLength={500}
              placeholder="Example: Employment ended on 30 July 2026"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeactivationTarget(null)}
              disabled={isDeactivating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeactivation}
              disabled={isDeactivating || deactivationReason.trim().length < 8}
            >
              {isDeactivating ? "Deactivating..." : "Deactivate access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
