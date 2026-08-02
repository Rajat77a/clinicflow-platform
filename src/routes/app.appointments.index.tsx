import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useWorkspaceData, type Appointment } from "@/lib/workspace-data";
import { CalendarDays, List, Plus } from "lucide-react";
import { toast } from "sonner";
import { PaginationFooter } from "@/components/data/pagination-footer";
import { useRecordPage } from "@/lib/use-record-page";
import { localDateKey, localStartOfWeek } from "@/lib/calendar";
import { TimeWheelPicker } from "@/components/forms/time-wheel-picker";

export const Route = createFileRoute("/app/appointments/")({ component: AppointmentsPage });

type Appt = Appointment;

function CalendarView({ appts }: { appts: Appt[] }) {
  const weekStart = localStartOfWeek();
  const days = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return {
      dateKey: localDateKey(date),
      label: date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
    };
  });
  const defaultHours = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"];
  const weekDates = new Set(days.map((day) => day.dateKey));
  const hours = [...new Set([
    ...defaultHours,
    ...appts.filter((appointment) => weekDates.has(appointment.date)).map((appointment) => appointment.time),
  ])].sort((left, right) => left.localeCompare(right));
  const today = localDateKey();

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
      <div className="min-w-[720px] grid grid-cols-[80px_repeat(5,1fr)]">
        <div className="border-b border-r bg-muted/30 p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</div>
        {days.map((day) => (
          <div key={day.dateKey} className={`border-b p-3 text-xs font-semibold ${day.dateKey === today ? "text-primary" : ""}`}>{day.label}</div>
        ))}
        {hours.flatMap((h) => [
          <div key={`t-${h}`} className="border-b border-r p-3 text-xs text-muted-foreground">{h}</div>,
          ...days.map((day) => {
            const slots = appts.filter((appointment) => appointment.date === day.dateKey && appointment.time === h);
            return (
              <div key={`${h}-${day.dateKey}`} className="min-h-14 space-y-1 border-b p-1.5">
                {slots.map((slot) => (
                  <div key={slot.id} className="rounded-md bg-primary-soft px-2 py-1.5 text-xs">
                    <div className="truncate font-semibold text-primary">{slot.patient}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{slot.doctor} · {slot.type}</div>
                  </div>
                ))}
              </div>
            );
          }),
        ])}
      </div>
    </div>
  );
}

function AppointmentsPage() {
  const { appointments, listAppointments, updateAppointment } = useWorkspaceData();
  const {
    rows,
    total,
    limit,
    offset,
    setOffset,
    isLoading,
    error,
  } = useRecordPage(listAppointments);
  const [editing, setEditing] = useState<Appt | null>(null);
  const [draft, setDraft] = useState<Appt | null>(null);
  const [saving, setSaving] = useState(false);
  const upcoming = appointments
    .filter((appointment) => appointment.date >= localDateKey())
    .filter((appointment) => !["Cancelled", "Completed", "No-show"].includes(appointment.status))
    .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`))
    .slice(0, 6);

  const openEdit = (a: Appt) => { setEditing(a); setDraft({ ...a }); };
  const save = async () => {
    if (!draft) return;
    if (!draft.date || !draft.time) { toast.error("Date and time are required"); return; }
    setSaving(true);
    try {
      await updateAppointment(draft);
      toast.success(`Appointment ${draft.id} updated`);
      setEditing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update appointment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Appointments" description="Scheduling and check-ins."
        actions={<Button asChild><Link to="/app/appointments/new" search={{ patient: undefined }}><Plus className="mr-1.5 h-4 w-4" />Book appointment</Link></Button>} />
      <Tabs defaultValue="list">
        <TabsList className="rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="list" className="rounded-lg"><List className="mr-1.5 h-3.5 w-3.5" />List</TabsTrigger>
          <TabsTrigger value="calendar" className="rounded-lg"><CalendarDays className="mr-1.5 h-3.5 w-3.5" />Calendar</TabsTrigger>
          <TabsTrigger value="upcoming" className="rounded-lg">Upcoming</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4 rounded-2xl border bg-card shadow-soft overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Patient</TableHead><TableHead>Doctor</TableHead><TableHead>Date & time</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading appointments...</TableCell></TableRow>
              )}
              {!isLoading && error && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-destructive">{error}</TableCell></TableRow>
              )}
              {!isLoading && !error && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No appointments found.</TableCell></TableRow>
              )}
              {rows.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.id}</TableCell>
                  <TableCell className="font-semibold">{a.patient}</TableCell>
                  <TableCell>{a.doctor}</TableCell>
                  <TableCell>{a.date} · <span className="font-semibold">{a.time}</span></TableCell>
                  <TableCell>{a.type}</TableCell>
                  <TableCell><Badge variant={a.status === "Confirmed" ? "secondary" : a.status === "Checked-in" ? "default" : "outline"}>{a.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openEdit(a)}>Edit</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationFooter
            offset={offset}
            limit={limit}
            total={total}
            onOffsetChange={setOffset}
            disabled={isLoading}
          />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4"><CalendarView appts={appointments} /></TabsContent>
        <TabsContent value="upcoming" className="mt-4 grid gap-3 sm:grid-cols-2">
          {upcoming.map(a => (
            <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{a.patient}</div>
                <Badge variant="secondary">{a.status}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{a.doctor} · {a.type}</div>
              <div className="mt-3 text-sm">{a.date} at <span className="font-semibold">{a.time}</span></div>
            </div>
          ))}
          {upcoming.length === 0 && (
            <div className="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground sm:col-span-2">
              No upcoming appointments.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit appointment {editing?.id}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-semibold">{draft.patient}</div>
                <div className="text-xs text-muted-foreground">{draft.doctor}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Date</Label>
                  <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5"><Label>Time</Label>
                  <TimeWheelPicker value={draft.time} onChange={(time) => setDraft({ ...draft, time })} aria-label="Choose appointment time" />
                </div>
              </div>
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consultation">Consultation</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Check-up">Check-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Checked-in">Checked-in</SelectItem>
                    <SelectItem value="In progress">In progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="No-show">No-show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
