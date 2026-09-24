import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData, type Clinic } from "@/lib/workspace-data";
import { Trash2, RotateCcw, ArrowLeft, MapPin, AlertTriangle, ShieldAlert, CheckSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clinics/bin")({ component: TrashBinPage });

function TrashBinPage() {
  const { user } = useAuth();
  const {
    binClinics,
    restoreClinic,
    permanentlyDeleteClinic,
    bulkRestoreClinics,
    bulkPermanentlyDeleteClinics,
    emptyTrash,
  } = useWorkspaceData();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [restoreTarget, setRestoreTarget] = useState<Clinic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Clinic | null>(null);
  const [showEmptyTrashDialog, setShowEmptyTrashDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkRestoreDialog, setShowBulkRestoreDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-1 mb-4">
          The Trash is accessible to Super Administrators only.
        </p>
        <Button asChild variant="outline">
          <Link to="/app">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const allSelected = binClinics.length > 0 && binClinics.every((c) => selectedIds.has(c.id));
  const someSelected = binClinics.some((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(binClinics.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setIsProcessing(true);
    try {
      await restoreClinic(restoreTarget.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(restoreTarget.id);
        return next;
      });
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      toast.success(`${deleteTarget.name} and all associated users permanently deleted`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to permanently delete clinic");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (binClinics.length === 0) return;
    setIsProcessing(true);
    try {
      await emptyTrash();
      toast.success("Trash emptied. All clinics and associated users permanently removed.");
      setSelectedIds(new Set());
      setShowEmptyTrashDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to empty trash");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      await bulkPermanentlyDeleteClinics(ids);
      toast.success(`Permanently deleted ${ids.length} clinic${ids.length === 1 ? "" : "s"} and all associated users`);
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete selected clinics");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      await bulkRestoreClinics(ids);
      toast.success(`Restored ${ids.length} clinic${ids.length === 1 ? "" : "s"} successfully`);
      setSelectedIds(new Set());
      setShowBulkRestoreDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore selected clinics");
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
        title="Clinic Trash"
        description="Soft-deleted clinics are stored here for up to 30 days before being automatically purged."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/app/clinics">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Clinics
              </Link>
            </Button>
            {binClinics.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => setShowEmptyTrashDialog(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Empty Trash ({binClinics.length})
              </Button>
            )}
          </div>
        }
      />

      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b p-4 text-sm font-medium text-muted-foreground">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            <span>{binClinics.length} deleted clinic{binClinics.length === 1 ? "" : "s"} in Trash</span>
          </div>
          {binClinics.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
              onClick={() => setShowEmptyTrashDialog(true)}
            >
              Delete All from Trash
            </Button>
          )}
        </div>

        {/* Bulk Selection Actions Toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-destructive/5 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <CheckSquare className="h-4 w-4 text-destructive" />
              <span>{selectedIds.size} clinic{selectedIds.size === 1 ? "" : "s"} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBulkRestoreDialog(true)}
                className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Restore Selected ({selectedIds.size})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowBulkDeleteDialog(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Selected Permanently ({selectedIds.size})
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all clinics in trash"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={toggleSelectAll}
                    disabled={binClinics.length === 0}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </TableHead>
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
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    The Trash is empty. No deleted clinics found.
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
                    <TableRow key={c.id} className={selectedIds.has(c.id) ? "bg-muted/40" : undefined}>
                      <TableCell className="w-12 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.name}`}
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelectOne(c.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                        />
                      </TableCell>
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

      {/* Bulk Restore Confirmation Dialog */}
      <Dialog open={showBulkRestoreDialog} onOpenChange={(open) => { if (!open) setShowBulkRestoreDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <RotateCcw className="h-5 w-5 text-emerald-600" /> Restore {selectedIds.size} Clinic{selectedIds.size === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore the <strong>{selectedIds.size}</strong> selected clinic{selectedIds.size === 1 ? "" : "s"}?
              They will be reactivated and moved back to the active clinics directory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkRestoreDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleBulkRestore} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
              {isProcessing ? "Restoring..." : `Restore ${selectedIds.size} Clinics`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Permanent Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Permanent Deletion Warning
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                This action <strong>CANNOT be undone</strong>. Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong>?
              </p>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Warning: All Associated Users Will Be Permanently Removed</span>
                </div>
                <p>
                  Permanently deleting this clinic will immediately and permanently erase all users associated with this clinic:
                </p>
                <ul className="list-disc list-inside font-medium space-y-0.5 pl-1">
                  <li>Clinical Admin</li>
                  <li>Doctors</li>
                  <li>Receptionists</li>
                  <li>Any other users assigned to this clinic</li>
                </ul>
                <p className="font-semibold pt-1">
                  Users cannot remain assigned to a clinic that no longer exists.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                All patient medical records, appointments, prescriptions, and bills will also be completely erased from the database.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={isProcessing}>
              {isProcessing ? "Deleting..." : "Permanently Delete Clinic & Users"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Permanent Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={(open) => { if (!open) setShowBulkDeleteDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Permanently Delete {selectedIds.size} Clinic{selectedIds.size === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                This action <strong>CANNOT be undone</strong>. Are you sure you want to permanently delete the <strong>{selectedIds.size}</strong> selected clinic{selectedIds.size === 1 ? "" : "s"}?
              </p>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Warning: All Associated Users Will Be Permanently Removed</span>
                </div>
                <p>
                  Permanently deleting these clinics will immediately erase all associated users across all selected clinics:
                </p>
                <ul className="list-disc list-inside font-medium space-y-0.5 pl-1">
                  <li>Clinical Admins</li>
                  <li>Doctors</li>
                  <li>Receptionists</li>
                  <li>Any other users assigned to these clinics</li>
                </ul>
                <p className="font-semibold pt-1">
                  Users cannot remain assigned to clinics that no longer exist.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                All associated records, staff, and clinical data will be permanently purged immediately.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkPermanentDelete} disabled={isProcessing}>
              {isProcessing ? "Deleting..." : `Delete ${selectedIds.size} Clinics & Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Empty All Trash Confirmation Dialog */}
      <Dialog open={showEmptyTrashDialog} onOpenChange={(open) => { if (!open) setShowEmptyTrashDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Empty Entire Clinic Trash
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                This action <strong>CANNOT be undone</strong>. Are you sure you want to permanently delete <strong>all {binClinics.length} clinics</strong> currently in the Trash?
              </p>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Warning: All Associated Users Will Be Permanently Removed</span>
                </div>
                <p>
                  All associated users across all trashed clinics will be erased permanently:
                </p>
                <ul className="list-disc list-inside font-medium space-y-0.5 pl-1">
                  <li>Clinical Admins</li>
                  <li>Doctors</li>
                  <li>Receptionists</li>
                  <li>Any other users assigned to these clinics</li>
                </ul>
                <p className="font-semibold pt-1">
                  No users can remain assigned to clinics that no longer exist.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                All hospital data, staff memberships, patients, appointments, and bills will be erased permanently.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmptyTrashDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleEmptyTrash} disabled={isProcessing}>
              {isProcessing ? "Emptying Trash..." : "Empty Trash & Erase All Users"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
