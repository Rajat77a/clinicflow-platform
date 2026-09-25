import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData, type Clinic, type StaffMember } from "@/lib/workspace-data";
import { Search, Plus, Download, MapPin, Pencil, Power, Trash2, CheckSquare, AlertTriangle, Users } from "lucide-react";
import { downloadCSV } from "@/lib/exporters";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/clinics/")({ component: ClinicsPage });

function ClinicsPage() {
  const { user } = useAuth();
  const { clinics, binClinics, staffMembers, setClinicAccess, softDeleteClinic, bulkSoftDeleteClinics } = useWorkspaceData();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [suspendTarget, setSuspendTarget] = useState<Clinic | null>(null);
  const [isSuspending, setIsSuspending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Clinic | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const isSuperAdmin = user?.role === "super_admin";

  const clinicAdminCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    staffMembers.forEach((member) => {
      if (member.role === "clinic_admin" && member.clinicId && member.status !== "Inactive") {
        counts[member.clinicId] = (counts[member.clinicId] || 0) + 1;
      }
    });
    return counts;
  }, [staffMembers]);

  const clinicAdminInvitedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    staffMembers.forEach((member) => {
      if (member.role === "clinic_admin" && member.clinicId && member.status === "Invited") {
        counts[member.clinicId] = (counts[member.clinicId] || 0) + 1;
      }
    });
    return counts;
  }, [staffMembers]);

  const visibleClinics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [clinics, searchQuery]);

  const allVisibleSelected =
    visibleClinics.length > 0 && visibleClinics.every((c) => selectedIds.has(c.id));
  const someVisibleSelected =
    visibleClinics.some((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const next = new Set(selectedIds);
      visibleClinics.forEach((c) => next.delete(c.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      visibleClinics.forEach((c) => next.add(c.id));
      setSelectedIds(next);
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

  const exportClinic = (c: Clinic) => {
    const adminCount = clinicAdminCounts[c.id] ?? 0;
    const invitedCount = clinicAdminInvitedCounts[c.id] ?? 0;
    const summary = [{
      clinicId: c.id, clinicName: c.name, location: c.city,
      doctors: c.doctors, receptionists: c.receptionists, clinicAdmins: adminCount, invitedAdmins: invitedCount, patients: c.patients,
      plan: c.plan, subscriptionStatus: c.status, renews: c.expires,
    }];
    downloadCSV(`${c.id}-summary.csv`, summary);
    toast.success(`Exported ${c.name}`);
  };

  const exportAll = () => {
    const combined = clinics.map(c => {
      const adminCount = clinicAdminCounts[c.id] ?? 0;
      const invitedCount = clinicAdminInvitedCounts[c.id] ?? 0;
      return {
        clinicId: c.id, clinicName: c.name, location: c.city,
        doctors: c.doctors, receptionists: c.receptionists, clinicAdmins: adminCount, invitedAdmins: invitedCount, patients: c.patients,
        plan: c.plan, subscriptionStatus: c.status, renews: c.expires,
      };
    });
    downloadCSV("clinicflow-all-clinics.csv", combined);
    toast.success("Exported all clinics");
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setIsSuspending(true);
    try {
      const next = suspendTarget.access === "Allowed" ? "Suspended" : "Allowed";
      await setClinicAccess(suspendTarget.id, next === "Allowed");
      toast.success(`${suspendTarget.name} set to ${next.toLowerCase()}`);
      setSuspendTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the clinic");
    } finally {
      setIsSuspending(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await softDeleteClinic(deleteTarget.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      toast.success(`${deleteTarget.name} and all associated users deactivated and moved to Trash`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete clinic");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkSoftDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await bulkSoftDeleteClinics(ids);
      toast.success(`${ids.length} clinic${ids.length === 1 ? "" : "s"} and all associated users deactivated and moved to Trash`);
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete selected clinics");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Clinics"
        description="Manage hospital clinics, access, staff counts and exports."
        actions={isSuperAdmin ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportAll}>
              <Download className="mr-1.5 h-4 w-4" />Download
            </Button>
            <Button variant="outline" asChild>
              <Link to="/app/clinics/bin">
                <Trash2 className="mr-1.5 h-4 w-4" /> Trash
                {binClinics.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive/15 text-destructive px-1.5 py-0.5 text-xs font-semibold">
                    {binClinics.length}
                  </span>
                )}
              </Link>
            </Button>
            <Button asChild>
              <Link to="/app/clinics/new"><Plus className="mr-1.5 h-4 w-4" /> Add Clinic</Link>
            </Button>
          </div>
        ) : undefined}
      />

      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clinics, cities…"
              className="h-10 rounded-xl bg-muted/30 pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
              Clear
            </Button>
          )}
        </div>

        {/* Bulk Selection Toolbar */}
        {isSuperAdmin && selectedIds.size > 0 && (
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
                variant="destructive"
                onClick={() => setShowBulkDeleteDialog(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Move Selected to Trash ({selectedIds.size})
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isSuperAdmin && (
                  <TableHead className="w-12 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all clinics"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                      }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                    />
                  </TableHead>
                )}
                <TableHead>Clinic</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Doctors</TableHead>
                <TableHead className="text-right">Receptionists</TableHead>
                <TableHead className="text-right">Clinic Admins</TableHead>
                <TableHead className="text-right">Patients</TableHead>
                <TableHead>Renews</TableHead>
                <TableHead>Subscription</TableHead>
                {isSuperAdmin && <TableHead>Access</TableHead>}
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleClinics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 11 : 9} className="h-28 text-center text-muted-foreground">
                    {searchQuery ? "No clinics matching search query." : "No active clinics found."}
                  </TableCell>
                </TableRow>
              ) : (
                visibleClinics.map((c) => (
                  <TableRow key={c.id} className={selectedIds.has(c.id) ? "bg-muted/40" : undefined}>
                    {isSuperAdmin && (
                      <TableCell className="w-12 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.name}`}
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelectOne(c.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                        />
                      </TableCell>
                    )}
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
                    <TableCell className="text-right tabular-nums">
                      <div className="flex items-center justify-end gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {clinicAdminCounts[c.id] ?? 0}
                        {clinicAdminInvitedCounts[c.id] && clinicAdminInvitedCounts[c.id] > 0 && (
                          <Badge variant="outline" className="text-xs ml-1">
                            +{clinicAdminInvitedCounts[c.id]} invited
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.patients.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{c.expires}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "Active" ? "secondary" : c.status === "Expiring" ? "outline" : "destructive"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant={c.access === "Allowed" ? "outline" : "destructive"}
                          onClick={() => setSuspendTarget(c)}
                        >
                          <Power className="mr-1 h-3.5 w-3.5" />
                          {c.access}
                        </Button>
                      </TableCell>
                    )}
                    {isSuperAdmin && (
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
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(c)}
                            title={`Delete ${c.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Suspend Confirmation Dialog */}
      <Dialog open={Boolean(suspendTarget)} onOpenChange={(open) => { if (!open) setSuspendTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Toggle clinic access</DialogTitle>
            <DialogDescription>
              {suspendTarget?.name} will be set to{" "}
              {suspendTarget?.access === "Allowed" ? "Suspended" : "Allowed"}.
              This affects staff access to the clinic.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)} disabled={isSuspending}>Cancel</Button>
            <Button
              variant={suspendTarget?.access === "Allowed" ? "destructive" : "default"}
              onClick={handleSuspend}
              disabled={isSuspending}
            >
              {isSuspending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Move to Trash Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Move to Trash & Deactivate Users
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              </p>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Warning: All Associated Users Will Be Deactivated</span>
                </div>
                <p>
                  Deleting this clinic will immediately deactivate all users associated with this clinic so they cannot log in:
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
                The clinic will be kept in the Trash for up to 30 days before being permanently purged.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleSoftDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Moving to Trash..." : "Delete Clinic & Users"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move to Trash Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={(open) => { if (!open) setShowBulkDeleteDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Move {selectedIds.size} Clinic{selectedIds.size === 1 ? "" : "s"} to Trash
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                Are you sure you want to delete the <strong>{selectedIds.size}</strong> selected clinic{selectedIds.size === 1 ? "" : "s"}?
              </p>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Warning: Associated Users Will Be Deactivated</span>
                </div>
                <p>
                  Deleting these clinics will immediately deactivate all associated users across all selected clinics:
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
                They will be kept in the Trash Bin for up to 30 days before being permanently purged.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)} disabled={isBulkDeleting}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleBulkSoftDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? "Moving to Trash..." : `Delete ${selectedIds.size} Clinics & Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
