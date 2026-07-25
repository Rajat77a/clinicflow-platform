import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData } from "@/lib/workspace-data";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/users")({ component: UsersPage });

type Row = { id: string; name: string; email: string; role: string; status: string };

function UsersPage() {
  const { user } = useAuth();
  const { doctors, receptionists } = useWorkspaceData();
  const isSuper = user?.role === "super_admin";
  const isClinicAdmin = user?.role === "clinic_admin";

  const initial: Row[] = [
    ...doctors.map(d => ({ id: d.id, name: d.name, email: d.email, role: "Doctor", status: d.status })),
    ...receptionists.map(r => ({ id: r.id, name: r.name, email: r.email, role: "Receptionist", status: r.status })),
    { id: "AD-01", name: "Marcus Lindqvist", email: "marcus@northwood.health", role: "Clinic Admin", status: "Active" },
    { id: "SA-01", name: "Helena Vance", email: "helena@clinicflow.io", role: "Super Admin", status: "Active" },
  ];

  const [rows, setRows] = useState<Row[]>(initial);
  const [inviteRole, setInviteRole] = useState<"Super Admin" | "Clinic Admin" | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", tempPwd: "" });
  const genPwd = () => setForm(f => ({ ...f, tempPwd: "CF" + Math.random().toString(36).slice(2, 8) + "!" + Math.floor(Math.random() * 90 + 10) }));

  const submit = () => {
    if (!form.name.trim() || !form.email.trim() || form.tempPwd.length < 8) {
      toast.error("Name, email and a temp password (min 8 chars) are required");
      return;
    }
    const prefix = inviteRole === "Super Admin" ? "SA" : "AD";
    const nextId = `${prefix}-${String(rows.filter(r => r.id.startsWith(prefix)).length + 1).padStart(2, "0")}`;
    setRows([{ id: nextId, name: form.name, email: form.email, role: inviteRole!, status: "Active" }, ...rows]);
    toast.success(`${inviteRole} added. Login credentials emailed to ${form.email}`);
    setInviteRole(null);
    setForm({ name: "", email: "", phone: "", tempPwd: "" });
  };

  return (
    <>
      <PageHeader title="Users" description="Everyone with access to the platform."
        actions={
          <div className="flex gap-2">
            {isSuper && (
              <Dialog open={inviteRole === "Super Admin"} onOpenChange={(o) => setInviteRole(o ? "Super Admin" : null)}>
                <DialogTrigger asChild>
                  <Button variant="outline"><UserPlus className="mr-1.5 h-4 w-4" />Add Super Admin</Button>
                </DialogTrigger>
                <AddUserDialog title="Add Super Admin" form={form} setForm={setForm} onSubmit={submit} onGenerate={genPwd} />
              </Dialog>
            )}
            {isClinicAdmin && (
              <Dialog open={inviteRole === "Clinic Admin"} onOpenChange={(o) => setInviteRole(o ? "Clinic Admin" : null)}>
                <DialogTrigger asChild>
                  <Button><UserPlus className="mr-1.5 h-4 w-4" />Add Clinic Admin</Button>
                </DialogTrigger>
                <AddUserDialog title="Add Clinic Admin" form={form} setForm={setForm} onSubmit={submit} onGenerate={genPwd} />
              </Dialog>
            )}
          </div>
        } />

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
            {rows.map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground text-xs font-semibold">
                      {u.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                <TableCell><Badge variant={u.status === "Active" ? "secondary" : "outline"}>{u.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

type FormState = { name: string; email: string; phone: string; tempPwd: string };

function AddUserDialog({ title, form, setForm, onSubmit, onGenerate }: {
  title: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: () => void;
  onGenerate: () => void;
}) {
  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground">Email and temporary password are required — they will be emailed so the user can sign in.</p>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Full name</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-11 rounded-xl" placeholder="Full name" />
        </div>
        <div className="space-y-1.5"><Label>Email (login ID)</Label>
          <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-11 rounded-xl" placeholder="user@clinic.com" />
        </div>
        <div className="space-y-1.5"><Label>Phone</Label>
          <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-11 rounded-xl" placeholder="+91 …" />
        </div>
        <div className="space-y-1.5"><Label>Temporary password</Label>
          <div className="flex gap-2">
            <Input value={form.tempPwd} onChange={e => setForm({ ...form, tempPwd: e.target.value })} className="h-11 rounded-xl font-mono" placeholder="Min 8 characters" />
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onGenerate}>Generate</Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onSubmit} className="w-full">Add & send credentials</Button>
      </DialogFooter>
    </DialogContent>
  );
}

