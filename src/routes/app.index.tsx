import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2, CheckCircle2, AlertCircle, Users, UserPlus, Activity,
  Calendar, Stethoscope, TrendingUp, BellRing, DollarSign, Receipt,
  ClipboardCheck, FileText, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  notifications, revenueByMonth, subscriptions, visitsByWeek,
} from "@/lib/sample-data";
import { useWorkspaceData } from "@/lib/workspace-data";

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

function ChartCard({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
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

function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={revenueByMonth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `€${v/1000}k`} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)" }} formatter={(v: number) => [`€${v.toLocaleString()}`, "Revenue"]} />
        <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#rev)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function VisitsChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={visitsByWeek} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)" }} />
        <Bar dataKey="visits" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function NotifList() {
  const toneMap = {
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
    success: "bg-success/15 text-success",
  } as const;
  return (
    <ul className="divide-y">
      {notifications.map((n, i) => (
        <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneMap[n.type as keyof typeof toneMap]}`}>
            <BellRing className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{n.title}</div>
            <div className="text-xs text-muted-foreground">{n.time}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Super Admin ---------- */
function SuperAdminDashboard() {
  const { clinics } = useWorkspaceData();
  const totalClinics = clinics.length;
  const active = clinics.filter(c => c.status === "Active").length;
  const expired = clinics.filter(c => c.status === "Expired").length;
  const totalDoctors = clinics.reduce((s, c) => s + c.doctors, 0);
  const totalPatients = clinics.reduce((s, c) => s + c.patients, 0);
  const revenue = revenueByMonth.at(-1)!.revenue;

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Health of every clinic running on ClinicFlow."
        actions={<Button asChild><Link to="/app/clinics/new">Add Clinic</Link></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Clinics" value={totalClinics} icon={<Building2 className="h-4 w-4" />} trend={{ value: "+2", up: true }} />
        <StatCard label="Active" value={active} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Expired" value={expired} tone="destructive" icon={<AlertCircle className="h-4 w-4" />} />
        <StatCard label="Total Doctors" value={totalDoctors} tone="info" icon={<Stethoscope className="h-4 w-4" />} trend={{ value: "+4", up: true }} />
        <StatCard label="Total Patients" value={totalPatients.toLocaleString()} icon={<Users className="h-4 w-4" />} trend={{ value: "+312", up: true }} />
        <StatCard label="MRR" value={`€${revenue.toLocaleString()}`} tone="success" icon={<TrendingUp className="h-4 w-4" />} trend={{ value: "+11%", up: true }} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Revenue" subtitle="Last 6 months · €" action={<Badge variant="secondary">€34,750 in Jun</Badge>}>
            <RevenueChart />
          </ChartCard>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Notifications</h3>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/app/notifications">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
          <NotifList />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h3 className="font-display text-base font-semibold">Subscriptions needing attention</h3>
            <p className="text-xs text-muted-foreground">Expiring soon or already expired.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/app/subscriptions">Manage</Link></Button>
        </div>
        <div className="divide-y">
          {subscriptions.filter(s => s.daysLeft <= 30).map((s) => (
            <div key={s.clinic} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 sm:flex sm:flex-wrap sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{s.clinic}</div>
                <div className="text-xs text-muted-foreground">₹{s.price}/mo · Renews {s.renews}</div>
              </div>
              <Badge variant={s.status === "Expired" ? "destructive" : "secondary"}>
                {s.daysLeft < 0 ? `Expired ${Math.abs(s.daysLeft)}d ago` : `${s.daysLeft} days left`}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- Clinic Admin ---------- */
function ClinicAdminDashboard() {
  const { appointments, patients, doctors } = useWorkspaceData();
  const todayDate = new Date().toISOString().slice(0, 10);
  const today = appointments.filter(a => a.date === todayDate);
  const newPatients = patients.filter(patient => patient.lastVisit === todayDate).length;
  const activeDoctors = doctors.filter(doctor => doctor.status === "Active").length;
  return (
    <>
      <PageHeader
        title="Clinic dashboard"
        description="A snapshot of today at Northwood Health."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/app/appointments/new">New Appointment</Link></Button>
            <Button asChild><Link to="/app/patients/new">Add Patient</Link></Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Today's Appointments" value={today.length} icon={<Calendar className="h-4 w-4" />} trend={{ value: "+3", up: true }} />
        <StatCard label="New Patients" value={newPatients} tone="info" icon={<UserPlus className="h-4 w-4" />} />
        <StatCard label="Follow-Ups" value="9" tone="warning" icon={<ClipboardCheck className="h-4 w-4" />} />
        <StatCard label="Monthly Revenue" value="€34,750" tone="success" icon={<DollarSign className="h-4 w-4" />} trend={{ value: "+11%", up: true }} />
        <StatCard label="Active Doctors" value={activeDoctors} icon={<Stethoscope className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Patient visits this week" subtitle="Walk-ins + appointments">
            <VisitsChart />
          </ChartCard>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Today's schedule</h3>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/app/appointments">All <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
          <ul className="space-y-3">
            {today.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <div className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary text-xs font-bold">
                  {a.time}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{a.patient}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.doctor} · {a.type}</div>
                </div>
                <Badge variant="secondary" className="shrink-0">{a.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

/* ---------- Doctor ---------- */
function DoctorDashboard() {
  const { user } = useAuth();
  const { appointments, prescriptions } = useWorkspaceData();
  const my = appointments.filter(a => a.doctor === user?.name);
  return (
    <>
      <PageHeader
        title="Today's clinic"
        description="Your patients, notes, and prescriptions for the day."
        actions={<Button asChild><Link to="/app/prescriptions/new">New Prescription</Link></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My Appointments" value={my.length} icon={<Calendar className="h-4 w-4" />} />
        <StatCard label="Patients seen (week)" value="38" tone="success" icon={<Users className="h-4 w-4" />} trend={{ value: "+6", up: true }} />
        <StatCard label="Pending notes" value="3" tone="warning" icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Follow-ups due" value="7" tone="info" icon={<Activity className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b p-5">
            <h3 className="font-display text-base font-semibold">My queue</h3>
            <Button asChild variant="ghost" size="sm"><Link to="/app/appointments">View all</Link></Button>
          </div>
          <div className="divide-y">
            {my.map((a) => (
              <Link to="/app/patients/$id" params={{ id: a.patientId }} key={a.id}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                <div className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary text-xs font-bold">{a.time}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{a.patient}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.type} · {a.date}</div>
                </div>
                <Badge variant="secondary" className="shrink-0">{a.status}</Badge>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="mb-3 font-display text-base font-semibold">Recent prescriptions</h3>
          <ul className="space-y-3">
            {prescriptions.slice(0, 4).map(p => (
              <li key={p.id} className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.patient}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.diagnosis}</div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{p.date.slice(5)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

/* ---------- Receptionist ---------- */
function ReceptionistDashboard() {
  const { appointments, patients, bills } = useWorkspaceData();
  const todayDate = new Date().toISOString().slice(0, 10);
  const today = appointments.filter(a => a.date === todayDate);
  const pendingBills = bills.filter(bill => bill.status !== "Paid").length;
  const newPatients = patients.filter(patient => patient.lastVisit === todayDate).length;
  return (
    <>
      <PageHeader
        title="Front desk"
        description="Register patients, book appointments, collect payments."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/app/appointments/new">Book appointment</Link></Button>
            <Button asChild><Link to="/app/patients/new">Register patient</Link></Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's appointments" value={today.length} icon={<Calendar className="h-4 w-4" />} />
        <StatCard label="Checked-in" value="2" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Pending bills" value={pendingBills} tone="warning" icon={<Receipt className="h-4 w-4" />} />
        <StatCard label="New patients (today)" value={newPatients} tone="info" icon={<UserPlus className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b p-5">
            <h3 className="font-display text-base font-semibold">Today's appointments</h3>
            <Button asChild variant="ghost" size="sm"><Link to="/app/appointments">All</Link></Button>
          </div>
          <div className="divide-y">
            {today.map((a) => (
              <div key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
                <div className="grid h-10 w-12 place-items-center rounded-lg bg-primary-soft text-primary text-xs font-bold">{a.time}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{a.patient}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.doctor} · {a.type}</div>
                </div>
                <Badge variant={a.status === "Checked-in" ? "default" : "secondary"} className="shrink-0">{a.status}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="mb-3 font-display text-base font-semibold">Recent patients</h3>
          <ul className="space-y-3">
            {patients.slice(0, 5).map(p => (
              <li key={p.id} className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground text-xs font-semibold">
                  {p.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.id} · {p.phone}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
