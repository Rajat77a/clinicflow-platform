import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useWorkspaceData } from "@/lib/workspace-data";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/receptionists")({ component: ReceptionistsPage });

function ReceptionistsPage() {
  const { receptionists: rows, createReceptionist } = useWorkspaceData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", shift: "Morning (9–5)" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Name, email and phone are required");
      return;
    }
    setSaving(true);
    try {
      const receptionist = await createReceptionist({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        shift: form.shift,
      });
      toast.success(`${receptionist.name} invited at ${form.email}`);
      setOpen(false);
      setForm({ name: "", email: "", phone: "", shift: "Morning (9–5)" });
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
    </>
  );
}
