import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData, type Clinic } from "@/lib/workspace-data";
import { Trash2, RotateCcw, ArrowLeft, MapPin, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clinics/bin")({ component: TrashBinPage });

function TrashBinPage() {
  const { user } = useAuth();
  const { binClinics, restoreClinic, permanentlyDeleteClinic } = useWorkspaceData();

  const [restoreTarget, setRestoreTarget] = useState<Clinic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Clinic | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-1 mb-4">
          The Trash Bin is accessible to Super Administrators only.
        </p>
        <Button asChild variant="outline">
          <Link to="/app">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setIsProcessing(true);
    try {
      await restoreClinic(restoreTarget.id);
      toast.success(`${restoreTarget.name} has been restored successfully`);
      setRestoreTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore clinic");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      await permanentlyDeleteClinic(deleteTarget.id);
      toast.success(`${deleteTarget.name} has been permanently deleted`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to permanently delete clinic");
    } finally {
      setIsProcessing(false);
    }
  };

  const getDaysRemaining = (deletedAt?: string) => {
    if (!deletedAt) return 30;
    const deletedDate = new Date(deletedAt).getTime();
    const now = Date.now();
    const daysOld = Math.floor((now - deletedDate) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysOld);
  };

  return (
    <>
      <PageHeader
        title="Clinic Trash Bin"
        description="Soft-deleted clinics are stored here for 30 days before being automatically purged."
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/clinics">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Clinics
            </Link>
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b p-4 text-sm font-medium text-muted-foreground">
          <Trash2 className="h-4 w-4 text-destructive" />
          <span>{binClinics.length} deleted clinic{binClinics.length === 1 ? "" : "s"} in Trash Bin</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Deleted Date</TableHead>
                <TableHead>Auto-Purge In</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {binClinics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    The Trash Bin is empty. No deleted clinics found.
                  </TableCell>
                </TableRow>
              ) : (
                binClinics.map((c) => {
                  const daysRemaining = getDaysRemaining(c.deletedAt);
                  const deletedFormatted = c.deletedAt
                    ? new Date(c.deletedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Recently";

                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground text-xs font-bold">
                            {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold line-through text-muted-foreground">{c.name}</div>
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
                      <TableCell className="text-muted-foreground tabular-nums">
                        {deletedFormatted}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={daysRemaining <= 5 ? "destructive" : "outline"}
                          className="tabular-nums"
                        >
                          {daysRemaining} day{daysRemaining === 1 ? "" : "s"} left
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRestoreTarget(c)}
                            title={`Restore ${c.name}`}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteTarget(c)}
                            title={`Permanently Delete ${c.name}`}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete Permanently
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      <Dialog open={Boolean(restoreTarget)} onOpenChange={(open) => { if (!open) setRestoreTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-emerald-600" /> Restore Clinic
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore <strong>{restoreTarget?.name}</strong>?
              The clinic will be reactivated and moved back to the active clinics list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreTarget(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
              {isProcessing ? "Restoring..." : "Confirm Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Permanent Deletion Warning
            </DialogTitle>
            <DialogDescription>
              This action <strong>CANNOT be undone</strong>. <strong>{deleteTarget?.name}</strong> and all associated staff, records, and data will be permanently removed from the database immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={isProcessing}>
              {isProcessing ? "Deleting..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
