import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth, type Role } from "@/lib/auth";
import { useWorkspaceData, type StaffMember, evaluateStaffInviteStatus } from "@/lib/workspace-data";
import { UserMinus, UserPlus, Eye, EyeOff, Building2, ShieldCheck, Stethoscope, UserCog, Mail, Phone, Trash2, RotateCw, Send, CheckSquare, AlertTriangle, CheckCircle2, Check, Copy, KeyRound, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatClinicEntityId, resolveClinicCode } from "@/lib/prescription-fields";
import { generateMailtoUrl, generateGmailComposeUrl } from "@/lib/email-service";

export const Route = createFileRoute("/app/users")({ component: UsersPage });

const TEST_EMAILS = [
  "reception@clinicflow.test",
  "clinic.admin@clinicflow.test",
  "doctor@clinicflow.test",
  "superadmin@clinicflow.test",
];

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
    binStaffMembers,
    receptionists,
    doctors,
    clinics,
    inviteSuperAdmin,
    inviteClinicAdmin,
    createDoctor,
    createReceptionist,
    deactivateStaff,
    softDeleteStaff,
    bulkSoftDeleteStaff,
    resetUserPassword,
    resendStaffInvitation,
    updateStaff,
    refresh,
  } = useWorkspaceData();

  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [isEditingStaff, setIsEditingStaff] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [editStaffName, setEditStaffName] = useState("");
  const [editStaffPhone, setEditStaffPhone] = useState("");
  const [editStaffSpecialty, setEditStaffSpecialty] = useState("");
  const [editStaffGender, setEditStaffGender] = useState<"female" | "male" | "other" | "">("");
  const [editStaffQualification, setEditStaffQualification] = useState("");
  const [editStaffRegNo, setEditStaffRegNo] = useState("");
  const [editStaffExperienceYears, setEditStaffExperienceYears] = useState(0);
  const [editStaffConsultationFee, setEditStaffConsultationFee] = useState(0);
  const [editStaffWorkingHours, setEditStaffWorkingHours] = useState("");
  const [editStaffNotes, setEditStaffNotes] = useState("");
  const [editStaffShift, setEditStaffShift] = useState("");
  const [editStaffStatus, setEditStaffStatus] = useState<"Active" | "Invited" | "Inactive" | "Expired">("Active");

  const [passwordResetTarget, setPasswordResetTarget] = useState<StaffMember | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const isClinicalAdmin = user?.role === "clinic_admin";

  const allUsers = useMemo(() => {
    const map = new Map<string, StaffMember>();
    
    // Add active / invited / expired staff members
    staffMembers.forEach(m => {
      const evalResult = evaluateStaffInviteStatus(m);
      if (evalResult.shouldAutoDelete) return;
      if (isClinicalAdmin && (evalResult.isExpired || evalResult.status === "Expired" || m.status === "Expired")) return;
      const effectiveMember = evalResult.status === "Expired" && m.status !== "Expired"
        ? { ...m, status: "Expired" as const }
        : m;
      map.set(`${effectiveMember.id}-${effectiveMember.role}`, effectiveMember);
    });

    // Ensure receptionists are represented in allUsers
    receptionists.forEach((r) => {
      const key = `${r.id}-receptionist`;
      const emailMatch = r.email
        ? Array.from(map.values()).some(
            (m) => m.role === "receptionist" && m.email?.toLowerCase() === r.email.toLowerCase()
          )
        : false;
      if (!map.has(key) && !emailMatch) {
        const staffObj: StaffMember = {
          id: r.id,
          clinicId: r.clinicId,
          name: r.name,
          email: r.email,
          phone: r.phone,
          role: "receptionist",
          status: (r.status as any) || "Invited",
          shift: r.shift,
        };
        const evalResult = evaluateStaffInviteStatus(staffObj);
        if (evalResult.shouldAutoDelete) return;
        if (isClinicalAdmin && (evalResult.isExpired || evalResult.status === "Expired" || staffObj.status === "Expired")) return;
        const effectiveMember = evalResult.status === "Expired" && staffObj.status !== "Expired"
          ? { ...staffObj, status: "Expired" as const }
          : staffObj;
        map.set(key, effectiveMember);
      }
    });

    // Ensure doctors are represented in allUsers
    doctors.forEach((d) => {
      const key = `${d.id}-doctor`;
      const emailMatch = d.email
        ? Array.from(map.values()).some(
            (m) => m.role === "doctor" && m.email?.toLowerCase() === d.email.toLowerCase()
          )
        : false;
      if (!map.has(key) && !emailMatch) {
        const staffObj: StaffMember = {
          id: d.id,
          clinicId: d.clinicId,
          name: d.name,
          email: d.email,
          phone: d.phone,
          role: "doctor",
          status: (d.status as any) || "Invited",
          specialty: d.specialty,
        };
        const evalResult = evaluateStaffInviteStatus(staffObj);
        if (evalResult.shouldAutoDelete) return;
        if (isClinicalAdmin && (evalResult.isExpired || evalResult.status === "Expired" || staffObj.status === "Expired")) return;
        const effectiveMember = evalResult.status === "Expired" && staffObj.status !== "Expired"
          ? { ...staffObj, status: "Expired" as const }
          : staffObj;
        map.set(key, effectiveMember);
      }
    });
    
    // Receptionists and doctors are already mapped above into map
    // Soft-deleted or inactive staff should not appear in active users list for any portal
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [staffMembers, receptionists, doctors, isClinicalAdmin]);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();
    
    const channel = supabase
      .channel("public:staff_memberships")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_memberships" },
        () => {
          if (mounted) refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invite_tokens" },
        () => {
          if (mounted) refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_admins" },
        () => {
          if (mounted) refresh();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const displayedUsers = useMemo(() => {
    let result = allUsers;
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((u) => {
        const nameMatch = u.name?.toLowerCase().includes(q);
        const emailMatch = u.email?.toLowerCase().includes(q);
        return Boolean(nameMatch || emailMatch);
      });
    }
    return result;
  }, [allUsers, roleFilter, searchQuery]);

  const [createdStaffInfo, setCreatedStaffInfo] = useState<{
    roleTitle: string;
    staffName: string;
    staffEmail: string;
    setupUrl?: string;
    emailSent?: boolean;
    emailId?: string;
    emailError?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const superAdminDialogOpenState = useState(false);
  const [superAdminDialogOpen, setSuperAdminDialogOpen] = superAdminDialogOpenState;
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
    gender: string;
    qualification: string;
    medicalRegistrationNumber: string;
    experienceYears: number;
    consultationFee: number;
    workingHours: string;
    notes: string;
  }>({
    role: "doctor",
    name: "",
    email: "",
    phone: "",
    hospitalId: clinics[0]?.id || "",
    specialty: "General Medicine",
    shift: "Morning (9 AM - 5 PM)",
    gender: "other",
    qualification: "",
    medicalRegistrationNumber: "",
    experienceYears: 0,
    consultationFee: 500,
    workingHours: "9:00 AM - 5:00 PM",
    notes: "",
  });

  const [deactivationTarget, setDeactivationTarget] = useState<StaffMember | null>(null);
  const [deactivationReason, setDeactivationReason] = useState("");
  const [isDeactivating, setIsDeactivating] = useState(false);

  const clinicMap = useMemo(() => {
    const map = new Map<string, typeof clinics[number]>();
    for (const c of clinics) {
      if (c.id) map.set(c.id, c);
      if (c.shortId) map.set(c.shortId, c);
    }
    return map;
  }, [clinics]);

  const canDeactivate = (member: StaffMember) => {
    if (TEST_EMAILS.includes(member.email.toLowerCase())) return false;
    return (
      member.status !== "Inactive"
      && member.id !== user?.userId
      && member.role !== "super_admin"
      && (
        user?.role === "super_admin"
        || (user?.role === "clinic_admin" && member.role !== "clinic_admin")
      )
    );
  };

  const submitSuperAdmin = async () => {
    if (!superAdminForm.name.trim() || !superAdminForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setIsSending(true);
    try {
      const tempPassword = generateTempPassword();
      const res = await inviteSuperAdmin({
        name: superAdminForm.name.trim(),
        email: superAdminForm.email.trim(),
        phone: superAdminForm.phone.trim(),
        tempPassword,
      });
      toast.success(`Super Admin added · invitation sent to ${superAdminForm.email.trim()}`);
      setSuperAdminDialogOpen(false);
      setSuperAdminForm({ name: "", email: "", phone: "" });
      
      if (res) {
        setCreatedStaffInfo({
          roleTitle: "Super Admin",
          staffName: res.data.name,
          staffEmail: res.data.email,
          setupUrl: res.setupUrl,
          emailSent: res.emailSent,
          emailId: res.emailId,
          emailError: res.emailError,
        });
      }
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
      const res = await inviteClinicAdmin({
        name: clinicAdminForm.name.trim(),
        email: clinicAdminForm.email.trim(),
        phone: clinicAdminForm.phone.trim(),
        hospitalId: clinicAdminForm.hospitalId,
      });
      toast.success(`Clinic Admin invited · 24-hour setup link sent to ${clinicAdminForm.email.trim()}`);
      setClinicAdminDialogOpen(false);
      setClinicAdminForm({ name: "", email: "", phone: "", hospitalId: "" });
      
      if (res) {
        setCreatedStaffInfo({
          roleTitle: "Clinic Admin",
          staffName: res.data.name,
          staffEmail: res.data.email,
          setupUrl: res.setupUrl,
          emailSent: res.emailSent,
          emailId: res.emailId,
          emailError: res.emailError,
        });
      }
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
        let res;
        let roleTitle = "";

        if (inviteStaffForm.role === "doctor") {
          res = await createDoctor({
            name: inviteStaffForm.name.trim(),
            email: inviteStaffForm.email.trim(),
            phone: inviteStaffForm.phone.trim(),
            specialty: inviteStaffForm.specialty.trim() || "General Medicine",
            qualification: inviteStaffForm.qualification.trim() || "MBBS",
            medicalRegistrationNumber: inviteStaffForm.medicalRegistrationNumber.trim() || `REG-${Math.floor(100000 + Math.random() * 900000)}`,
            experienceYears: inviteStaffForm.experienceYears || 0,
            gender: inviteStaffForm.gender as any || "other",
            consultationFee: inviteStaffForm.consultationFee || 500,
            workingHours: inviteStaffForm.workingHours.trim() || "9:00 AM - 5:00 PM",
            notes: inviteStaffForm.notes.trim(),
            hospitalId: inviteStaffForm.hospitalId,
          });
          roleTitle = "Doctor";
        } else if (inviteStaffForm.role === "receptionist") {
          res = await createReceptionist({
            name: inviteStaffForm.name.trim(),
            email: inviteStaffForm.email.trim(),
            phone: inviteStaffForm.phone.trim(),
            shift: inviteStaffForm.shift.trim() || "Morning (9 AM - 5 PM)",
            hospitalId: inviteStaffForm.hospitalId,
          });
          roleTitle = "Receptionist";
        } else if (inviteStaffForm.role === "clinic_admin") {
          res = await inviteClinicAdmin({
            name: inviteStaffForm.name.trim(),
            email: inviteStaffForm.email.trim(),
            phone: inviteStaffForm.phone.trim(),
            hospitalId: inviteStaffForm.hospitalId,
          });
          roleTitle = "Clinic Admin";
        } else if (inviteStaffForm.role === "super_admin") {
          res = await inviteSuperAdmin({
            name: inviteStaffForm.name.trim(),
            email: inviteStaffForm.email.trim(),
            phone: inviteStaffForm.phone.trim(),
            tempPassword: generateTempPassword(),
          });
          roleTitle = "Super Admin";
        }

        if (res) {
          setCreatedStaffInfo({
            roleTitle,
            staffName: res.data.name,
            staffEmail: res.data.email,
            setupUrl: res.setupUrl,
            emailSent: res.emailSent,
            emailId: res.emailId,
            emailError: res.emailError,
          });
        }

        setInviteStaffDialogOpen(false);
        setInviteStaffForm({
          role: "doctor",
          name: "",
          email: "",
          phone: "",
          hospitalId: clinics[0]?.id || "",
          specialty: "General Medicine",
          shift: "Morning (9 AM - 5 PM)",
          gender: "other",
          qualification: "",
          medicalRegistrationNumber: "",
          experienceYears: 0,
          consultationFee: 500,
          workingHours: "9:00 AM - 5:00 PM",
          notes: "",
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
      const res = await resendStaffInvitation(member.id);
      if (res && res.setupUrl) {
        setCreatedStaffInfo({
          roleTitle: roleLabels[member.role] || member.role,
          staffName: member.name,
          staffEmail: member.email,
          setupUrl: res.setupUrl,
          emailSent: res.emailSent,
          emailId: res.emailId,
          emailError: res.emailError,
        });
        toast.success(`Invitation sent successfully to ${member.email}.`);
      } else {
        toast.success(`Invitation sent successfully to ${member.email}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  };

  const isSuperAdmin = user?.role === "super_admin";
  const canManageUsers = isSuperAdmin || user?.role === "clinic_admin";

  useEffect(() => {
    if (!isSuperAdmin && roleFilter === "super_admin") {
      setRoleFilter("all");
    }
  }, [isSuperAdmin, roleFilter]);

  const canDeleteMember = useCallback((member: StaffMember) => {
    if (TEST_EMAILS.includes(member.email.toLowerCase())) return false;
    if (member.id === user?.userId) return false;
    if (user?.role === "super_admin") return true;
    if (user?.role === "clinic_admin") {
      return member.role !== "super_admin" && (member.clinicId === user.clinicId || !member.clinicId);
    }
    return false;
  }, [user]);

  const canEditStaff = useCallback((member: StaffMember) => {
    if (user?.role === "super_admin") return true;
    if (user?.role === "clinic_admin") {
      return member.role !== "super_admin" && (member.clinicId === user.clinicId || !member.clinicId);
    }
    return false;
  }, [user]);

  const handleOpenEditStaff = (member: StaffMember) => {
    setEditTarget(member);
    setEditStaffName(member.name || "");
    setEditStaffPhone(member.phone || "");
    const doc = doctors.find((d) => d.id === member.id);
    const rec = receptionists.find((r) => r.id === member.id);
    setEditStaffSpecialty(doc?.specialty || "");
    setEditStaffGender((doc?.gender as any) || "");
    setEditStaffQualification(doc?.qualification || "");
    setEditStaffRegNo(doc?.medicalRegistrationNumber || "");
    setEditStaffExperienceYears(doc?.experienceYears || 0);
    setEditStaffConsultationFee(doc?.consultationFee || 0);
    setEditStaffWorkingHours(doc?.workingHours || "");
    setEditStaffNotes(doc?.notes || "");
    setEditStaffShift(rec?.shift || "");
    setEditStaffStatus(member.status);
    setIsEditingStaff(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editStaffName.trim()) {
      toast.error("Staff name is required");
      return;
    }
    setIsSavingStaff(true);
    try {
      await updateStaff({
        id: editTarget.id,
        name: editStaffName.trim(),
        phone: editStaffPhone.trim() || undefined,
        specialty: editTarget.role === "doctor" ? editStaffSpecialty.trim() || undefined : undefined,
        gender: editTarget.role === "doctor" ? editStaffGender || undefined : undefined,
        qualification: editTarget.role === "doctor" ? editStaffQualification.trim() || undefined : undefined,
        medicalRegistrationNumber: editTarget.role === "doctor" ? editStaffRegNo.trim() || undefined : undefined,
        experienceYears: editTarget.role === "doctor" ? editStaffExperienceYears : undefined,
        consultationFee: editTarget.role === "doctor" ? editStaffConsultationFee : undefined,
        workingHours: editTarget.role === "doctor" ? editStaffWorkingHours.trim() || undefined : undefined,
        notes: editTarget.role === "doctor" ? editStaffNotes.trim() || undefined : undefined,
        shift: editTarget.role === "receptionist" ? editStaffShift.trim() || undefined : undefined,
        status: editStaffStatus,
      });
      setIsEditingStaff(false);
      setEditTarget(null);
      toast.success(`Updated details for ${editStaffName.trim()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update staff details");
    } finally {
      setIsSavingStaff(false);
    }
  };

  const deletableStaff = useMemo(
    () => allUsers.filter(canDeleteMember),
    [allUsers, canDeleteMember],
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

  const handleResetPassword = async () => {
    if (!passwordResetTarget?.email) {
      toast.error("User does not have a valid email address");
      return;
    }
    if (resetNewPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsResettingPassword(true);
    try {
      await resetUserPassword(passwordResetTarget.email, resetNewPassword);
      toast.success(`Password successfully updated for ${passwordResetTarget.name} (${passwordResetTarget.email}). The user can now log in with this new password.`);
      setPasswordResetTarget(null);
      setResetNewPassword("");
      setResetConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setIsResettingPassword(false);
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
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Medical Specialty</Label>
                        <Input
                          value={inviteStaffForm.specialty}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, specialty: e.target.value })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. Cardiology, Pediatrics"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Gender</Label>
                        <Select value={inviteStaffForm.gender} onValueChange={(value) => setInviteStaffForm({ ...inviteStaffForm, gender: value })}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Qualification</Label>
                        <Input
                          value={inviteStaffForm.qualification}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, qualification: e.target.value })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. MBBS, MD"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Medical Registration No.</Label>
                        <Input
                          value={inviteStaffForm.medicalRegistrationNumber}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, medicalRegistrationNumber: e.target.value })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. MCI-123456"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Experience (years)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={inviteStaffForm.experienceYears}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, experienceYears: Number(e.target.value) })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. 5"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Consultation Fee (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={inviteStaffForm.consultationFee}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, consultationFee: Number(e.target.value) })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. 500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Working Hours</Label>
                        <Input
                          value={inviteStaffForm.workingHours}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, workingHours: e.target.value })}
                          className="h-11 rounded-xl"
                          placeholder="e.g. 9:00 AM - 5:00 PM"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={inviteStaffForm.notes}
                          onChange={(e) => setInviteStaffForm({ ...inviteStaffForm, notes: e.target.value })}
                          className="rounded-xl"
                          placeholder="Available on weekends, etc."
                        />
                      </div>
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
                            {clinic.name} ({clinic.shortId || clinic.id})
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

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email…"
            className="h-10 rounded-xl bg-card pl-9 pr-9 shadow-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}

          {/* Quick feedback right beneath the search bar */}
          {searchQuery.trim() && displayedUsers.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-20 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2 text-xs text-destructive font-medium shadow-md backdrop-blur-sm animate-in fade-in-50 duration-150">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>No user matches &ldquo;{searchQuery.trim()}&rdquo;</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5 ml-auto">
          {canManageUsers && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="gap-2 h-10 rounded-xl"
            >
              <CheckSquare className="h-4 w-4" />
              {allSelected ? "Deselect All Users" : "Select All Users"}
            </Button>
          )}
          <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-card shadow-xs">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {isSuperAdmin && (
                <SelectItem value="super_admin">Super Admin</SelectItem>
              )}
              <SelectItem value="clinic_admin">Clinical Admin</SelectItem>
              <SelectItem value="doctor">Doctor</SelectItem>
              <SelectItem value="receptionist">Receptionist</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Selection Toolbar */}
      {canManageUsers && selectedIds.size > 0 && (
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
              Delete Selected ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              {canManageUsers && (
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
            {displayedUsers.map((member) => {
              const assignedClinic = member.clinicId ? clinicMap.get(member.clinicId) : null;
              return (
                <TableRow key={member.id} className="hover:bg-muted/30">
                  {canManageUsers && (
                    <TableCell className="w-12 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Select ${member.name}`}
                        checked={selectedIds.has(member.id)}
                        disabled={!canDeleteMember(member)}
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
                        <div className="font-mono text-xs text-muted-foreground">
                          {formatClinicEntityId(
                            member.role === "doctor" ? "DR" : member.role === "clinic_admin" ? "CA" : member.role === "receptionist" ? "RC" : member.role === "super_admin" ? "SA" : "ST",
                            member.employeeNumber || member.id,
                            resolveClinicCode(assignedClinic?.shortId || member.clinicId, clinics, user?.clinicId)
                          )}
                        </div>
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
                      <span className="italic text-muted-foreground text-xs">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        member.status === "Active"
                          ? "secondary"
                          : member.status === "Inactive"
                          ? "destructive"
                          : member.status === "Expired"
                          ? "destructive"
                          : "outline"
                      }
                      className={
                        member.status === "Expired"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          : ""
                      }
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {(member.status === "Invited" || member.status === "Expired") && (
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
                      {user?.role === "super_admin" && Boolean(member.email) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={`Reset password for ${member.name} (${member.email})`}
                          aria-label={`Reset password for ${member.name}`}
                          onClick={() => {
                            setPasswordResetTarget(member);
                            setResetNewPassword("");
                            setResetConfirmPassword("");
                            setShowResetPassword(false);
                          }}
                          className="hover:text-primary hover:bg-primary/10"
                        >
                          <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                        </Button>
                      )}
                      {canEditStaff(member) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={`Edit ${member.name}'s details`}
                          aria-label={`Edit ${member.name}`}
                          onClick={() => handleOpenEditStaff(member)}
                          className="hover:text-primary hover:bg-primary/10"
                        >
                          <Pencil className="h-4 w-4 text-primary" />
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
                      {canDeleteMember(member) && (
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
            {displayedUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManageUsers ? 7 : 6} className="h-32 text-center text-muted-foreground">
                  {searchQuery ? (
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <p className="font-medium text-foreground">No users found</p>
                      <p className="text-xs text-muted-foreground">No users match &ldquo;{searchQuery}&rdquo;{roleFilter !== "all" ? ` with role ${roleLabels[roleFilter] || roleFilter}` : ""}.</p>
                    </div>
                  ) : roleFilter !== "all" ? (
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <p className="font-medium text-foreground">No {roleLabels[roleFilter] || roleFilter}s found</p>
                      <p className="text-xs text-muted-foreground">There are currently no users assigned to this role.</p>
                    </div>
                  ) : (
                    "No staff memberships are visible for this account."
                  )}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <div className="flex items-center gap-4 rounded-2xl border bg-muted/40 p-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground font-bold text-base shrink-0 shadow-xs">
                    {selectedProfile.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-base text-foreground truncate">{selectedProfile.name}</h3>
                      <Badge
                        variant={
                          selectedProfile.status === "Active"
                            ? "secondary"
                            : selectedProfile.status === "Inactive" || selectedProfile.status === "Expired"
                            ? "destructive"
                            : "outline"
                        }
                        className={
                          selectedProfile.status === "Expired"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            : ""
                        }
                      >
                        {selectedProfile.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="gap-1 text-xs font-medium">
                        <Icon className="h-3 w-3" />
                        {roleLabels[selectedProfile.role] || selectedProfile.role}
                      </Badge>
                      <Badge variant="secondary" className="font-mono text-xs font-medium">
                        ID: {formatClinicEntityId(
                          selectedProfile.role === "doctor" ? "DR" : selectedProfile.role === "clinic_admin" ? "CA" : selectedProfile.role === "receptionist" ? "RC" : selectedProfile.role === "super_admin" ? "SA" : "ST",
                          selectedProfile.employeeNumber || selectedProfile.id,
                          resolveClinicCode(selectedProfile.clinicId, clinics, user?.clinicId)
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border divide-y text-xs bg-card overflow-hidden">
                  <div className="flex items-center justify-between p-3 gap-2">
                    <span className="font-medium text-muted-foreground shrink-0">Staff ID</span>
                    <span className="font-mono text-foreground font-semibold">
                      {formatClinicEntityId(
                        selectedProfile.role === "doctor" ? "DR" : selectedProfile.role === "clinic_admin" ? "CA" : selectedProfile.role === "receptionist" ? "RC" : selectedProfile.role === "super_admin" ? "SA" : "ST",
                        selectedProfile.employeeNumber || selectedProfile.id,
                        resolveClinicCode(selectedProfile.clinicId, clinics, user?.clinicId)
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 gap-2">
                    <span className="font-medium text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <Mail className="h-3.5 w-3.5" /> Email Address
                    </span>
                    <span className="text-foreground font-medium truncate max-w-[260px]">
                      {selectedProfile.email || "Pending activation"}
                    </span>
                  </div>

                  {selectedProfile.phone && (
                    <div className="flex items-center justify-between p-3 gap-2">
                      <span className="font-medium text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <Phone className="h-3.5 w-3.5" /> Phone Number
                      </span>
                      <span className="text-foreground font-medium">{selectedProfile.phone}</span>
                    </div>
                  )}

                  <div className="p-3.5 space-y-2 bg-muted/20">
                    <span className="font-medium text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Building2 className="h-3.5 w-3.5 text-primary" /> Assigned Clinic
                    </span>
                    {clinic ? (
                      <div className="rounded-xl border bg-background p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-sm text-foreground">{clinic.name}</div>
                          <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/30 shrink-0">
                            ID: {clinic.shortId || clinic.id}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs text-muted-foreground">
                          {clinic.city && <div><span className="font-medium text-foreground">City:</span> {clinic.city}</div>}
                          {clinic.phone && <div><span className="font-medium text-foreground">Phone:</span> {clinic.phone}</div>}
                          {clinic.address && <div className="sm:col-span-2"><span className="font-medium text-foreground">Address:</span> {clinic.address}</div>}
                        </div>
                      </div>
                    ) : (
                      <div className="italic text-muted-foreground text-xs pt-0.5">Not Assigned (Global Administrator)</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setSelectedProfile(null)}>
              Close
            </Button>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
              {selectedProfile && canEditStaff(selectedProfile) && (
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    const target = selectedProfile;
                    setSelectedProfile(null);
                    handleOpenEditStaff(target);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Details
                </Button>
              )}
              {selectedProfile && user?.role === "super_admin" && Boolean(selectedProfile.email) && (
                <Button
                  variant="outline"
                  className="gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  onClick={() => {
                    const target = selectedProfile;
                    setSelectedProfile(null);
                    setPasswordResetTarget(target);
                    setResetNewPassword("");
                    setResetConfirmPassword("");
                    setShowResetPassword(false);
                  }}
                >
                  <KeyRound className="h-4 w-4" />
                  Reset Password
                </Button>
              )}
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
            </div>
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
            <DialogDescription className="space-y-2 pt-1 text-left">
              <span>This user will be moved to Trash and will no longer be active.</span>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                <strong>Retention Policy:</strong> Kept in Trash for 10 days before permanent deletion is allowed. Automatically purged after 60 days. Can be restored anytime before permanent deletion.
              </div>
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
            <DialogTitle className="text-center">Delete Selected Users?</DialogTitle>
            <DialogDescription className="text-left text-sm pt-2 space-y-2">
              <p>The selected users will be moved to the Trash Bin and their portal access will be suspended.</p>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                <strong>Retention Policy:</strong> Kept in Trash for 10 days before permanent deletion is allowed. Automatically purged after 60 days. Can be restored anytime before permanent deletion.
              </div>
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
              {isBulkDeleting ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Created / Setup Link Dialog */}
      <Dialog open={Boolean(createdStaffInfo)} onOpenChange={(open) => { if (!open) setCreatedStaffInfo(null); }}>
        <DialogContent className="max-w-xl sm:max-w-xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${createdStaffInfo?.emailError ? "text-amber-600" : "text-emerald-600"}`}>
              {createdStaffInfo?.emailError ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" /> <span>Invitation Link Generated (Email Delivery Notice)</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5 shrink-0" /> <span>Invitation &amp; Setup Link Ready</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-left">
              <p>
                24-hour setup link for <strong>{createdStaffInfo?.staffName}</strong> ({createdStaffInfo?.roleTitle}).
              </p>
              {createdStaffInfo?.emailError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                  <div className="flex items-start gap-2 font-medium text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="break-words">Email service alert: <strong>{createdStaffInfo.emailError}</strong></span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    The automated email could not be delivered. Ensure RESEND_API_KEY and a verified EMAIL_FROM are configured in server settings. In the meantime, you can manually copy and share the setup link below.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-3 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-medium text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Invitation email sent successfully to: <strong>{createdStaffInfo?.staffEmail}</strong></span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Confirmed by Resend{createdStaffInfo?.emailId ? ` (ID: ${createdStaffInfo.emailId})` : ""}. The user has been sent their 24-hour setup link to activate their account.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-left">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground">24-Hour Password Generation Link</Label>
              <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                Valid for 24 Hours
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={createdStaffInfo?.setupUrl ?? ""}
                className="h-10 font-mono text-xs bg-muted/50 rounded-xl"
              />
              <Button type="button" size="sm" onClick={() => {
                if (createdStaffInfo?.setupUrl) {
                  navigator.clipboard.writeText(createdStaffInfo.setupUrl);
                  setCopiedLink(true);
                  toast.success("Link copied!");
                  setTimeout(() => setCopiedLink(false), 2000);
                }
              }} className="shrink-0 gap-1.5">
                {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? "Copied" : "Copy Link"}
              </Button>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
            {createdStaffInfo?.setupUrl && (
              <>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full sm:w-auto text-xs sm:text-sm"
                  onClick={() => window.open(createdStaffInfo.setupUrl, "_blank")}
                >
                  Open Setup Link in New Tab
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full sm:w-auto text-xs sm:text-sm gap-1.5"
                  onClick={() => {
                    const clinic = clinics.find((c) => c.id === user?.clinicId) || clinics[0];
                    const gmailUrl = generateGmailComposeUrl({
                      recipientEmail: createdStaffInfo.staffEmail,
                      recipientName: createdStaffInfo.staffName,
                      roleTitle: createdStaffInfo.roleTitle,
                      clinicName: clinic?.name || "ClinicFlow Partner Clinic",
                      clinicId: clinic?.id,
                      clinicAddress: clinic?.address,
                      clinicCity: clinic?.city,
                      clinicPhone: clinic?.phone,
                      clinicEmail: clinic?.email,
                      setupUrl: createdStaffInfo.setupUrl || "",
                    });
                    window.open(gmailUrl, "_blank");
                    toast.success(`Opening Gmail compose for ${createdStaffInfo.staffEmail}`);
                  }}
                >
                  <Mail className="h-4 w-4" />
                  Send Invite to User's Email
                </Button>
              </>
            )}
            <Button onClick={() => setCreatedStaffInfo(null)} className="w-full sm:w-auto text-xs sm:text-sm">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin Reset Password Dialog */}
      <Dialog
        open={Boolean(passwordResetTarget)}
        onOpenChange={(open) => {
          if (!open && !isResettingPassword) {
            setPasswordResetTarget(null);
            setResetNewPassword("");
            setResetConfirmPassword("");
            setShowResetPassword(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              Reset User Password
            </DialogTitle>
            <DialogDescription className="text-left pt-1">
              Set a new login password for <strong>{passwordResetTarget?.name}</strong> (<code>{passwordResetTarget?.email}</code>).
              Once set, the user can immediately log in with this password.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleResetPassword();
            }}
            className="space-y-4 py-2"
          >
            <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs space-y-1">
              <div className="font-semibold text-amber-800 dark:text-amber-400">Super Admin Privilege</div>
              <div className="text-muted-foreground">
                Role: <Badge variant="outline" className="ml-1 text-[11px] font-semibold">{passwordResetTarget ? (roleLabels[passwordResetTarget.role] || passwordResetTarget.role) : ""}</Badge>
              </div>
              <div className="text-muted-foreground">
                Email: <span className="font-medium text-foreground">{passwordResetTarget?.email}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="super-admin-reset-new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="super-admin-reset-new-password"
                  type={showResetPassword ? "text" : "password"}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 8 characters)"
                  className="h-11 rounded-xl pr-10"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  aria-label={showResetPassword ? "Hide password" : "Show password"}
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="super-admin-reset-confirm-password">Confirm Password</Label>
              <Input
                id="super-admin-reset-confirm-password"
                type={showResetPassword ? "text" : "password"}
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="h-11 rounded-xl"
                autoComplete="new-password"
                required
                minLength={8}
              />
              {resetNewPassword && resetConfirmPassword && resetNewPassword !== resetConfirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isResettingPassword}
                onClick={() => {
                  setPasswordResetTarget(null);
                  setResetNewPassword("");
                  setResetConfirmPassword("");
                  setShowResetPassword(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isResettingPassword || resetNewPassword.length < 8 || resetNewPassword !== resetConfirmPassword}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <KeyRound className="h-4 w-4" />
                {isResettingPassword ? "Updating password..." : "Set New Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Details Dialog */}
      <Dialog open={isEditingStaff} onOpenChange={setIsEditingStaff}>
        <DialogContent className={editTarget?.role === "doctor" ? "max-w-2xl max-h-[90vh] overflow-y-auto" : "max-w-md max-h-[90vh] overflow-y-auto"}>
          <form onSubmit={handleSaveStaff}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Edit User Details
              </DialogTitle>
              <DialogDescription>
                Update details for <strong>{editTarget?.name}</strong> ({editTarget?.role ? (roleLabels[editTarget.role] || editTarget.role) : "User"}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {editTarget?.role === "doctor" ? (
                <>
                  {/* Doctor Section 1: Personal information */}
                  <section className="rounded-2xl border bg-card p-4 shadow-soft space-y-3">
                    <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal information</h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                      <div className="md:col-span-4 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-name">Full name *</Label>
                        <Input
                          id="edit-doctor-name"
                          required
                          className="h-10 rounded-xl"
                          placeholder="Dr. Amelia Chen"
                          value={editStaffName}
                          onChange={(e) => setEditStaffName(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-gender">Gender</Label>
                        <Select value={editStaffGender} onValueChange={(val) => setEditStaffGender(val as any)}>
                          <SelectTrigger id="edit-doctor-gender" className="h-10 rounded-xl">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-specialty">Specialty *</Label>
                        <Input
                          id="edit-doctor-specialty"
                          required
                          className="h-10 rounded-xl"
                          placeholder="General Medicine"
                          value={editStaffSpecialty}
                          onChange={(e) => setEditStaffSpecialty(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-qual">Qualification</Label>
                        <Input
                          id="edit-doctor-qual"
                          className="h-10 rounded-xl"
                          placeholder="MBBS, MD"
                          value={editStaffQualification}
                          onChange={(e) => setEditStaffQualification(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-reg">Medical registration No.</Label>
                        <Input
                          id="edit-doctor-reg"
                          className="h-10 rounded-xl"
                          placeholder="MCI-123456"
                          value={editStaffRegNo}
                          onChange={(e) => setEditStaffRegNo(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-exp">Experience (years)</Label>
                        <Input
                          id="edit-doctor-exp"
                          type="number"
                          min={0}
                          max={80}
                          className="h-10 rounded-xl"
                          placeholder="8"
                          value={editStaffExperienceYears}
                          onChange={(e) => setEditStaffExperienceYears(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Doctor Section 2: Contact & login */}
                  <section className="rounded-2xl border bg-card p-4 shadow-soft space-y-3">
                    <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact & practice details</h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                      <div className="md:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-email">Email (login ID)</Label>
                        <Input
                          id="edit-doctor-email"
                          disabled
                          className="h-10 rounded-xl bg-muted text-muted-foreground cursor-not-allowed"
                          value={editTarget?.email || "Pending activation"}
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-phone">Phone</Label>
                        <Input
                          id="edit-doctor-phone"
                          className="h-10 rounded-xl"
                          placeholder="+91 98765 43210"
                          value={editStaffPhone}
                          onChange={(e) => setEditStaffPhone(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-fee">Consultation fee (₹)</Label>
                        <Input
                          id="edit-doctor-fee"
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-10 rounded-xl"
                          placeholder="500"
                          value={editStaffConsultationFee}
                          onChange={(e) => setEditStaffConsultationFee(Number(e.target.value))}
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-hours">Working hours</Label>
                        <Input
                          id="edit-doctor-hours"
                          className="h-10 rounded-xl"
                          placeholder="9:00 AM – 5:00 PM"
                          value={editStaffWorkingHours}
                          onChange={(e) => setEditStaffWorkingHours(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-6 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-notes">Notes</Label>
                        <Textarea
                          id="edit-doctor-notes"
                          rows={2}
                          className="rounded-xl"
                          placeholder="Available on weekends, etc."
                          value={editStaffNotes}
                          onChange={(e) => setEditStaffNotes(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-6 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-doctor-status">Status</Label>
                        <Select
                          value={editStaffStatus}
                          onValueChange={(val) => setEditStaffStatus(val as any)}
                        >
                          <SelectTrigger id="edit-doctor-status" className="h-10 rounded-xl">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Invited">Invited</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>
                </>
              ) : editTarget?.role === "receptionist" ? (
                <>
                  {/* Receptionist Fields matching Add Receptionist */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-rec-name">Full name *</Label>
                    <Input
                      id="edit-rec-name"
                      required
                      className="h-11 rounded-xl"
                      value={editStaffName}
                      onChange={(e) => setEditStaffName(e.target.value)}
                      placeholder="Sofia Romero"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-rec-email">Email (login ID)</Label>
                    <Input
                      id="edit-rec-email"
                      disabled
                      value={editTarget?.email || "Pending activation"}
                      className="h-11 rounded-xl bg-muted text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-[11px] text-muted-foreground">Email is tied to auth identity and cannot be edited directly.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-rec-phone">Phone</Label>
                    <Input
                      id="edit-rec-phone"
                      className="h-11 rounded-xl"
                      value={editStaffPhone}
                      onChange={(e) => setEditStaffPhone(e.target.value)}
                      placeholder="+91 …"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-rec-shift">Shift</Label>
                    <Input
                      id="edit-rec-shift"
                      className="h-11 rounded-xl"
                      value={editStaffShift}
                      onChange={(e) => setEditStaffShift(e.target.value)}
                      placeholder="Morning (9–5)"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-rec-status">Status</Label>
                    <Select
                      value={editStaffStatus}
                      onValueChange={(val) => setEditStaffStatus(val as any)}
                    >
                      <SelectTrigger id="edit-rec-status" className="h-11 rounded-xl">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Invited">Invited</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  {/* Admin Roles matching Add Admin */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-admin-name">Full name *</Label>
                    <Input
                      id="edit-admin-name"
                      required
                      className="h-11 rounded-xl"
                      value={editStaffName}
                      onChange={(e) => setEditStaffName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-admin-email">Email (login ID)</Label>
                    <Input
                      id="edit-admin-email"
                      disabled
                      value={editTarget?.email || "Pending activation"}
                      className="h-11 rounded-xl bg-muted text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-[11px] text-muted-foreground">Email is tied to auth identity and cannot be edited directly.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-admin-phone">Phone</Label>
                    <Input
                      id="edit-admin-phone"
                      className="h-11 rounded-xl"
                      value={editStaffPhone}
                      onChange={(e) => setEditStaffPhone(e.target.value)}
                      placeholder="+91 …"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground" htmlFor="edit-admin-status">Status</Label>
                    <Select
                      value={editStaffStatus}
                      onValueChange={(val) => setEditStaffStatus(val as any)}
                    >
                      <SelectTrigger id="edit-admin-status" className="h-11 rounded-xl">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Invited">Invited</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                disabled={isSavingStaff}
                onClick={() => {
                  setIsEditingStaff(false);
                  setEditTarget(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingStaff}>
                {isSavingStaff ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
