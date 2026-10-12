import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspaceData, type Patient } from "@/lib/workspace-data";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/access-control";
import { ChevronLeft, ChevronRight, Search, Plus, Trash2, AlertTriangle, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/patients/")({ component: PatientsPage });

function PatientsPage() {
  const { searchPatients, softDeletePatient } = useWorkspaceData();
  const { user } = useAuth();
  const [tab, setTab] = useState<"my" | "all">("my");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patientToTrash, setPatientToTrash] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pageSize = 25;
  const canCreate = Boolean(user && hasPermission(user.role, "patients.create"));
  const canDelete = Boolean(user && (user.role === "clinic_admin" || user.role === "super_admin"));

  const loadPageData = () => {
    let current = true;
    setLoading(true);
    setLoadError(null);
    void searchPatients({ query, limit: pageSize, offset: page * pageSize, scope: tab })
      .then((result) => {
        if (!current) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((error) => {
        if (!current) return;
        setRows([]);
        setTotal(0);
        setLoadError(error instanceof Error ? error.message : "Unable to load patients");
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  };

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(null);
    const timer = window.setTimeout(() => {
      void searchPatients({ query, limit: pageSize, offset: page * pageSize, scope: tab })
        .then((result) => {
          if (!current) return;
          setRows(result.rows);
          setTotal(result.total);
        })
        .catch((error) => {
          if (!current) return;
          setRows([]);
          setTotal(0);
          setLoadError(error instanceof Error ? error.message : "Unable to load patients");
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, query ? 250 : 0);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [page, query, tab, searchPatients]);

  const handleConfirmTrash = async () => {
    if (!patientToTrash) return;
    setIsDeleting(true);
    try {
      await softDeletePatient(patientToTrash.id);
      toast.success(`${patientToTrash.name} has been moved to Trash (held for 10 days, purged after 60 days)`);
      setRows((prev) => prev.filter((p) => p.id !== patientToTrash.id));
      setTotal((prev) => Math.max(0, prev - 1));
      setPatientToTrash(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move patient to Trash");
    } finally {
      setIsDeleting(false);
    }
  };

  const firstRow = total === 0 ? 0 : page * pageSize + 1;
  const lastRow = Math.min((page + 1) * pageSize, total);

  return (
    <>
      <PageHeader
        title="Patients"
        description={tab === "my" ? "Patients who have been treated at least once." : "All registered patients in the hospital."}
        actions={canCreate ? <Button asChild><Link to="/app/patients/new"><Plus className="mr-1.5 h-4 w-4" />Register patient</Link></Button> : undefined}
      />
      <div className="mb-4">
        <Tabs value={tab} onValueChange={(val) => { setTab(val as "my" | "all"); setPage(0); }}>
          <TabsList className="rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="my" className="rounded-lg">
              <UserCheck className="mr-1.5 h-3.5 w-3.5" />
              My Patients
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              All Patients
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={tab === "my" ? "Search treated patients by name, ID, phone…" : "Search all registered patients by name, ID, phone…"}
              className="h-10 rounded-xl bg-muted/30 pl-9"
              value={query}
              onChange={event => { setQuery(event.target.value); setPage(0); }}
            />
          </div>
          <div className="text-xs tabular-nums text-muted-foreground">
            {loading ? "Loading…" : `${firstRow}-${lastRow} of ${total}`}
          </div>
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
                <TableHead className="text-right">Actions</TableHead>
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
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="sm" variant="ghost"><Link to="/app/patients/$id" params={{ id: p.id }}>Open</Link></Button>
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2"
                          onClick={() => setPatientToTrash(p)}
                          title="Move to Trash"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">{loadError ?? (tab === "my" ? "No treated patients found." : "No patients found.")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="text-xs text-muted-foreground">25 patients per page</div>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" disabled={loading || page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Previous patient page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" disabled={loading || lastRow >= total} onClick={() => setPage((value) => value + 1)} aria-label="Next patient page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Move to Trash confirmation dialog */}
      <Dialog open={Boolean(patientToTrash)} onOpenChange={(open) => { if (!open) setPatientToTrash(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Move Patient to Trash
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              <p>
                Are you sure you want to move <strong className="text-foreground">{patientToTrash?.name}</strong> to the Trash?
              </p>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-medium">Trash Retention Policy:</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Record is retained in Trash for <strong>10 days</strong> before permanent deletion can be performed.</li>
                  <li>After <strong>60 days</strong>, the item will be automatically purged from the system.</li>
                  <li>Can be restored back to active patients at any time prior to permanent deletion.</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPatientToTrash(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmTrash} disabled={isDeleting}>
              {isDeleting ? "Moving to Trash..." : "Move to Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
