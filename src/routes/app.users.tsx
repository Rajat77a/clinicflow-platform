import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth, type Role } from "@/lib/auth";
import { useWorkspaceData } from "@/lib/workspace-data";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/users")({ component: UsersPage });

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  clinic_admin: "Clinic Admin",
  doctor: "Doctor",
  receptionist: "Receptionist",
};

function UsersPage() {
  const { user } = useAuth();
  const { staffMembers, inviteClinicAdmin } = useWorkspaceData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [superDialogOpen, setSuperDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [superForm, setSuperForm] = useState({ name: "", email: "", temporaryPassword: "" });

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setIsSending(true);
    try {
      await inviteClinicAdmin({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      toast.success(`Secure invitation sent to ${form.email.trim()}`);
      setDialogOpen(false);
      setForm({ name: "", email: "", phone: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send the invitation");
    } finally {
      setIsSending(false);
    }
  };

  const submitSuperAdmin = async () => {
    if (!superForm.name.trim() || !superForm.email.trim() || !superForm.temporaryPassword.trim()) {
      toast.error("Name, email and temporary password are required");
      return;
    }
    toast.success(`Super Admin credentials queued for ${superForm.email.trim()}`);
    setSuperDialogOpen(false);
    setSuperForm({ name: "", email: "", temporaryPassword: "" });
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Hospital staff with access to ClinicFlow."
        actions={user?.role === "super_admin" ? (
          <div className="flex flex-wrap gap-2">
            <Dialog open={superDialogOpen} onOpenChange={setSuperDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><UserPlus className="mr-1.5 h-4 w-4" />Add Super Admin</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Super Admin</DialogTitle>
                  <DialogDescription>
                    Create another platform administrator. The role is fixed and cannot be changed from settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Full name</Label><Input className="h-11 rounded-xl" value={superForm.name} onChange={event => setSuperForm({ ...superForm, name: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" className="h-11 rounded-xl" value={superForm.email} onChange={event => setSuperForm({ ...superForm, email: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Temporary password</Label><Input type="password" className="h-11 rounded-xl" value={superForm.temporaryPassword} onChange={event => setSuperForm({ ...superForm, temporaryPassword: event.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={submitSuperAdmin} className="w-full">Create Super Admin</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="mr-1.5 h-4 w-4" />Invite Clinic Admin</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Invite Clinic Admin</DialogTitle>
                <DialogDescription>
                  Supabase will email a one-time invitation. ClinicFlow never creates or displays a temporary password.
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
                  {isSending ? "Sending invitation..." : "Send invitation"}
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
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
              </TableRow>
            ))}
            {staffMembers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No staff memberships are visible for this account.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
