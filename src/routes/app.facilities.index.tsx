import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspaceData, type Facility } from "@/lib/workspace-data";
import { Plus, Building2, MapPin, Phone, Mail, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/facilities/")({ component: FacilitiesPage });

function FacilitiesPage() {
  const { user } = useAuth();
  const { facilities, createFacility, refresh } = useWorkspaceData();
  const isSuperAdmin = user?.role === "super_admin";
  const canManage = user && (user.role === "super_admin" || user.role === "clinic_admin");

  const toggleActive = async (facility: Facility) => {
    try {
      await refresh();
      toast.success(`${facility.name} is now ${!facility.active ? "active" : "inactive"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update facility");
    }
  };

  return (
    <>
      <PageHeader
        title="Facilities"
        description="Manage hospital facilities and departments for staff assignments."
        actions={canManage ? (
          <Button asChild>
            <Link to="/app/facilities/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Facility
            </Link>
          </Button>
        ) : undefined}
      />
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Facility</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="w-20 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {facilities.map((facility) => (
              <TableRow key={facility.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div className="font-semibold">{facility.name}</div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{facility.code}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {facility.address || "Not specified"}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {facility.phone || "—"}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {facility.email || "—"}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={facility.active ? "secondary" : "outline"}>
                    {facility.active ? (
                      <>Active <ToggleRight className="ml-1 h-3 w-3" /></>
                    ) : (
                      <>Inactive <ToggleLeft className="ml-1 h-3 w-3" /></>
                    )}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive(facility)}
                    >
                      {facility.active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {facilities.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 7 : 6} className="h-32 text-center text-muted-foreground">
                  No facilities configured. Create a facility to start inviting staff.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}