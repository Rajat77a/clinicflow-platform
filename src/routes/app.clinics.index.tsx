import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspaceData, type Clinic } from "@/lib/workspace-data";
import { Search, Plus, Download, MapPin, Pencil, Trash2 } from "lucide-react";
import { downloadCSV } from "@/lib/exporters";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/clinics/")({ component: ClinicsPage });

function ClinicsPage() {
  const { clinics, deleteClinic } = useWorkspaceData();
  const navigate = useNavigate();
  const [access, setAccess] = useState<Record<string, "Allowed" | "Suspended">>({});
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Clinic | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const exportClinic = (c: Clinic) => {
    const summary = [{
      clinicId: c.id, clinicName: c.name, location: c.city,
      doctors: c.doctors, receptionists: c.receptionists, patients: c.patients,
      plan: c.plan, subscriptionStatus: c.status, renews: c.expires, access: access[c.id] ?? "Allowed",
    }];
    downloadCSV(`${c.id}-summary.csv`, summary);
    toast.success(`Exported ${c.name}`);
  };

  const exportAll = () => {
    const combined = clinics.map(c => ({
      clinicId: c.id, clinicName: c.name, location: c.city,
      doctors: c.doctors, receptionists: c.receptionists, patients: c.patients,
      plan: c.plan, subscriptionStatus: c.status, renews: c.expires, access: access[c.id] ?? "Allowed",
    }));
    downloadCSV("clinicflow-all-clinics.csv", combined);
    toast.success("Exported all clinics");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteClinic(deleteTarget.id);
      toast.success(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete the clinic");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Clinics"
        description="Manage hospital clinics, access, staff counts and exports."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportAll}>
              <Download className="mr-1.5 h-4 w-4" />Download
            </Button>
            <Button asChild>
              <Link to="/app/clinics/new"><Plus className="mr-1.5 h-4 w-4" /> Add Clinic</Link>
            </Button>
          </div>
        } />
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search clinics, cities…" className="h-10 rounded-xl bg-muted/30 pl-9" />
          </div>
          <Button variant="outline">Filter</Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Doctors</TableHead>
                <TableHead className="text-right">Receptionists</TableHead>
                <TableHead className="text-right">Patients</TableHead>
                <TableHead>Renews</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinics.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground text-xs font-bold">
                        {c.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.city}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.doctors}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.receptionists}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.patients.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{c.expires}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "Active" ? "secondary" : c.status === "Expiring" ? "outline" : "destructive"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => exportClinic(c)}
                        title={`Export ${c.name}`}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate({ to: `/app/clinics/${c.id}/edit` })}
                        title={`Edit ${c.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(c)}
                        title={`Delete ${c.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete clinic</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} and all its data will be permanently removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete clinic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
