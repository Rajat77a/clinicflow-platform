import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspaceData, type Doctor } from "@/lib/workspace-data";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/doctors")({ component: DoctorsRoute });

function DoctorsRoute() {
  const matches = useMatches();
  const hasChild = matches.some(m => m.routeId === "/app/doctors/new");
  if (hasChild) return <Outlet />;
  return <DoctorsPage />;
}

function DoctorsPage() {
  const { doctors, softDeleteStaff } = useWorkspaceData();
  const { user } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = Boolean(user && (user.role === "clinic_admin" || user.role === "super_admin"));

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await softDeleteStaff(deleteTarget.id);
      toast.success(`${deleteTarget.name} has been moved to Trash (held for 10 days, purged after 60 days)`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move doctor to Trash");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PageHeader title="Doctors" description="Practitioners at your clinic."
        actions={<Button asChild><Link to="/app/doctors/new"><Plus className="mr-1.5 h-4 w-4" />Add doctor</Link></Button>} />

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doctor</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead className="text-right">Patients</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              {canDelete && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors.map(d => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {d.avatarUrl ? (
                      <img src={d.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground text-xs font-semibold">
                        {d.name.split(" ").slice(-1)[0][0]}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>{d.specialty}</div>
                  <div className="text-xs text-muted-foreground">
                    {[d.qualification, d.medicalRegistrationNumber].filter(Boolean).join(" · ")}
                  </div>
                </TableCell>
                <TableCell>
                  <div>{d.workingHours || "Not assigned"}</div>
                  {d.consultationFee != null && <div className="text-xs text-muted-foreground">₹{d.consultationFee.toLocaleString("en-IN")}</div>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{d.patients}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div>{d.email}</div>
                  <div className="text-xs">{d.phone}</div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={d.status === "Active" ? "secondary" : d.status === "Expired" ? "destructive" : "outline"}
                    className={d.status === "Expired" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" : ""}
                  >
                    {d.status}
                  </Badge>
                </TableCell>
                {canDelete && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2"
                      onClick={() => setDeleteTarget(d)}
                      title="Move to Trash"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Move Doctor to Trash Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Move Doctor to Trash
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                Are you sure you want to move <strong className="text-foreground">{deleteTarget?.name}</strong> to the Trash?
              </p>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-medium">Trash Retention Policy:</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Record is retained in Trash for <strong>10 days</strong> before permanent deletion can be performed.</li>
                  <li>After <strong>60 days</strong>, the item will be automatically purged from the system.</li>
                  <li>Can be restored back to active staff at any time prior to permanent deletion.</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Moving to Trash..." : "Move to Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
