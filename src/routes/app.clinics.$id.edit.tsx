import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader } from "@/components/forms/file-uploader";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData } from "@/lib/workspace-data";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clinics/$id/edit")({ component: EditClinic });

function Field({ label, children, span = 6 }: { label: string; children: React.ReactNode; span?: number }) {
  const spanClass = span === 2 ? "md:col-span-2" : span === 3 ? "md:col-span-3" : span === 4 ? "md:col-span-4" : "md:col-span-6";
  return (
    <div className={`${spanClass} space-y-1.5`}>
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function EditClinic() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateClinic, softDeleteClinic, clinics } = useWorkspaceData();
  const { id } = useParams({ from: "/app/clinics/$id/edit" });
  const clinic = clinics.find(c => c.id === id);
  const isSuperAdmin = user?.role === "super_admin";

  const [form, setForm] = useState(() => ({
    id: clinic?.id ?? "",
    name: clinic?.name ?? "",
    email: "",
    phone: "",
    address: clinic?.city ?? "",
    logoName: "",
    adminName: "",
    adminEmail: "",
    adminPhone: "",
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (clinic) {
      setForm(prev => ({
        ...prev,
        id: clinic.id,
        name: prev.name || clinic.name,
        address: prev.address || clinic.city,
      }));
    }
  }, [clinic]);

  if (!clinic) {
    return (
      <>
        <PageHeader title="Clinic not found" description="The clinic you are looking for does not exist." />
        <Button variant="outline" onClick={() => navigate({ to: "/app/clinics" })}>Back to clinics</Button>
      </>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.address.trim()) return toast.error("Clinic name and address are required");

    setIsSaving(true);
    try {
      await updateClinic({
        id: form.id || clinic.id,
        name: form.name.trim(),
        city: form.address.split(",").map(part => part.trim()).filter(Boolean).at(-1) ?? form.address.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        logoName: form.logoName.trim(),
      });
      toast.success(`Clinic ${form.name.trim()} updated`);
      navigate({ to: "/app/clinics" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the clinic");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!clinic) return;
    setIsDeleting(true);
    try {
      await softDeleteClinic(clinic.id);
      toast.success(`${clinic.name} moved to Trash`);
      setShowDeleteDialog(false);
      navigate({ to: "/app/clinics" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete clinic");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Edit Clinic"
        description="Update the clinic details or move it to trash."
        actions={
          isSuperAdmin ? (
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Move to Trash
            </Button>
          ) : undefined
        }
      />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-4 font-display text-base font-semibold">Clinic details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <Field label="Clinic name" span={4}>
                <Input placeholder="Northwood Health" className="h-11 rounded-xl" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Plan" span={2}>
                <Input value={clinic.plan} disabled className="h-11 rounded-xl" />
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
          </section>

          {isSuperAdmin && (
            <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-destructive">Danger Zone</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Move this clinic to the Trash. The clinic will be deactivated and can be restored from the Trash.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Move to Trash
                </Button>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-3 font-display text-base font-semibold">Branding</h2>
            <FileUploader label="Drop logo or click to upload" accept="image/png,image/svg+xml,image/jpeg" hint="PNG or SVG, up to 2 MB" />
            <Input className="mt-3 h-10 rounded-xl" placeholder="Logo filename or note" value={form.logoName} onChange={event => setForm({ ...form, logoName: event.target.value })} />
          </section>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate({ to: "/app/clinics" })}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </aside>
      </form>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Move to Trash
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{clinic.name}</strong>?
              The clinic will be moved to the Trash where it will be kept for up to 30 days before being permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Moving to Trash..." : "Move to Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}