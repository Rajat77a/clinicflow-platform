import { Link } from "@tanstack/react-router";
import { Activity, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-soft">
              <Activity className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-bold tracking-tight">ClinicFlow</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Healthcare OS</div>
            </div>
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted" }}
                activeOptions={{ exact: true }}
              >
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-xl">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-xl border"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="lg:hidden border-t bg-background px-4 py-3">
            <div className="flex flex-col gap-1">
              {NAV.map((i) => (
                <Link
                  key={i.to}
                  to={i.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  {i.label}
                </Link>
              ))}
              <div className="mt-2">
                <Button asChild variant="outline" className="w-full rounded-xl">
                  <Link to="/login" onClick={() => setOpen(false)}>Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="mt-24 border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground">
                  <Activity className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div className="font-display text-base font-bold">ClinicFlow</div>
              </div>
              <p className="mt-4 max-w-sm text-sm text-muted-foreground">
                A connected clinic management platform for patients, appointments, prescriptions,
                billing and role-based workflows.
              </p>
              <div className="mt-4 text-xs text-muted-foreground">
                Production compliance and certification are pending independent review.
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-foreground">Product</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/features" className="hover:text-foreground">Features</Link></li>
                <li><Link to="/about" className="hover:text-foreground">About us</Link></li>
                <li><Link to="/faq" className="hover:text-foreground">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-foreground">Company</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground">About us</Link></li>
                <li><Link to="/faq" className="hover:text-foreground">FAQ</Link></li>
                <li><Link to="/login" className="hover:text-foreground">Sign in</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <div>© {new Date().getFullYear()} ClinicFlow. All rights reserved.</div>
            <div>Made for clinics across India 🇮🇳</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
