import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  IndianRupee,
  Receipt,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { localDateKey, localStartOfWeek } from "@/lib/calendar";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useWorkspaceData,
  type Appointment,
  type Bill,
} from "@/lib/workspace-data";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "super_admin") return <SuperAdminDashboard />;
  if (user.role === "clinic_admin") return <ClinicAdminDashboard />;
  if (user.role === "doctor") return <DoctorDashboard />;
  return <ReceptionistDashboard />;
}

function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function weeklyVisits(appointments: Appointment[]) {
  const weekStart = localStartOfWeek();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateKey = localDateKey(date);
    return {
      day: date.toLocaleDateString("en-IN", { weekday: "short" }),
      visits: appointments.filter(appointment => appointment.date === dateKey).length,
    };
  });
}

function monthlyRevenue(bills: Bill[]) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      month: date.toLocaleDateString("en-IN", { month: "short" }),
      revenue: bills
        .filter(bill => bill.status === "Paid" && bill.date.startsWith(monthKey))
        .reduce((sum, bill) => sum + bill.amount, 0),
    };
  });
}

function RevenueChart({ data }: { data: ReturnType<typeof monthlyRevenue> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="var(--color-muted-foreground)"
          tickFormatter={(value: number) => `INR ${Math.round(value / 1000)}k`}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card)" }}
          formatter={(value: number) => [`INR ${value.toLocaleString("en-IN")}`, "Collected"]}
        />
        <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#revenue-fill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function VisitsChart({ data }: { data: ReturnType<typeof weeklyVisits> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card)" }} />
        <Bar dataKey="visits" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyList({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>;
}

function SuperAdminDashboard() {
  const { clinics, staffMembers, auditLogs } = useWorkspaceData();
  const activeClinics = clinics.filter(clinic => clinic.status === "Active").length;
  const doctors = staffMembers.filter(member => member.role === "doctor" && member.status === "Active").length;
  const receptionists = staffMembers.filter(member => member.role === "receptionist" && member.status === "Active").length;
  const pendingInvitations = staffMembers.filter(member => member.status === "Invited").length;

  return (
    <>
      <PageHeader
        title="Installation overview"
        description={`Administrative health of this dedicated hospital installation. Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Hospitals" value={clinics.length} icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Active" value={activeClinics} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Doctors" value={doctors} tone="info" icon={<Stethoscope className="h-4 w-4" />} />
        <StatCard label="Receptionists" value={receptionists} icon={<UserCog className="h-4 w-4" />} />
        <StatCard label="Pending invites" value={pendingInvitations} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Audit events" value={auditLogs.length} tone="success" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <div className="mt-6 rounded-2xl border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h3 className="font-display text-base font-semibold">Recent administrative activity</h3>
            <p className="text-xs text-muted-foreground">Security-relevant events visible to the platform administrator.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/audit-logs">Audit logs</Link>
          </Button>
        </div>
        {auditLogs.length === 0 ? (
          <EmptyList message="No audit events have been recorded yet." />
        ) : (
          <div className="divide-y">
            {auditLogs.slice(0, 8).map(entry => (
              <div key={entry.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{entry.action}</div>
                  <div className="truncate text-xs text-muted-foreground">{entry.user}</div>
                </div>
                <div className="text-xs text-muted-foreground">{entry.date} {entry.time}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ClinicAdminDashboard() {
  const { user } = useAuth();
  const { appointments, patients, doctors, bills, prescriptions, clinics } = useWorkspaceData();
  const todayDate = localDateKey();
  const currentMonth = todayDate.slice(0, 7);
  const today = appointments
    .filter(appointment => appointment.date === todayDate)
    .sort((left, right) => left.time.localeCompare(right.time));
  const newPatients = patients.filter(patient => patient.lastVisit === todayDate).length;
  const activeDoctors = doctors.filter(doctor => doctor.status === "Active").length;
  const followUps = prescriptions.filter(prescription => prescription.followUp && prescription.followUp >= todayDate).length;
  const collectedThisMonth = bills
    .filter(bill => bill.status === "Paid" && bill.date.startsWith(currentMonth))
    .reduce((sum, bill) => sum + bill.amount, 0);

  const currentClinic = useMemo(() => {
    return (
      clinics.find(
        (c) =>
          (user?.clinicId && (c.id === user.clinicId || c.shortId === user.clinicId)) ||
          (user?.clinic && c.name.toLowerCase() === user.clinic.toLowerCase())
      ) ??
      clinics.find((c) => c.id === user?.clinicId || c.shortId === user?.clinicId) ??
      (clinics.length > 0 ? clinics[0] : null)
    );
  }, [clinics, user?.clinicId, user?.clinic]);

  const subscriptionDaysLeft = useMemo(() => {
    if (!currentClinic?.expires || currentClinic.expires === "Not set") return null;
    const expiresDate = currentClinic.expires.includes("T")
      ? new Date(currentClinic.expires)
      : new Date(`${currentClinic.expires}T23:59:59`);
    if (isNaN(expiresDate.getTime())) return null;
    return Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }, [currentClinic?.expires]);

  const subscriptionStatValue = useMemo(() => {
    if (subscriptionDaysLeft === null) {
      return currentClinic?.status ? `${currentClinic.status}` : "Active";
    }
    if (subscriptionDaysLeft < 0) {
      return `Expired (${Math.abs(subscriptionDaysLeft)}d)`;
    }
    if (subscriptionDaysLeft === 0) {
      return "Expires today";
    }
    return `${subscriptionDaysLeft} day${subscriptionDaysLeft === 1 ? "" : "s"}`;
  }, [subscriptionDaysLeft, currentClinic?.status]);

  const subscriptionStatTone = useMemo<"primary" | "warning" | "destructive">(() => {
    if (subscriptionDaysLeft !== null && subscriptionDaysLeft <= 3) return "destructive";
    if (subscriptionDaysLeft !== null && subscriptionDaysLeft <= 7) return "warning";
    return "primary";
  }, [subscriptionDaysLeft]);

  return (
    <>
      <PageHeader
        title="Hospital dashboard"
        description={`Authenticated operational data for ${user?.clinic ?? "this hospital"}.`}
        actions={
          <>
            <Button asChild variant="outline"><Link to="/app/appointments/new" search={{ patient: undefined }}>New appointment</Link></Button>
            <Button asChild><Link to="/app/patients/new">Add patient</Link></Button>
          </>
        }
      />

      {currentClinic && (
        <div
          className={cn(
            "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-soft transition-all",
            subscriptionDaysLeft !== null && subscriptionDaysLeft <= 3
              ? "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20"
              : subscriptionDaysLeft !== null && subscriptionDaysLeft <= 7
              ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
              : "border-primary/20 bg-primary/5 text-foreground"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "grid h-8 w-8 place-items-center rounded-xl",
                subscriptionDaysLeft !== null && subscriptionDaysLeft <= 3
                  ? "bg-destructive/20 text-destructive"
                  : subscriptionDaysLeft !== null && subscriptionDaysLeft <= 7
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  : "bg-primary/15 text-primary"
              )}
            >
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <span>Subscription Status</span>
                <Badge
                  variant={
                    subscriptionDaysLeft !== null && subscriptionDaysLeft <= 3
                      ? "destructive"
                      : subscriptionDaysLeft !== null && subscriptionDaysLeft <= 7
                      ? "secondary"
                      : "outline"
                  }
                  className="text-xs"
                >
                  {currentClinic.plan || "ClinicFlow"} · {currentClinic.status || "Active"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {subscriptionDaysLeft === null ? (
                  <span>Subscription active for <strong>{currentClinic.name}</strong>.</span>
                ) : subscriptionDaysLeft < 0 ? (
                  <span className="font-medium text-destructive">
                    Subscription expired {Math.abs(subscriptionDaysLeft)} day(s) ago on {currentClinic.expires}. Please contact the Super Admin for renewal.
                  </span>
                ) : subscriptionDaysLeft === 0 ? (
                  <span className="font-medium text-destructive">
                    Subscription expires today ({currentClinic.expires}). Renewal required.
                  </span>
                ) : (
                  <span>
                    Your clinic has{" "}
                    <strong className="font-semibold text-foreground tabular-nums">
                      {subscriptionDaysLeft} day{subscriptionDaysLeft === 1 ? "" : "s"} left
                    </strong>{" "}
                    on the subscription plan (Renewal date: {currentClinic.expires}).
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                subscriptionDaysLeft !== null && subscriptionDaysLeft <= 3
                  ? "destructive"
                  : subscriptionDaysLeft !== null && subscriptionDaysLeft <= 7
                  ? "secondary"
                  : "outline"
              }
              className="px-2.5 py-1 text-xs tabular-nums"
            >
              {subscriptionDaysLeft === null
                ? "Active Plan"
                : subscriptionDaysLeft < 0
                ? "Expired"
                : `${subscriptionDaysLeft} day${subscriptionDaysLeft === 1 ? "" : "s"} remaining`}
            </Badge>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Today's appointments" value={today.length} icon={<Calendar className="h-4 w-4" />} />
        <StatCard label="New patients" value={newPatients} tone="info" icon={<UserPlus className="h-4 w-4" />} />
        <StatCard label="Upcoming follow-ups" value={followUps} tone="warning" icon={<ClipboardCheck className="h-4 w-4" />} />
        <StatCard
          label="Collected this month"
          value={`INR ${collectedThisMonth.toLocaleString("en-IN")}`}
          tone="success"
          icon={<IndianRupee className="h-4 w-4" />}
        />
        <StatCard label="Active doctors" value={activeDoctors} icon={<Stethoscope className="h-4 w-4" />} />
        <StatCard
          label="Subscription days left"
          value={subscriptionStatValue}
          tone={subscriptionStatTone}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Patient visits this week" subtitle="Appointments recorded in the hospital database">
            <VisitsChart data={weeklyVisits(appointments)} />
          </ChartCard>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Today's schedule</h3>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/app/appointments">All <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
          {today.length === 0 ? (
            <EmptyList message="No appointments are scheduled for today." />
          ) : (
            <ul className="space-y-3">
              {today.slice(0, 5).map(appointment => (
                <li key={appointment.id} className="flex items-center gap-3">
                  <div className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                    {appointment.time}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{appointment.patient}</div>
                    <div className="truncate text-xs text-muted-foreground">{appointment.doctor} - {appointment.type}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{appointment.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6">
        <ChartCard title="Collected revenue" subtitle="Paid invoices from the last six calendar months">
          <RevenueChart data={monthlyRevenue(bills)} />
        </ChartCard>
      </div>
    </>
  );
}

function DoctorDashboard() {
  const { appointments, prescriptions } = useWorkspaceData();
  const todayDate = localDateKey();
  const weekStart = localDateKey(localStartOfWeek());
  const today = appointments
    .filter(appointment => appointment.date === todayDate)
    .sort((left, right) => left.time.localeCompare(right.time));
  const seenThisWeek = appointments.filter(
    appointment => appointment.date >= weekStart
      && appointment.date <= todayDate
      && appointment.status === "Completed",
  ).length;
  const prescriptionsThisWeek = prescriptions.filter(
    prescription => prescription.date >= weekStart && prescription.date <= todayDate,
  ).length;
  const followUpsDue = prescriptions.filter(
    prescription => prescription.followUp
      && prescription.followUp <= todayDate,
  ).length;

  return (
    <>
      <PageHeader
        title="Today's clinic"
        description="Your scoped patients, appointments, and prescriptions."
        actions={<Button asChild><Link to="/app/prescriptions/new">New prescription</Link></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's appointments" value={today.length} icon={<Calendar className="h-4 w-4" />} />
        <StatCard label="Patients seen this week" value={seenThisWeek} tone="success" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Prescriptions this week" value={prescriptionsThisWeek} tone="warning" icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Follow-ups due" value={followUpsDue} tone="info" icon={<Activity className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card shadow-soft lg:col-span-2">
          <div className="flex items-center justify-between border-b p-5">
            <h3 className="font-display text-base font-semibold">My queue</h3>
            <Button asChild variant="ghost" size="sm"><Link to="/app/appointments">View all</Link></Button>
          </div>
          {today.length === 0 ? (
            <EmptyList message="Your queue is empty for today." />
          ) : (
            <div className="divide-y">
              {today.map(appointment => (
                <Link
                  to="/app/patients/$id"
                  params={{ id: appointment.patientId }}
                  key={appointment.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                    {appointment.time}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{appointment.patient}</div>
                    <div className="truncate text-xs text-muted-foreground">{appointment.type}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{appointment.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="mb-3 font-display text-base font-semibold">Recent prescriptions</h3>
          {prescriptions.length === 0 ? (
            <EmptyList message="No prescriptions have been recorded." />
          ) : (
            <ul className="space-y-3">
              {prescriptions.slice(0, 4).map(prescription => (
                <li key={prescription.id} className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{prescription.patient}</div>
                    <div className="truncate text-xs text-muted-foreground">{prescription.diagnosis}</div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">{prescription.date.slice(5)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function ReceptionistDashboard() {
  const { appointments, patients, bills } = useWorkspaceData();
  const todayDate = localDateKey();
  const today = appointments
    .filter(appointment => appointment.date === todayDate)
    .sort((left, right) => left.time.localeCompare(right.time));
  const checkedIn = today.filter(appointment => appointment.status === "Checked-in").length;
  const pendingBills = bills.filter(bill => bill.status !== "Paid").length;
  const newPatients = patients.filter(patient => patient.lastVisit === todayDate).length;

  return (
    <>
      <PageHeader
        title="Front desk"
        description="Register patients, book appointments, and collect payments."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/app/appointments/new" search={{ patient: undefined }}>Book appointment</Link></Button>
            <Button asChild><Link to="/app/patients/new">Register patient</Link></Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's appointments" value={today.length} icon={<Calendar className="h-4 w-4" />} />
        <StatCard label="Checked in" value={checkedIn} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Pending bills" value={pendingBills} tone="warning" icon={<Receipt className="h-4 w-4" />} />
        <StatCard label="New patients today" value={newPatients} tone="info" icon={<UserPlus className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card shadow-soft lg:col-span-2">
          <div className="flex items-center justify-between border-b p-5">
            <h3 className="font-display text-base font-semibold">Today's appointments</h3>
            <Button asChild variant="ghost" size="sm"><Link to="/app/appointments">All</Link></Button>
          </div>
          {today.length === 0 ? (
            <EmptyList message="No appointments are scheduled for today." />
          ) : (
            <div className="divide-y">
              {today.map(appointment => (
                <div key={appointment.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
                  <div className="grid h-10 w-12 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                    {appointment.time}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{appointment.patient}</div>
                    <div className="truncate text-xs text-muted-foreground">{appointment.doctor} - {appointment.type}</div>
                  </div>
                  <Badge variant={appointment.status === "Checked-in" ? "default" : "secondary"} className="shrink-0">
                    {appointment.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="mb-3 font-display text-base font-semibold">Recent patients</h3>
          {patients.length === 0 ? (
            <EmptyList message="No patients have been registered." />
          ) : (
            <ul className="space-y-3">
              {patients.slice(0, 5).map(patient => (
                <li key={patient.id} className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {patient.name.split(" ").map(part => part[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{patient.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{patient.id} - {patient.phone}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
