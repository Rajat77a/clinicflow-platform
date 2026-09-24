import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData, type Clinic, type StaffMember } from "@/lib/workspace-data";
import { Trash2, RotateCcw, ArrowLeft, AlertTriangle, ShieldAlert, CheckSquare, Building2, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clinics/bin")({ component: TrashBinPage });

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  clinic_admin: "Clinical Admin",
  doctor: "Doctor",
};

function getDaysRemaining(deletedAt?: string): number {
  if (!deletedAt) return 30;
  const deletedDate = new Date(deletedAt).getTime();
  const now = Date.now();
  const daysOld = Math.floor((now - deletedDate) / (1000 * 60 * 60 * 24));
  return Math.max(0, 30 - daysOld);
}

function TrashBinPage() {
  const { user } = useAuth();
  const {
    binClinics,
    restoreClinic,
    permanentlyDeleteClinic,
    bulkRestoreClinics,
    bulkPermanentlyDeleteClinics,
    emptyTrash,
    binStaffMembers,
    restoreStaff,
    permanentlyDeleteStaff,
    bulkRestoreStaff,
    bulkPermanentlyDeleteStaff,
  } = useWorkspaceData();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [restoreTarget, setRestoreTarget] = useState<Clinic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Clinic | null>(null);
  const [restoreUserTarget, setRestoreUserTarget] = useState<StaffMember | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<StaffMember | null>(null);
  const [showEmptyTrashDialog, setShowEmptyTrashDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkRestoreDialog, setShowBulkRestoreDialog] = useState(false);
  const [showBulkRestoreUsersDialog, setShowBulkRestoreUsersDialog] = useState(false);
  const [showBulkDeleteUsersDialog, setShowBulkDeleteUsersDialog] = useState(false);
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

  const handleRestoreUser = async () => {
    if (!restoreUserTarget) return;
    setIsProcessing(true);
    try {
      await restoreStaff(restoreUserTarget.id);
      toast.success(`${restoreUserTarget.name} has been restored successfully`);
      setRestoreUserTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore user");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setIsProcessing(true);
    try {
      await permanentlyDeleteStaff(deleteUserTarget.id);
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteUserTarget.id);
        return next;
      });
      toast.success(`${deleteUserTarget.name} has been permanently deleted`);
      setDeleteUserTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to permanently delete user");
    } finally {
      setIsProcessing(false);
    }
  };

  const allUsersSelected =
    binStaffMembers.length > 0 && binStaffMembers.every((m) => selectedUserIds.has(m.id));
  const someUsersSelected =
    binStaffMembers.some((m) => selectedUserIds.has(m.id));

  const toggleSelectAllUsers = () => {
    if (allUsersSelected) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(binStaffMembers.map((m) => m.id)));
    }
  };

  const toggleSelectOneUser = (id: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedUserIds(next);
  };

  const handleBulkRestoreUsers = async () => {
    if (selectedUserIds.size === 0) return;
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedUserIds);
      await bulkRestoreStaff(ids);
      toast.success(`Restored ${ids.length} user${ids.length === 1 ? "" : "s"} successfully`);
      setSelectedUserIds(new Set());
      setShowBulkRestoreUsersDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore selected users");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPermanentDeleteUsers = async () => {
    if (selectedUserIds.size === 0) return;
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedUserIds);
      await bulkPermanentlyDeleteStaff(ids);
      toast.success(`Permanently deleted ${ids.length} user${ids.length === 1 ? "" : "s"}`);
      setSelectedUserIds(new Set());
      setShowBulkDeleteUsersDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete selected users");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Trash"
        description="Manage soft-deleted clinics and users. Items can be restored or permanently removed."
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

      <Tabs defaultValue="clinics" className="w-full space-y-6">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="clinics" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span>Clinics</span>
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {binClinics.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span>Users</span>
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {binStaffMembers.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* CLINICS TAB */}
        <TabsContent value="clinics" className="space-y-4">
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
                    <TableHead>Clinic Name</TableHead>
                    <TableHead>Clinic ID</TableHead>
                    <TableHead>Deleted Date</TableHead>
                    <TableHead>Deleted By</TableHead>
                    <TableHead>Auto-Purge In</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {binClinics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
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
                                <div className="text-xs text-muted-foreground">{c.city}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {c.id}
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums text-sm">
                            {deletedFormatted}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {c.deletedBy || "Super Admin"}
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
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
          <div className="rounded-2xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b p-4 text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-destructive" />
                <span>{binStaffMembers.length} deleted user{binStaffMembers.length === 1 ? "" : "s"} in Trash</span>
              </div>
            </div>

            {/* Bulk Selection Toolbar for Users */}
            {selectedUserIds.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-destructive/5 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <CheckSquare className="h-4 w-4 text-destructive" />
                  <span>{selectedUserIds.size} user{selectedUserIds.size === 1 ? "" : "s"} selected in Trash</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedUserIds(new Set())}
                    disabled={isProcessing}
                  >
                    Clear selection
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowBulkRestoreUsersDialog(true)}
                    disabled={isProcessing}
                    className="gap-1.5 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                    Restore Selected ({selectedUserIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowBulkDeleteUsersDialog(true)}
                    disabled={isProcessing}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Permanently Delete Selected ({selectedUserIds.size})
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
                        aria-label="Select all deleted users"
                        checked={allUsersSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = !allUsersSelected && someUsersSelected;
                        }}
                        onChange={toggleSelectAllUsers}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Previously Assigned Clinic</TableHead>
                    <TableHead>Deleted Date</TableHead>
                    <TableHead>Deleted By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {binStaffMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        The Trash is empty. No deleted users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    binStaffMembers.map((member) => {
                      const deletedFormatted = member.deletedAt
                        ? new Date(member.deletedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Recently";

                      return (
                        <TableRow key={member.id}>
                          <TableCell className="w-12 text-center">
                            <input
                              type="checkbox"
                              aria-label={`Select ${member.name}`}
                              checked={selectedUserIds.has(member.id)}
                              onChange={() => toggleSelectOneUser(member.id)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground text-xs font-bold">
                                {member.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold line-through text-muted-foreground">{member.name}</div>
                                <div className="font-mono text-xs text-muted-foreground">{member.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {member.email}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-medium text-muted-foreground">
                              {roleLabels[member.role] || member.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5" />
                              <span>{member.previousClinicName || "None"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums text-sm">
                            {deletedFormatted}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {member.deletedBy || "Super Admin"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRestoreUserTarget(member)}
                                title={`Restore ${member.name}`}
                              >
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                                Restore
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteUserTarget(member)}
                                title={`Permanently Delete ${member.name}`}
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
        </TabsContent>
      </Tabs>

      {/* Restore Clinic Confirmation Dialog */}
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

      {/* Single Permanent Delete Clinic Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Permanent Deletion Warning
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                This action <strong>cannot be undone</strong>. Permanently delete this record? Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong>?
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
                This action <strong>cannot be undone</strong>. Permanently delete this record? Are you sure you want to permanently delete the <strong>{selectedIds.size}</strong> selected clinic{selectedIds.size === 1 ? "" : "s"}?
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
                This action <strong>cannot be undone</strong>. Permanently delete this record? Are you sure you want to permanently delete <strong>all {binClinics.length} clinics</strong> currently in the Trash?
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

      {/* Restore User Confirmation Dialog */}
      <Dialog open={Boolean(restoreUserTarget)} onOpenChange={(open) => { if (!open) setRestoreUserTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-emerald-600" /> Restore User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore <strong>{restoreUserTarget?.name}</strong>?
              The user will be reactivated and returned to User Management.
            </DialogDescription>
          </DialogHeader>
          {restoreUserTarget?.previousClinicName && (
            <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1">
              <div className="text-muted-foreground">Previously Assigned Clinic:</div>
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                {restoreUserTarget.previousClinicName}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreUserTarget(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleRestoreUser} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
              {isProcessing ? "Restoring..." : "Confirm Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Permanent Delete User Confirmation Dialog */}
      <Dialog open={Boolean(deleteUserTarget)} onOpenChange={(open) => { if (!open) setDeleteUserTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Permanent Deletion Warning
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                This action cannot be undone. Permanently delete this record?
              </p>
              {deleteUserTarget && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
                  <div className="font-semibold text-sm">{deleteUserTarget.name}</div>
                  <div>{deleteUserTarget.email}</div>
                  <div>Role: {roleLabels[deleteUserTarget.role] || deleteUserTarget.role}</div>
                  {deleteUserTarget.previousClinicName && (
                    <div>Previously assigned to: {deleteUserTarget.previousClinicName}</div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserTarget(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handlePermanentDeleteUser} disabled={isProcessing}>
              {isProcessing ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk Restore Users Dialog */}
      <Dialog open={showBulkRestoreUsersDialog} onOpenChange={setShowBulkRestoreUsersDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-emerald-600" /> Restore Selected Users
            </DialogTitle>
            <DialogDescription className="pt-2 text-left">
              Are you sure you want to restore {selectedUserIds.size} user{selectedUserIds.size === 1 ? "" : "s"}?
              Their accounts will be reactivated with their previous hospital assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkRestoreUsersDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleBulkRestoreUsers} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
              {isProcessing ? "Restoring..." : `Restore ${selectedUserIds.size} Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Permanent Delete Users Dialog */}
      <Dialog open={showBulkDeleteUsersDialog} onOpenChange={setShowBulkDeleteUsersDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Permanent Deletion Warning
            </DialogTitle>
            <DialogDescription className="pt-2 text-left space-y-2">
              <p>
                This action cannot be undone. Permanently delete {selectedUserIds.size} selected user record{selectedUserIds.size === 1 ? "" : "s"}?
              </p>
              <p className="text-xs text-muted-foreground">
                All associated credentials and profile records will be permanently removed.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteUsersDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkPermanentDeleteUsers} disabled={isProcessing}>
              {isProcessing ? "Deleting..." : `Permanently Delete ${selectedUserIds.size} Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
