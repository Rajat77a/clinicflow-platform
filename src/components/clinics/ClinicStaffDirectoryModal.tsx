import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

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
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clinicId) return;

    let mounted = true;

    async function loadStaff() {
      setLoading(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("staff_memberships")
          .select(`
            role_code,
            employee_number,
            active,
            profiles (
              id,
              display_name,
              email
            )
          `)
          .eq("hospital_id", clinicId)
          .eq("active", true);

        if (error) throw error;

        if (mounted && data) {
          const mapped: StaffMember[] = data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((m: any) => ({
              id: m.profiles?.id || "",
              name: m.profiles?.display_name || "Unknown",
              email: m.profiles?.email || "",
              role: m.role_code,
              employeeNumber: m.employee_number || "-",
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
