import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceData } from "@/lib/workspace-data";
import { getAllRegisteredAccounts } from "@/lib/account-store";

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
}

export function ClinicStaffDirectoryModal({ clinicId, clinicName, onClose }: StaffDirectoryModalProps) {
  const { staffMembers, doctors, receptionists } = useWorkspaceData();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clinicId) return;

    let mounted = true;

    async function loadStaff() {
      setLoading(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("list_current_staff");

        if (mounted && data && !error) {
          const mapped: StaffMember[] = data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((m: any) => {
              if (m.hospital_id !== clinicId) return false;
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
            }))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((m: any) => m.role === "doctor" || m.role === "clinic_admin" || m.role === "receptionist");

          if (mapped.length > 0) {
            setStaff(mapped);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to load staff from RPC", e);
      }

      // Fallback to workspace staff members
      if (mounted) {
        const staffMap = new Map<string, StaffMember>();
        staffMembers
          .filter((m) => {
            const matchesClinic =
              m.clinicId === clinicId ||
              (m.previousClinicName && m.previousClinicName.toLowerCase() === clinicName.toLowerCase());
            return matchesClinic && m.status === "Active" && !m.deletedAt;
          })
          .forEach((m) => {
            staffMap.set(m.email?.toLowerCase() || m.id, {
              id: m.id,
              name: m.name,
              email: m.email,
              role: m.role,
              employeeNumber: m.employeeNumber || "-",
            });
          });

        doctors
          .filter((d) => (d.clinicId === clinicId || (!d.clinicId && clinicId === "00000000-0000-0000-0000-000000000001")) && d.status === "Active")
          .forEach((d) => {
            const key = d.email?.toLowerCase() || d.id;
            if (!staffMap.has(key)) {
              staffMap.set(key, {
                id: d.id,
                name: d.name,
                email: d.email,
                role: "doctor",
                employeeNumber: "-",
              });
            }
          });

        receptionists
          .filter((r) => (r.clinicId === clinicId || (!r.clinicId && clinicId === "00000000-0000-0000-0000-000000000001")) && r.status === "Active")
          .forEach((r) => {
            const key = r.email?.toLowerCase() || r.id;
            if (!staffMap.has(key)) {
              staffMap.set(key, {
                id: r.id,
                name: r.name,
                email: r.email,
                role: "receptionist",
                employeeNumber: "-",
              });
            }
          });

        // Registered accounts matching clinic
        const regAccounts = getAllRegisteredAccounts();
        regAccounts
          .filter(
            (acc) =>
              (acc.clinicId === clinicId ||
                (acc.clinicName && acc.clinicName.toLowerCase() === clinicName.toLowerCase())) &&
              acc.active !== false &&
              acc.role !== "super_admin",
          )
          .forEach((acc) => {
            const key = acc.email.toLowerCase();
            if (!staffMap.has(key)) {
              staffMap.set(key, {
                id: acc.userId,
                name: acc.name,
                email: acc.email,
                role: acc.role,
                employeeNumber: "-",
              });
            }
          });

        setStaff(Array.from(staffMap.values()));
        setLoading(false);
      }
    }

    loadStaff().finally(() => {
      if (mounted) setLoading(false);
    });

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
            Active staff members for {clinicName}
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
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.employeeNumber}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
