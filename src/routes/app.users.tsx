import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth, type Role } from "@/lib/auth";
import { useWorkspaceData, type StaffMember } from "@/lib/workspace-data";
import { UserMinus, UserPlus, Eye, Building2, ShieldCheck, Stethoscope, UserCog, Mail, Phone, Trash2, RotateCw, Send, CheckSquare, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/users")({ component: UsersPage });

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  clinic_admin: "Clinical Admin",
  doctor: "Doctor",
  receptionist: "Receptionist",
};

const roleIcons: Record<Role, React.ComponentType<{ className?: string }>> = {
  super_admin: ShieldCheck,
  clinic_admin: Building2,
  doctor: Stethoscope,
  receptionist: UserCog,
};

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function UsersPage() {
  const { user } = useAuth();
  const {
    staffMembers,
    clinics,
    inviteSuperAdmin,
    inviteClinicAdmin,
    createDoctor,
    createReceptionist,
    deactivateStaff,
    softDeleteStaff,
    bulkSoftDeleteStaff,
    resendStaffInvitation,
  } = useWorkspaceData();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [superAdminDialogOpen, setSuperAdminDialogOpen] = useState(false);
  const [clinicAdminDialogOpen, setClinicAdminDialogOpen] = useState(false);
  const [inviteStaffDialogOpen, setInviteStaffDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [superAdminForm, setSuperAdminForm] = useState({ name: "", email: "", phone: "" });
  const [clinicAdminForm, setClinicAdminForm] = useState({ name: "", email: "", phone: "", hospitalId: "" });
  const [inviteStaffForm, setInviteStaffForm] = useState<{
    role: Role;
    name: string;
    email: string;
    phone: string;
    hospitalId: string;
    specialty: string;
    shift: string;
  }>({
    role: "doctor",
    name: "",
    email: "",
    phone: "",
    hospitalId: clinics[0]?.id || "",
    specialty: "General Medicine",
    shift: "Morning (9–5)",
  });

  const [deactivationTarget, setDeactivationTarget] = useState<StaffMember | null>(null);
  const [deactivationReason, setDeactivationReason] = useState("");
  const [isDeactivating, setIsDeactivating] = useState(false);

  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics]);

  const canDeactivate = (member: StaffMember) => (
    member.status !== "Inactive"
    && member.id !== user?.userId
    && member.role !== "super_admin"
    && (
      user?.role === "super_admin"
      || (user?.role === "clinic_admin" && member.role !== "clinic_admin")
    )
  );

  const submitSuperAdmin = async () => {
    if (!superAdminForm.name.trim() || !superAdminForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setIsSending(true);
    try {
      const tempPassword = generateTempPassword();
      await inviteSuperAdmin({
        name: superAdminForm.name.trim(),
        email: superAdminForm.email.trim(),
        phone: superAdminForm.phone.trim(),
        tempPassword,
      });
      toast.success(`Super Admin added · invitation sent to ${superAdminForm.email.trim()}`);
      setSuperAdminDialogOpen(false);
      setSuperAdminForm({ name: "", email: "", phone: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add the super admin");
    } finally {
      setIsSending(false);
    }
  };

  const submitClinicAdmin = async () => {
    if (!clinicAdminForm.name.trim() || !clinicAdminForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clinicAdminForm.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!clinicAdminForm.hospitalId) {
      toast.error("Please select a clinic/hospital");
      return;
    }
    setIsSending(true);
    try {
      await inviteClinicAdmin({
        name: clinicAdminForm.name.trim(),
        email: clinicAdminForm.email.trim(),
        phone: clinicAdminForm.phone.trim(),
        hospitalId: clinicAdminForm.hospitalId,
      });
      toast.success(`Clinic Admin invited · 24-hour setup link sent to ${clinicAdminForm.email.trim()}`);
      setClinicAdminDialogOpen(false);
      setClinicAdminForm({ name: "", email: "", phone: "", hospitalId: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to invite the clinic admin");
    } finally {
      setIsSending(false);
    }
  };

  const submitInviteStaff = async () => {
    if (!inviteStaffForm.name.trim() || !inviteStaffForm.email.trim()) {
      toast.error("Full name and email are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteStaffForm.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (inviteStaffForm.role !== "super_admin" && !inviteStaffForm.hospitalId) {
      toast.error("Please select a clinic to assign this user to");
      return;
    }

    setIsSending(true);
    try {
      if (inviteStaffForm.role === "doctor") {
        await createDoctor({
          name: inviteStaffForm.name.trim(),
          email: inviteStaffForm.email.trim(),
          phone: inviteStaffForm.phone.trim(),
          specialty: inviteStaffForm.specialty.trim() || "General Medicine",
          qualification: "MBBS",
          medicalRegistrationNumber: `REG-${Math.floor(100000 + Math.random() * 900000)}`,
          experienceYears: 5,
          gender: "other",
          consultationFee: 500,
          workingHours: "9:00 AM - 5:00 PM",
          notes: "",
          hospitalId: inviteStaffForm.hospitalId,
        });
        toast.success(`Doctor ${inviteStaffForm.name.trim()} assigned to clinic and invited`);
      } else if (inviteStaffForm.role === "receptionist") {
        await createReceptionist({
          name: inviteStaffForm.name.trim(),
          email: inviteStaffForm.email.trim(),
          phone: inviteStaffForm.phone.trim(),
          shift: inviteStaffForm.shift.trim() || "Morning (9–5)",
          hospitalId: inviteStaffForm.hospitalId,
        });
        toast.success(`Receptionist ${inviteStaffForm.name.trim()} assigned to clinic and invited`);
      } else if (inviteStaffForm.role === "clinic_admin") {
        await inviteClinicAdmin({
          name: inviteStaffForm.name.trim(),
          email: inviteStaffForm.email.trim(),
          phone: inviteStaffForm.phone.trim(),
          hospitalId: inviteStaffForm.hospitalId,
        });
        toast.success(`Clinical Admin ${inviteStaffForm.name.trim()} assigned to clinic and invited`);
      } else if (inviteStaffForm.role === "super_admin") {
        await inviteSuperAdmin({
          name: inviteStaffForm.name.trim(),
          email: inviteStaffForm.email.trim(),
          phone: inviteStaffForm.phone.trim(),
          tempPassword: generateTempPassword(),
        });
        toast.success(`Super Admin ${inviteStaffForm.name.trim()} invited`);
      }

      setInviteStaffDialogOpen(false);
      setInviteStaffForm({
        role: "doctor",
        name: "",
        email: "",
        phone: "",
        hospitalId: clinics[0]?.id || "",
        specialty: "General Medicine",
        shift: "Morning (9–5)",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to invite user");
    } finally {
      setIsSending(false);
    }
  };

  const confirmDeactivation = async () => {
    if (!deactivationTarget) return;
    setIsDeactivating(true);
    try {
      await deactivateStaff(deactivationTarget.id, deactivationReason);
      toast.success(`${deactivationTarget.name} no longer has hospital access`);
      setDeactivationTarget(null);
      setDeactivationReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to deactivate staff member");
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleResendInvitation = async (member: StaffMember) => {
    setResendingId(member.id);
    try {
      await resendStaffInvitation(member.id);
      toast.success(`Invitation sent successfully to ${member.email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  };

  const isSuperAdmin = user?.role === "super_admin";
  const deletableStaff = useMemo(
    () => staffMembers.filter((m) => m.id !== user?.userId),
    [staffMembers, user?.userId],
  );

  const allSelected =
    deletableStaff.length > 0 && deletableStaff.every((m) => selectedIds.has(m.id));
  const someSelected =
    deletableStaff.some((m) => selectedIds.has(m.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletableStaff.map((m) => m.id)));
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

  const handleBulkSoftDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await bulkSoftDeleteStaff(ids);
      toast.success(`${ids.length} user${ids.length === 1 ? "" : "s"} moved to Trash`);
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move users to Trash");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeleteStaff(deleteTarget.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      toast.success(`${deleteTarget.name} has been moved to Trash.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move user to Trash");
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Hospital staff and administrators with access to ClinicFlow."
        actions={user?.role === "super_admin" ? (
          <div className="flex flex-wrap gap-2">
            <Dialog open={inviteStaffDialogOpen} onOpenChange={setInviteStaffDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1.5 shadow-sm">
                  <UserPlus className="h-4 w-4" />
                  Add / Invite User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite User & Assign Clinic</DialogTitle>
                  <DialogDescription>
                    Create a new user with a specific role and assign them directly to a clinic.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3.5 py-1">
                  <div className="space-y-1.5">
                    <Label>User Role</Label>
                    <Select
                      value={inviteStaffForm.role}
                      onValueChange={(val) => setInviteStaffForm({ ...inviteStaffForm, role: val as Role })}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="receptionist">Receptionist</SelectItem>
                        <SelectItem value="clinic_admin">Clinical Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input
                      value={inviteStaffForm.name}
                      onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, name: e.target.value })}
                      className="h-11 rounded-xl"
                      placeholder="e.g. Dr. David Smith"
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Email (Login ID)</Label>
                    <Input
                      type="email"
                      value={inviteStaffForm.email}
                      onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, email: e.target.value })}
                      className="h-11 rounded-xl"
                      placeholder="david@clinic.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Phone Number</Label>
                    <Input
                      type="tel"
                      value={inviteStaffForm.phone}
                      onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, phone: e.target.value })}
                      className="h-11 rounded-xl"
                      placeholder="+91 98765 43210"
                      autoComplete="tel"
                    />
                  </div>

                  {inviteStaffForm.role !== "super_admin" && (
                    <div className="space-y-1.5">
                      <Label>Assigned Clinic</Label>
                      <Select
                        value={inviteStaffForm.hospitalId}
                        onValueChange={(val) => setInviteStaffForm({ ...inviteStaffForm, hospitalId: val })}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select clinic" />
                        </SelectTrigger>
                        <SelectContent>
                          {clinics.map((clinic) => (
                            <SelectItem key={clinic.id} value={clinic.id}>
                              {clinic.name} ({clinic.city || clinic.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        This user will be linked directly to the selected clinic.
                      </p>
                    </div>
                  )}

                  {inviteStaffForm.role === "doctor" && (
                    <div className="space-y-1.5">
                      <Label>Medical Specialty</Label>
                      <Input
                        value={inviteStaffForm.specialty}
                        onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, specialty: e.target.value })}
                        className="h-11 rounded-xl"
                        placeholder="e.g. Cardiology, Pediatrics"
                      />
                    </div>
                  )}

                  {inviteStaffForm.role === "receptionist" && (
                    <div className="space-y-1.5">
                      <Label>Work Shift</Label>
                      <Input
                        value={inviteStaffForm.shift}
                        onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, shift: e.target.value })}
                        className="h-11 rounded-xl"
                        placeholder="e.g. Morning (9 AM - 5 PM)"
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={submitInviteStaff} disabled={isSending} className="w-full">
                    {isSending ? "Creating & Inviting..." : "Create & Send Invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={clinicAdminDialogOpen} onOpenChange={setClinicAdminDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-1.5">
                  <Building2 className="h-4 w-4" />
                  Invite Clinic Admin
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Clinic Admin</DialogTitle>
                  <DialogDescription>
                    A secure 24-hour password setup link will be sent to the email address provided.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Full name</Label>
                    <Input
                      value={clinicAdminForm.name}
                      onChange={(event) => setClinicAdminForm({ ...clinicAdminForm, name: event.target.value })}
                      className="h-11 rounded-xl"
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={clinicAdminForm.email}
                      onChange={(event) => setClinicAdminForm({ ...clinicAdminForm, email: event.target.value })}
                      className="h-11 rounded-xl"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      value={clinicAdminForm.phone}
                      onChange={(event) => setClinicAdminForm({ ...clinicAdminForm, phone: event.target.value })}
                      className="h-11 rounded-xl"
                      autoComplete="tel"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assign to Hospital / Clinic</Label>
                    <Select
                      value={clinicAdminForm.hospitalId}
                      onValueChange={(value) => setClinicAdminForm({ ...clinicAdminForm, hospitalId: value })}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select a hospital" />
                      </SelectTrigger>
                      <SelectContent>
                        {clinics.map((clinic) => (
                          <SelectItem key={clinic.id} value={clinic.id}>
                            {clinic.name} ({clinic.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submitClinicAdmin} disabled={isSending} className="w-full">
                    {isSending ? "Sending invitation..." : "Send invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={superAdminDialogOpen} onOpenChange={setSuperAdminDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Add Super Admin
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Super Admin</DialogTitle>
                  <DialogDescription>
                    A secure password setup link will be sent to the email address provided.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Full name</Label>
                    <Input
                      value={superAdminForm.name}
                      onChange={(event) => setSuperAdminForm({ ...superAdminForm, name: event.target.value })}
                      className="h-11 rounded-xl"
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={superAdminForm.email}
                      onChange={(event) => setSuperAdminForm({ ...superAdminForm, email: event.target.value })}
                      className="h-11 rounded-xl"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      value={superAdminForm.phone}
                      onChange={(event) => setSuperAdminForm({ ...superAdminForm, phone: event.target.value })}
                      className="h-11 rounded-xl"
                      autoComplete="tel"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submitSuperAdmin} disabled={isSending} className="w-full">
                    {isSending ? "Sending invitation..." : "Send invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : undefined}
      />

      {/* Bulk Selection Toolbar */}
      {isSuperAdmin && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm shadow-soft">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <CheckSquare className="h-4 w-4 text-destructive" />
            <span>{selectedIds.size} user{selectedIds.size === 1 ? "" : "s"} selected</span>
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

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              {isSuperAdmin && (
                <TableHead className="w-12 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all users"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </TableHead>
              )}
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Assigned Clinic</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffMembers.map((member) => {
              const assignedClinic = member.clinicId ? clinicMap.get(member.clinicId) : null;
              return (
                <TableRow key={member.id} className="hover:bg-muted/30">
                  {isSuperAdmin && (
                    <TableCell className="w-12 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Select ${member.name}`}
                        checked={selectedIds.has(member.id)}
                        disabled={member.id === user?.userId}
                        onChange={() => toggleSelectOne(member.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shrink-0">
                        {member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{member.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{member.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {roleLabels[member.role] || member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {member.email || "Invitation pending"}
                  </TableCell>
                  <TableCell>
                    {assignedClinic ? (
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{assignedClinic.name}</span>
                      </div>
                    ) : member.previousClinicName ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span>{member.previousClinicName}</span>
                      </div>
                    ) : (
                      <span className="italic text-muted-foreground text-xs">Not Assigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        member.status === "Active"
                          ? "secondary"
                          : member.status === "Inactive"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {member.status === "Invited" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 border-primary/20"
                          disabled={resendingId === member.id}
                          title={`Resend Invitation to ${member.email}`}
                          aria-label={`Resend Invitation to ${member.email}`}
                          onClick={() => handleResendInvitation(member)}
                        >
                          <Send className={`h-3.5 w-3.5 ${resendingId === member.id ? "animate-pulse" : ""}`} />
                          <span>Resend Invitation</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={`View ${member.name}'s profile`}
                        aria-label={`View ${member.name}'s profile`}
                        onClick={() => setSelectedProfile(member)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canDeactivate(member) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={`Deactivate ${member.name}`}
                          aria-label={`Deactivate ${member.name}`}
                          onClick={() => setDeactivationTarget(member)}
                        >
                          <UserMinus className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                      {user?.role === "super_admin" && member.id !== user?.userId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={`Delete ${member.name}`}
                          aria-label={`Delete ${member.name}`}
                          onClick={() => setDeleteTarget(member)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {staffMembers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                  No staff memberships are visible for this account.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* User Detailed Profile Dialog */}
      <Dialog
        open={Boolean(selectedProfile)}
        onOpenChange={(open) => {
          if (!open) setSelectedProfile(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> User Profile Details
            </DialogTitle>
            <DialogDescription>
              Detailed account and assignment details for this user.
            </DialogDescription>
          </DialogHeader>

          {selectedProfile && (() => {
            const clinic = selectedProfile.clinicId ? clinicMap.get(selectedProfile.clinicId) : null;
            const Icon = roleIcons[selectedProfile.role] || UserCog;
            return (
              <div className="space-y-4 py-1">
                <div className="flex items-center gap-3.5 rounded-xl border bg-muted/40 p-4">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground font-bold text-base shrink-0">
                    {selectedProfile.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">{selectedProfile.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="gap-1 text-xs font-medium">
                        <Icon className="h-3 w-3" />
                        {roleLabels[selectedProfile.role] || selectedProfile.role}
                      </Badge>
                      <Badge
                        variant={
                          selectedProfile.status === "Active"
                            ? "secondary"
                            : selectedProfile.status === "Inactive"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {selectedProfile.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border divide-y text-xs bg-card">
                  <div className="flex items-center justify-between p-3">
                    <span className="font-medium text-muted-foreground">User ID</span>
                    <span className="font-mono text-foreground font-semibold">{selectedProfile.id}</span>
                  </div>

                  <div className="flex items-center justify-between p-3">
                    <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email Address
                    </span>
                    <span className="text-foreground font-medium">{selectedProfile.email || "Pending activation"}</span>
                  </div>

                  {selectedProfile.phone && (
                    <div className="flex items-center justify-between p-3">
                      <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> Phone Number
                      </span>
                      <span className="text-foreground">{selectedProfile.phone}</span>
                    </div>
                  )}

                  <div className="p-3 space-y-1.5 bg-muted/20">
                    <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" /> Assigned Clinic
                    </span>
                    {clinic ? (
                      <div className="rounded-lg border bg-background p-2.5 space-y-1">
                        <div className="font-semibold text-sm text-foreground">{clinic.name}</div>
                        <div className="font-mono text-[11px] text-primary">Clinic ID: {clinic.id}</div>
                        {clinic.city && (
                          <div className="text-muted-foreground">Location: {clinic.city}</div>
                        )}
                        {clinic.address && (
                          <div className="text-muted-foreground">Address: {clinic.address}</div>
                        )}
                        {clinic.phone && (
                          <div className="text-muted-foreground">Contact: {clinic.phone}</div>
                        )}
                      </div>
                    ) : (
                      <div className="italic text-muted-foreground pt-0.5">Not Assigned (Global Administrator)</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelectedProfile(null)}>
              Close
            </Button>
            {selectedProfile && canDeactivate(selectedProfile) && (
              <Button
                variant="destructive"
                onClick={() => {
                  const target = selectedProfile;
                  setSelectedProfile(null);
                  setDeactivationTarget(target);
                }}
              >
                Deactivate Staff Access
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Staff Access Dialog */}
      <Dialog
        open={Boolean(deactivationTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeactivating) {
            setDeactivationTarget(null);
            setDeactivationReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate staff access</DialogTitle>
            <DialogDescription>
              {deactivationTarget?.name} will immediately lose hospital data access and be removed
              from active care teams. Existing clinical and audit records will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="deactivation-reason">Reason</Label>
            <Textarea
              id="deactivation-reason"
              value={deactivationReason}
              onChange={(event) => setDeactivationReason(event.target.value)}
              minLength={8}
              maxLength={500}
              placeholder="Example: Employment ended on 30 July 2026"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeactivationTarget(null)}
              disabled={isDeactivating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeactivation}
              disabled={isDeactivating || deactivationReason.trim().length < 8}
            >
              {isDeactivating ? "Deactivating..." : "Deactivate access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User?</DialogTitle>
            <DialogDescription>
              This user will be moved to Trash and will no longer be active.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1.5 my-2">
              <div className="font-semibold text-foreground text-sm">{deleteTarget.name}</div>
              <div className="text-muted-foreground">{deleteTarget.email}</div>
              <div className="text-muted-foreground">
                Role: <span className="font-medium text-foreground">{roleLabels[deleteTarget.role] || deleteTarget.role}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Move to Trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Users Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center">Move {selectedIds.size} Users to Trash?</DialogTitle>
            <DialogDescription className="text-center text-sm pt-2">
              The selected users will be moved to the Trash Bin and their portal access will be suspended.
              You can restore them at any time from the Trash within 30 days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowBulkDeleteDialog(false)}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={handleBulkSoftDelete}
              disabled={isBulkDeleting}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {isBulkDeleting ? "Moving to Trash..." : `Move ${selectedIds.size} Users to Trash`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
