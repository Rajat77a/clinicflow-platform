import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Users, CreditCard, Wallet, FileBarChart, Settings,
  Stethoscope, UserCog, UsersRound, CalendarDays, Receipt, FileText,
  FolderOpen, ShieldCheck, LifeBuoy, BellRing, Plus, CalendarClock, Download, FlaskConical,
} from "lucide-react";
import { useAuth, type Role } from "@/lib/auth";
import { isProductionReadyPath } from "@/lib/production-readiness";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { label: string; items: NavItem[] };

const NAV: Record<Role, NavSection[]> = {
  super_admin: [
    { label: "Overview", items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard },
      { to: "/app/notifications", label: "Notifications", icon: BellRing },
    ]},
    { label: "Operations", items: [
      { to: "/app/clinics", label: "Clinics", icon: Building2 },
      { to: "/app/clinics/new", label: "Add Clinic", icon: Plus },
      { to: "/app/subscriptions", label: "Subscriptions", icon: CreditCard },
      { to: "/app/payments", label: "Payments", icon: Wallet },
      { to: "/app/users", label: "Users", icon: Users },
    ]},
    { label: "Data", items: [
      { to: "/app/downloads", label: "Download Center", icon: Download },
      { to: "/app/reports", label: "Reports", icon: FileBarChart },
      { to: "/app/audit-logs", label: "Audit Logs", icon: ShieldCheck },
    ]},
    { label: "Account", items: [
      { to: "/app/settings", label: "Settings", icon: Settings },
      { to: "/app/support", label: "Support", icon: LifeBuoy },
    ]},
  ],
  clinic_admin: [
    { label: "Overview", items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard },
    ]},
    { label: "People", items: [
      { to: "/app/doctors", label: "Doctors", icon: Stethoscope },
      { to: "/app/receptionists", label: "Receptionists", icon: UserCog },
      { to: "/app/patients", label: "Patients", icon: UsersRound },
      { to: "/app/users", label: "Users", icon: Users },
    ]},
    { label: "Clinic", items: [
      { to: "/app/appointments", label: "Appointments", icon: CalendarDays },
      { to: "/app/prescriptions", label: "Prescriptions", icon: FileText },
      { to: "/app/billing", label: "Billing", icon: Receipt },
      { to: "/app/files", label: "Files", icon: FolderOpen },
    ]},
    { label: "Data", items: [
      { to: "/app/downloads", label: "Download Center", icon: Download },
      { to: "/app/reports", label: "Reports", icon: FileBarChart },
      { to: "/app/audit-logs", label: "Audit Logs", icon: ShieldCheck },
    ]},
    { label: "Account", items: [
      { to: "/app/settings", label: "Settings", icon: Settings },
      { to: "/app/support", label: "Support", icon: LifeBuoy },
    ]},
  ],
  doctor: [
    { label: "Overview", items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard },
    ]},
    { label: "Care", items: [
      { to: "/app/patients", label: "Patients", icon: UsersRound },
      { to: "/app/appointments", label: "Appointments", icon: CalendarDays },
      { to: "/app/prescriptions", label: "Prescriptions", icon: FileText },
      { to: "/app/followups", label: "Follow-ups", icon: CalendarClock },
    ]},
    { label: "Data", items: [
      { to: "/app/downloads", label: "Download Center", icon: Download },
    ]},
    { label: "Account", items: [
      { to: "/app/settings", label: "Settings", icon: Settings },
      { to: "/app/support", label: "Support", icon: LifeBuoy },
    ]},
  ],
  receptionist: [
    { label: "Overview", items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard },
    ]},
    { label: "Front Desk", items: [
      { to: "/app/patients/new", label: "Register Patient", icon: Plus },
      { to: "/app/patients", label: "Patient List", icon: UsersRound },
      { to: "/app/appointments", label: "Appointments", icon: CalendarDays },
      { to: "/app/prescriptions", label: "Prescriptions", icon: FileText },
      { to: "/app/billing", label: "Billing", icon: Receipt },
      { to: "/app/files", label: "Lab Reports", icon: FlaskConical },
    ]},
    { label: "Data", items: [
      { to: "/app/downloads", label: "Download Center", icon: Download },
    ]},
    { label: "Account", items: [
      { to: "/app/settings", label: "Settings", icon: Settings },
      { to: "/app/support", label: "Support", icon: LifeBuoy },
    ]},
  ],
};

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!user) return null;
  const sections = NAV[user.role]
    .map(section => ({
      ...section,
      items: section.items.filter(item => isProductionReadyPath(item.to)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <nav className="flex flex-col gap-6 px-3 py-4">
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {section.label}
          </div>
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || (item.to !== "/app" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-sidebar-foreground/80"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
