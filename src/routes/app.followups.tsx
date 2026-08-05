import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useWorkspaceData, type Appointment } from "@/lib/workspace-data";
import { CalendarClock, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/followups")({ component: FollowUpsPage });

function FollowUpsPage() {
  const { appointments } = useWorkspaceData();
  const [rows, setRows] = useState(appointments.filter(a => a.status === "Pending"));
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState("");

  const mark = (id: string, status: string) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, status } : r));
    toast.success(`Follow-up ${status.toLowerCase()}`);
  };

  const openReschedule = (r: Appointment) => {
    setRescheduling(r);
    setNewDate(r.date);
  };

  const confirmReschedule = () => {
    if (!rescheduling || !newDate) { toast.error("Please pick a new date"); return; }
    setRows(rs => rs.map(r => r.id === rescheduling.id ? { ...r, date: newDate, status: "Rescheduled" } : r));
    toast.success(`Follow-up rescheduled to ${newDate}`);
    setRescheduling(null);
  };

  const pending = rows.filter(r => r.status === "Pending").length;

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description={`${pending} pending follow-up${pending === 1 ? "" : "s"} scheduled from your appointments.`}
      />
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Appointment</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <CalendarClock className="h-3.5 w-3.5 text-info" />{r.id}
                  </div>
                </TableCell>
                <TableCell>
                  <Link to="/app/patients/$id" params={{ id: r.patientId }} className="font-semibold hover:underline">
                    {r.patient}
                  </Link>
                  <div className="text-xs text-muted-foreground font-mono">{r.patientId}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.doctor}</TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "Completed" ? "secondary" : r.status === "Rescheduled" ? "outline" : "default"}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => mark(r.id, "Completed")}>
                      <Check className="mr-1 h-3.5 w-3.5" />Done
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openReschedule(r)}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />Reschedule
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No pending follow-ups.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!rescheduling} onOpenChange={(o) => !o && setRescheduling(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reschedule follow-up</DialogTitle></DialogHeader>
          {rescheduling && (
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-semibold">{rescheduling.patient}</div>
                <div className="text-xs text-muted-foreground">{rescheduling.doctor} - {rescheduling.type}</div>
              </div>
              <div className="space-y-1.5">
                <Label>New date</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduling(null)}>Cancel</Button>
            <Button onClick={confirmReschedule}>Confirm reschedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
