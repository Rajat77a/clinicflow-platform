import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  LogOut,
  Menu,
  Moon,
  Search,
  Stethoscope,
  Sun,
  ChevronDown,
  Clock3,
  UserRound,
  Wifi,
  WifiOff,
  RefreshCw,
  TriangleAlert,
  CalendarPlus,
  ClipboardPlus,
  Receipt,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, ROLE_LABELS, type Role } from "@/lib/auth";
import { canAccessPath } from "@/lib/access-control";
import { useWorkspaceData } from "@/lib/workspace-data";
import { SidebarNav } from "./sidebar-nav";

function ClinicMark({ initials }: { initials: string }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm shadow-soft">
      {initials}
    </div>
  );
}

function Brand() {
  return (
    <Link to="/app" className="flex items-center gap-2.5 px-4 h-16 border-b">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-soft">
        <Activity className="h-5 w-5" strokeWidth={2.5} />
      </div>
      <div className="leading-tight">
        <div className="font-display font-bold text-base tracking-tight">ClinicFlow</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Healthcare OS
        </div>
      </div>
    </Link>
  );
}

function PortalClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time
      dateTime={now?.toISOString()}
      className="inline-flex items-center gap-1.5 tabular-nums"
      title={now?.toLocaleString()}
    >
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{now?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "--:--"}</span>
    </time>
  );
}

