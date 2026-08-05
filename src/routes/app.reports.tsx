import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceData } from "@/lib/workspace-data";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Users, Stethoscope, Calendar } from "lucide-react";

export const Route = createFileRoute("/app/reports")({ component: ReportsPage });

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <h3 className="mb-4 font-display text-base font-semibold">{title}</h3>
      <div className="h-72">{children}</div>
    </div>
  );
}

function ReportsPage() {
  const { clinics, patients, doctors, appointments, bills } = useWorkspaceData();

  const totalRevenue = bills
    .filter(b => b.status === "Paid")
    .reduce((sum, b) => sum + b.amount, 0);

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      month: date.toLocaleDateString("en-IN", { month: "short" }),
      revenue: bills
        .filter(b => b.status === "Paid" && b.date.startsWith(monthKey))
        .reduce((sum, b) => sum + b.amount, 0),
    };
  });

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const visitsByWeek = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateKey = date.toISOString().slice(0, 10);
    return {
      day: date.toLocaleDateString("en-IN", { weekday: "short" }),
      visits: appointments.filter(a => a.date === dateKey).length,
    };
  });

  const doctorStats = doctors.map(d => ({
    name: d.name,
    patients: patients.filter(p => p.doctor === d.name).length,
  }));

  return (
    <>
      <PageHeader title="Reports" description="Operational and financial insights." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={`₹${totalRevenue.toLocaleString("en-IN")}`} tone="success" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Total patients" value={patients.length} tone="info" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Active doctors" value={doctors.filter(d => d.status === "Active").length} icon={<Stethoscope className="h-4 w-4" />} />
        <StatCard label="Total appointments" value={appointments.length} icon={<Calendar className="h-4 w-4" />} />
      </div>
      <Tabs defaultValue="revenue" className="mt-6">
        <TabsList className="rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="revenue" className="rounded-lg">Revenue</TabsTrigger>
          <TabsTrigger value="patients" className="rounded-lg">Patients</TabsTrigger>
          <TabsTrigger value="doctors" className="rounded-lg">Doctors</TabsTrigger>
          <TabsTrigger value="appointments" className="rounded-lg">Appointments</TabsTrigger>
        </TabsList>
        <TabsContent value="revenue" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Monthly revenue">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByMonth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs><linearGradient id="r2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={12} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip contentStyle={{ borderRadius: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" fill="url(#r2)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Revenue by clinic">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clinics.map(c => ({ name: c.name.length > 15 ? c.name.slice(0, 15) + "..." : c.name, patients: c.patients }))}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={12} /><Tooltip /><Legend />
                <Bar dataKey="patients" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>
        <TabsContent value="patients" className="mt-4">
          <Card title="Patients by clinic">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clinics.map(c => ({ name: c.name.length > 15 ? c.name.slice(0, 15) + "..." : c.name, count: c.patients }))}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={60} /><YAxis fontSize={12} /><Tooltip /><Legend />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} name="Patients" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>
        <TabsContent value="doctors" className="mt-4">
          <Card title="Patients per doctor">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={doctorStats} margin={{ left: 32 }}>
                <CartesianGrid stroke="var(--color-border)" horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} /><YAxis dataKey="name" type="category" fontSize={11} width={140} />
                <Tooltip />
                <Bar dataKey="patients" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>
        <TabsContent value="appointments" className="mt-4">
          <Card title="Visits this week">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visitsByWeek}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" fontSize={12} /><YAxis fontSize={12} /><Tooltip />
                <Line type="monotone" dataKey="visits" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
