import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { useWorkspaceData } from "@/lib/workspace-data";
import { hasPermission } from "@/lib/access-control";
import { Plus, FileText, Edit, Eye } from "lucide-react";

export const Route = createFileRoute("/app/prescriptions/")({ component: PrescriptionsPage });

function PrescriptionsPage() {
  const { user } = useAuth();
  const { prescriptions: rows } = useWorkspaceData();
  const canCreateRx = Boolean(user && hasPermission(user.role, "prescriptions.write"));
  const canEdit = canCreateRx;
  return (
    <>
      <PageHeader title="Prescriptions" description="Issued prescriptions and lab reports."
        actions={
          <div className="flex gap-2">
            {canCreateRx && (
              <Button asChild><Link to="/app/prescriptions/new"><Plus className="mr-1.5 h-4 w-4" />New prescription</Link></Button>
            )}
          </div>
        } />

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader><TableRow>
            <TableHead>RX</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Doctor</TableHead>
            <TableHead>Diagnosis</TableHead>
            <TableHead className="text-right">Medicines</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><div className="flex items-center gap-2 font-mono text-xs"><FileText className="h-3.5 w-3.5 text-info" />{r.id}</div></TableCell>
                <TableCell className="font-semibold">{r.patient}</TableCell>
                <TableCell>{r.doctor}</TableCell>
                <TableCell className="text-muted-foreground">{r.diagnosis}</TableCell>
                <TableCell className="text-right tabular-nums">{r.medicines.length}</TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/app/patients/$id" params={{ id: r.patientId }}>
                        <Eye className="mr-1 h-3.5 w-3.5" />View
                      </Link>
                    </Button>
                    {canEdit && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/app/prescriptions/new" search={{ edit: r.id }}>
                          <Edit className="mr-1 h-3.5 w-3.5" />Edit
                        </Link>
                      </Button>
                    )}
                    
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
