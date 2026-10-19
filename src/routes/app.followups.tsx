import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useWorkspaceData, type Appointment, type Prescription } from "@/lib/workspace-data";
import { useAuth } from "@/lib/auth";
import { localDateKey } from "@/lib/calendar";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  Stethoscope,
  User,
  Users,
  Search,
  CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/followups")({ component: FollowUpsPage });

export interface FollowUpItem {
  id: string;
  source: "appointment" | "prescription";
  patientId: string;
  patientName: string;
  doctorName: string;
  date: string;
  detail: string;
  status: string;
  rawAppointment?: Appointment;
  rawPrescription?: Prescription;
}

function FollowUpsPage() {
  const { user } = useAuth();
  const { appointments, prescriptions } = useWorkspaceData();

  // Selected date state (defaults to today)
  const todayKey = localDateKey();
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [searchQuery, setSearchQuery] = useState("");

  // Month navigation for the calendar grid
  const [currentYearMonth, setCurrentYearMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Track completed/rescheduled overrides locally so actions feel instant
  const [statusOverrides, setStatusOverrides] = useState<Record<string, { status: string; date?: string }>>({});
  const [rescheduling, setRescheduling] = useState<FollowUpItem | null>(null);
  const [newDate, setNewDate] = useState("");

  // Aggregate all follow-ups from appointments and prescriptions
  const allFollowUps = useMemo<FollowUpItem[]>(() => {
    const items: FollowUpItem[] = [];
    const seenIds = new Set<string>();

    // 1. Appointments (pending / scheduled follow-up visits)
    for (const appt of appointments) {
      if (!appt.date) continue;
      const key = `appt-${appt.id}`;
      seenIds.add(key);
      const override = statusOverrides[key];
      items.push({
        id: key,
        source: "appointment",
        patientId: appt.patientId,
        patientName: appt.patient,
        doctorName: appt.doctor,
        date: override?.date ?? appt.date,
        detail: appt.type ? `Visit · ${appt.type} at ${appt.time || "Scheduled"}` : "Follow-up consultation",
        status: override?.status ?? appt.status,
        rawAppointment: appt,
      });
    }

    // 2. Prescriptions with followUp date specified
    for (const rx of prescriptions) {
      if (!rx.followUp) continue;
      const key = `rx-${rx.id}`;
      seenIds.add(key);
      const override = statusOverrides[key];
      const rxDiagnosis = rx.diagnosis && rx.diagnosis !== "Not recorded" ? rx.diagnosis : "";
      items.push({
        id: key,
        source: "prescription",
        patientId: rx.patientId,
        patientName: rx.patient,
        doctorName: rx.doctor,
        date: override?.date ?? rx.followUp,
        detail: rxDiagnosis ? `Rx follow-up · ${rxDiagnosis}` : "Prescription follow-up",
        status: override?.status ?? (rx.followUp < todayKey ? "Due" : "Scheduled"),
        rawPrescription: rx,
      });
    }

    return items;
  }, [appointments, prescriptions, statusOverrides, todayKey]);

  // Group follow-ups by date string "YYYY-MM-DD"
  const followUpsByDate = useMemo(() => {
    const map = new Map<string, FollowUpItem[]>();
    for (const item of allFollowUps) {
      if (!item.date) continue;
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [allFollowUps]);

  // Calendar dates matrix for the current viewed month
  const calendarDays = useMemo(() => {
    const { year, month } = currentYearMonth;
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
    const totalDays = lastDayOfMonth.getDate();

    const days: Array<{
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      itemsCount: number;
    }> = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const d = new Date(year, month - 1, dayNum);
      const key = localDateKey(d);
      days.push({
        dateKey: key,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: key === todayKey,
        itemsCount: (followUpsByDate.get(key) ?? []).length,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const key = localDateKey(d);
      days.push({
        dateKey: key,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: key === todayKey,
        itemsCount: (followUpsByDate.get(key) ?? []).length,
      });
    }

    // Next month padding days to complete 35 or 42 cells grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const key = localDateKey(d);
      days.push({
        dateKey: key,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: key === todayKey,
        itemsCount: (followUpsByDate.get(key) ?? []).length,
      });
    }

    return days;
  }, [currentYearMonth, followUpsByDate, todayKey]);

  // Patients assigned to the currently selected date
  const selectedDateItems = useMemo(() => {
    const list = followUpsByDate.get(selectedDate) ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.patientName.toLowerCase().includes(q) ||
        item.doctorName.toLowerCase().includes(q) ||
        item.patientId.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q)
    );
  }, [followUpsByDate, selectedDate, searchQuery]);

  const handlePrevMonth = () => {
    setCurrentYearMonth(({ year, month }) => {
      if (month === 0) return { year: year - 1, month: 11 };
      return { year, month: month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCurrentYearMonth(({ year, month }) => {
      if (month === 11) return { year: year + 1, month: 0 };
      return { year, month: month + 1 };
    });
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYearMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(todayKey);
  };

  const markComplete = (item: FollowUpItem) => {
    setStatusOverrides((prev) => ({
      ...prev,
      [item.id]: { status: "Completed", date: item.date },
    }));
    toast.success(`Follow-up for ${item.patientName} marked as completed`);
  };

  const openRescheduleModal = (item: FollowUpItem) => {
    setRescheduling(item);
    setNewDate(item.date);
  };

  const confirmReschedule = () => {
    if (!rescheduling || !newDate) {
      toast.error("Please pick a new date");
      return;
    }
    setStatusOverrides((prev) => ({
      ...prev,
      [rescheduling.id]: { status: "Rescheduled", date: newDate },
    }));
    toast.success(`Follow-up rescheduled to ${newDate}`);
    setSelectedDate(newDate);
    const [y, m] = newDate.split("-").map(Number);
    if (y && m) {
      setCurrentYearMonth({ year: y, month: m - 1 });
    }
    setRescheduling(null);
  };

  const monthLabel = useMemo(() => {
    const date = new Date(currentYearMonth.year, currentYearMonth.month, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentYearMonth]);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return "";
    const [year, month, day] = selectedDate.split("-").map(Number);
    if (!year || !month || !day) return selectedDate;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [selectedDate]);

  // Overall metric counts
  const totalUpcoming = allFollowUps.filter((f) => f.date >= todayKey && f.status !== "Completed").length;
  const todayCount = (followUpsByDate.get(todayKey) ?? []).length;

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Date-by-date patient schedule and assigned follow-up care."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleJumpToToday}>
              <CalendarCheck className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Today ({todayCount})
            </Button>
            <Button asChild size="sm">
              <Link to="/app/appointments/new" search={{ patient: undefined }}>
                <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                Schedule visit
              </Link>
            </Button>
          </div>
        }
      />

      {/* Main Responsive Grid: Calendar on left, Assigned Patient List on right */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Calendar Card (7 cols on large screens) */}
        <div className="rounded-2xl border bg-card p-5 shadow-soft lg:col-span-7 space-y-4">
          {/* Calendar Header with Month Navigation */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold tracking-tight">{monthLabel}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalUpcoming} upcoming follow-up{totalUpcoming === 1 ? "" : "s"} scheduled
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handlePrevMonth}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handleNextMonth}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Day of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Interactive Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((d) => {
              const isSelected = d.dateKey === selectedDate;
              const hasItems = d.itemsCount > 0;

              return (
                <button
                  key={d.dateKey}
                  type="button"
                  onClick={() => setSelectedDate(d.dateKey)}
                  className={cn(
                    "relative flex flex-col items-center justify-between rounded-xl p-2 min-h-16 transition-all text-left group cursor-pointer",
                    d.isCurrentMonth ? "bg-background hover:bg-muted/50" : "bg-muted/15 text-muted-foreground/60 hover:bg-muted/30",
                    d.isToday && "border-2 border-primary/50 font-bold",
                    isSelected && "ring-2 ring-primary bg-primary/10 hover:bg-primary/15 shadow-xs",
                    "border border-border/60 hover:border-border"
                  )}
                >
                  <div className="w-full flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-semibold rounded-md w-6 h-6 grid place-items-center",
                        d.isToday && !isSelected && "bg-primary text-primary-foreground font-bold",
                        isSelected && "bg-primary text-primary-foreground font-bold"
                      )}
                    >
                      {d.dayNumber}
                    </span>
                    {hasItems && (
                      <Badge
                        variant={isSelected ? "default" : "secondary"}
                        className={cn(
                          "px-1.5 py-0 h-4 text-[10px] font-bold rounded-full",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-info/15 text-info border-transparent"
                        )}
                      >
                        {d.itemsCount}
                      </Badge>
                    )}
                  </div>

                  {/* Dot indicators or preview pills */}
                  <div className="w-full mt-1 flex justify-center gap-1">
                    {hasItems && (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          isSelected ? "bg-primary" : "bg-info"
                        )}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Today
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-info" /> Has patient follow-up
              </span>
            </div>
            <span>Click any day to view assigned patients</span>
          </div>
        </div>

        {/* Assigned Patients on Selected Date Card (5 cols on large screens) */}
        <div className="rounded-2xl border bg-card p-5 shadow-soft lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <div className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                Assigned Date
              </div>
              <h3 className="font-display text-base font-bold text-foreground mt-0.5">
                {formattedSelectedDate}
              </h3>
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
              {selectedDateItems.length} Patient{selectedDateItems.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {/* Quick search filter for the day's patients */}
          {selectedDateItems.length > 2 && (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search patient, doctor, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs rounded-lg"
              />
            </div>
          )}

          {/* Patient Cards List for the Selected Day */}
          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {selectedDateItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border bg-background p-3.5 transition-colors hover:border-primary/40 space-y-2.5 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to="/app/patients/$id"
                      params={{ id: item.patientId }}
                      className="font-bold text-sm text-foreground hover:text-primary hover:underline truncate block"
                    >
                      {item.patientName}
                    </Link>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      ID: {item.patientId}
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.status === "Completed"
                        ? "secondary"
                        : item.status === "Rescheduled"
                        ? "outline"
                        : "default"
                    }
                    className="shrink-0 text-[10px]"
                  >
                    {item.status}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium text-foreground">{item.doctorName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.detail}</span>
                  </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between gap-2">
                  <Button asChild size="sm" variant="outline" className="h-8 text-xs rounded-lg px-2.5">
                    <Link to="/app/patients/$id" params={{ id: item.patientId }}>
                      <User className="mr-1 h-3 w-3" />
                      View Profile
                    </Link>
                  </Button>
                  <div className="flex items-center gap-1">
                    {item.status !== "Completed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs rounded-lg px-2 text-success hover:text-success"
                        onClick={() => markComplete(item)}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Done
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs rounded-lg px-2 text-muted-foreground"
                      onClick={() => openRescheduleModal(item)}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Reschedule
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {selectedDateItems.length === 0 && (
              <div className="py-12 text-center text-muted-foreground rounded-xl border border-dashed p-6">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground text-sm">
                  No patients assigned to this day
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                  Pick another date from the calendar or schedule a new appointment or prescription follow-up.
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link to="/app/appointments/new" search={{ patient: undefined }}>
                    <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                    Schedule appointment
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reschedule Modal */}
      <Dialog open={!!rescheduling} onOpenChange={(o) => !o && setRescheduling(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule Follow-up</DialogTitle>
          </DialogHeader>
          {rescheduling && (
            <div className="space-y-3 py-2">
              <div className="rounded-xl bg-muted/40 p-3 text-sm">
                <div className="font-bold text-foreground">{rescheduling.patientName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {rescheduling.doctorName} · {rescheduling.detail}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Current date: <span className="font-semibold text-foreground">{rescheduling.date}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-followup-date">New Follow-up Date</Label>
                <Input
                  id="new-followup-date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-11 rounded-xl"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduling(null)}>
              Cancel
            </Button>
            <Button onClick={confirmReschedule}>Confirm Reschedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