function ConnectionStatus({ status }: { status: "connecting" | "live" | "offline" | "error" }) {
  const config = {
    live: { label: "Live", icon: Wifi, className: "text-success" },
    connecting: { label: "Connecting", icon: RefreshCw, className: "text-muted-foreground" },
    offline: { label: "Offline", icon: WifiOff, className: "text-warning-foreground" },
    error: { label: "Sync issue", icon: TriangleAlert, className: "text-destructive" },
  }[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${config.className}`} role="status">
      <Icon className={`h-3.5 w-3.5 ${status === "connecting" ? "animate-spin" : ""}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}

type SearchResult =
  | { id: string; kind: "patient"; name: string; detail: string }
  | { id: string; kind: "doctor"; name: string; detail: string }
  | { id: string; kind: "appointment"; patientId: string; name: string; detail: string }
  | { id: string; kind: "invoice"; patientId: string; name: string; detail: string };

function GlobalSearch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { appointments, bills, doctors, searchPatients } = useWorkspaceData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const normalized = query.toLocaleLowerCase().replace(/\s/g, "");
  const canSearchDoctors = Boolean(user && canAccessPath(user.role, "/app/doctors"));
  const canSearchAppointments = Boolean(user && canAccessPath(user.role, "/app/appointments"));
  const canSearchBills = Boolean(user && canAccessPath(user.role, "/app/billing"));
  const canBookAppointment = Boolean(user && canAccessPath(user.role, "/app/appointments/new"));
  const canCreatePrescription = Boolean(user && canAccessPath(user.role, "/app/prescriptions/new"));

  useEffect(() => {
    if (!normalized) {
      setResults([]);
      setSearching(false);
      return;
    }

    let current = true;
    const doctorResults: SearchResult[] = (canSearchDoctors ? doctors : [])
      .filter((doctor) =>
        [doctor.id, doctor.name, doctor.phone, doctor.email].some((value) =>
          value.toLocaleLowerCase().replace(/\s/g, "").includes(normalized),
        ),
      )
      .map((doctor) => ({
        id: doctor.id,
        kind: "doctor",
        name: doctor.name,
        detail: `${doctor.specialty} · ${doctor.id}`,
      }));
    const appointmentResults: SearchResult[] = (canSearchAppointments ? appointments : [])
      .filter((appointment) =>
        [appointment.id, appointment.patient, appointment.doctor, appointment.date].some((value) =>
          value.toLocaleLowerCase().replace(/\s/g, "").includes(normalized),
        ),
      )
      .map((appointment) => ({
        id: appointment.id,
        patientId: appointment.patientId,
        kind: "appointment",
        name: appointment.patient,
        detail: `${appointment.date} ${appointment.time} - ${appointment.doctor}`,
      }));
    const invoiceResults: SearchResult[] = (canSearchBills ? bills : [])
      .filter((bill) =>
        [bill.id, bill.patient, bill.status].some((value) =>
          value.toLocaleLowerCase().replace(/\s/g, "").includes(normalized),
        ),
      )
      .map((bill) => ({
        id: bill.id,
        patientId: bill.patientId,
        kind: "invoice",
        name: bill.patient,
        detail: `${bill.id} - ${bill.status}`,
      }));
    const workspaceResults = [...doctorResults, ...appointmentResults, ...invoiceResults];
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchPatients({ query, limit: 6 })
        .then((page) => {
          if (!current) return;
          const patientResults: SearchResult[] = page.rows.map((patient) => ({
            id: patient.id,
            kind: "patient",
            name: patient.name,
            detail: `${patient.medicalRecordNumber ?? patient.id} · ${patient.phone}`,
          }));
          setResults([...patientResults, ...workspaceResults].slice(0, 10));
        })
        .catch(() => {
          if (current) setResults(workspaceResults.slice(0, 10));
        })
        .finally(() => {
          if (current) setSearching(false);
        });
    }, 250);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [appointments, bills, canSearchAppointments, canSearchBills, canSearchDoctors, doctors, normalized, query, searchPatients]);

  const select = (result: SearchResult) => {
    setQuery("");
    setOpen(false);
    if (result.kind === "patient" || result.kind === "appointment" || result.kind === "invoice") {
      const patientId = result.kind === "patient" ? result.id : result.patientId;
      navigate({ to: "/app/patients/$id", params: { id: patientId } });
    } else {
      navigate({ to: "/app/doctors" });
    }
  };

  return (
    <form
      className="relative min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        if (results[0]) select(results[0]);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        role="searchbox"
        aria-label="Search workspace"
        autoComplete="off"
        placeholder="Search patients, doctors, phone or ID…"
        className="h-10 w-full rounded-xl border-border/70 bg-muted/40 pl-9 focus-visible:bg-background"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuery("");
            setOpen(false);
          }
        }}
      />
      {open && query && (
        <div
          id="workspace-search-results"
          role="region"
          aria-label="Workspace search results"
          className="absolute left-0 right-0 top-11 z-50 max-h-80 overflow-y-auto rounded-xl border bg-popover p-1 shadow-card"
        >
          {searching ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">Searching…</div>
          ) : results.length ? (
            results.map((result) => (
              <div
                key={`${result.kind}-${result.id}`}
                className="flex items-center rounded-lg hover:bg-muted"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left focus-visible:outline-none"
                  onClick={() => select(result)}
                >
                  {result.kind === "patient" ? <UserRound className="h-4 w-4 shrink-0 text-primary" /> : null}
                  {result.kind === "doctor" ? <Stethoscope className="h-4 w-4 shrink-0 text-info" /> : null}
                  {result.kind === "appointment" ? <CalendarDays className="h-4 w-4 shrink-0 text-primary" /> : null}
                  {result.kind === "invoice" ? <Receipt className="h-4 w-4 shrink-0 text-success" /> : null}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{result.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{result.detail}</span>
                  </span>
                </button>
                {result.kind === "patient" && canBookAppointment && (
                  <Link
                    to="/app/appointments/new"
                    search={{ patient: result.id }}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Book appointment"
                    onClick={() => { setQuery(""); setOpen(false); }}
                  >
                    <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Book appointment for {result.name}</span>
                  </Link>
                )}
                {result.kind === "patient" && canCreatePrescription && (
                  <Link
                    to="/app/prescriptions/new"
                    search={{ patient: result.id }}
                    className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Create prescription"
                    onClick={() => { setQuery(""); setOpen(false); }}
                  >
                    <ClipboardPlus className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Create prescription for {result.name}</span>
                  </Link>
                )}
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No matching records.
            </div>
          )}
        </div>
      )}
    </form>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, isDemoMode } = useAuth();
  const { syncStatus } = useWorkspaceData();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r bg-sidebar">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/60 px-3 py-2.5">
            <ClinicMark initials={user.clinicLogo} />
            <div className="min-w-0">
              <div className="truncate text-xs text-muted-foreground">Currently logged into</div>
              <div className="truncate text-sm font-semibold">{user.clinic}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <Brand />
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              title="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden lg:flex items-center gap-2">
              <ClinicMark initials={user.clinicLogo} />
              <div className="leading-tight">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Clinic
                </div>
                <div className="text-sm font-semibold truncate max-w-[180px]">{user.clinic}</div>
              </div>
            </div>
          </div>

          <GlobalSearch />

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              className="rounded-xl"
              aria-label={dark ? "Use light theme" : "Use dark theme"}
              title={dark ? "Use light theme" : "Use dark theme"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {isDemoMode && (
              <Button asChild variant="ghost" size="icon" className="relative rounded-xl">
                <Link
                  to="/app/notifications"
                  aria-label="View notifications"
                  title="View notifications"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 rounded-xl px-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground text-xs font-semibold">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <div className="text-sm font-semibold">{user.name.split(" ")[0]}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {ROLE_LABELS[user.role]}
                    </div>
                  </div>
                  <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    void logout().then(() => navigate({ to: "/login" }));
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Welcome strip */}
        <div className="border-b bg-gradient-to-r from-primary-soft/40 via-background to-background px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm text-muted-foreground">Welcome back,</div>
              <div className="font-display text-lg font-bold tracking-tight">{user.name}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <ConnectionStatus status={syncStatus} />
              <PortalClock />
              <span>
                Currently logged into{" "}
                <span className="font-semibold text-foreground">{user.clinic}</span>
              </span>
            </div>
          </div>
        </div>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
