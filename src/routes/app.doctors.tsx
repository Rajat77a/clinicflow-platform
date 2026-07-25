import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspaceData } from "@/lib/workspace-data";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/app/doctors")({ component: DoctorsRoute });

function DoctorsRoute() {
  const matches = useMatches();
  const hasChild = matches.some(m => m.routeId === "/app/doctors/new");
  if (hasChild) return <Outlet />;
  return <DoctorsPage />;
}

function DoctorsPage() {
  const { doctors } = useWorkspaceData();
  return (
    <>
      <PageHeader title="Doctors" description="Practitioners at your clinic."
        actions={<Button asChild><Link to="/app/doctors/new"><Plus className="mr-1.5 h-4 w-4" />Add doctor</Link></Button>} />

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doctor</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead className="text-right">Patients</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors.map(d => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground text-xs font-semibold">
                      {d.name.split(" ").slice(-1)[0][0]}
                    </div>
                    <div>
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{d.specialty}</TableCell>
                <TableCell className="text-right tabular-nums">{d.patients}</TableCell>
                <TableCell className="text-muted-foreground">{d.email}</TableCell>
                <TableCell><Badge variant={d.status === "Active" ? "secondary" : "outline"}>{d.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
