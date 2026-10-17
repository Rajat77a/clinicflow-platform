import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatClinicEntityId, resolveClinicCode } from "@/lib/prescription-fields";

interface StaffDirectoryModalProps {
  clinicId: string | null;
  clinicName: string;
  onClose: () => void;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeNumber: string;
  hospitalId?: string;
}

export function ClinicStaffDirectoryModal({ clinicId, clinicName, onClose }: StaffDirectoryModalProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const formattedClinicCode = resolveClinicCode(clinicId);

  useEffect(() => {
    if (!clinicId) return;

    let mounted = true;

    async function loadStaff() {
      setLoading(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("list_current_staff");

        if (error) throw error;

        if (mounted && data) {
          const mapped: StaffMember[] = data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((m: any) => {
              if (m.hospital_id !== clinicId) return false;
              // Only include members with active status (who have generated passwords and can log in)
              // Exclude "Invited", "Expired", "Inactive", or soft-deleted members
              if (m.status !== "Active") return false;
              if (m.deleted_at) return false;
              if (m.active === false) return false;
              return true;
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((m: any) => ({
              id: m.user_id || "",
              name: m.display_name || "Unknown",
              email: m.email || "",
              role: m.role_code,
              employeeNumber: m.employee_number || "-",
              hospitalId: m.hospital_id,
            }))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((m: any) => m.role === "doctor" || m.role === "clinic_admin" || m.role === "receptionist");
          setStaff(mapped);
        }
      } catch (e) {
        console.error("Failed to load staff", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadStaff();

    return () => {
      mounted = false;
    };
  }, [clinicId]);

  return (
    <Dialog open={Boolean(clinicId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Staff Directory</DialogTitle>
          <DialogDescription>
            Active staff members for {clinicName} {formattedClinicCode ? `(${formattedClinicCode})` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading staff...</div>
        ) : staff.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No active staff found for this clinic.</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => {
                  const rolePrefix = s.role === "clinic_admin" ? "CA" : s.role === "doctor" ? "DR" : s.role === "receptionist" ? "RC" : "ST";
                  const displayId = formatClinicEntityId(rolePrefix, s.employeeNumber || s.id, formattedClinicCode);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs font-semibold">{displayId}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {s.role === "clinic_admin" ? "Clinical Admin" : 
                           s.role === "doctor" ? "Doctor" : 
                           s.role === "receptionist" ? "Receptionist" : s.role}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
