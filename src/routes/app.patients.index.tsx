import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspaceData } from "@/lib/workspace-data";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/access-control";
import { Search, Plus } from "lucide-react";

export const Route = createFileRoute("/app/patients/")({ component: PatientsPage });

function PatientsPage() {
  const { patients } = useWorkspaceData();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase().replace(/\s/g, "");
  const rows = normalized
    ? patients.filter(patient =>
        [patient.id, patient.name, patient.phone].some(value =>
          value.toLocaleLowerCase().replace(/\s/g, "").includes(normalized)
        )
      )
    : patients;
  const canCreate = Boolean(user && hasPermission(user.role, "patients.create"));

  return (
    <>
      <PageHeader title="Patients" description="All registered patients."
        actions={canCreate ? <Button asChild><Link to="/app/patients/new"><Plus className="mr-1.5 h-4 w-4" />Register patient</Link></Button> : undefined} />
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, ID, phone…" className="h-10 rounded-xl bg-muted/30 pl-9" value={query} onChange={event => setQuery(event.target.value)} />
          </div>
          <Button variant="outline">Filter</Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Last visit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground text-xs font-semibold">
                        {p.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </div>
                      <div className="font-semibold">{p.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell>{p.age}</TableCell>
                  <TableCell className="text-muted-foreground">{p.gender}</TableCell>
                  <TableCell>{p.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{p.lastVisit}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "New" ? "default" : p.status === "Follow-up" ? "outline" : "secondary"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost"><Link to="/app/patients/$id" params={{ id: p.id }}>Open</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No patients found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
