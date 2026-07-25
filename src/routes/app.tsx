import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { canAccessPath } from "@/lib/access-control";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isReady } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: state => state.location.pathname });

  useEffect(() => {
    if (isReady && !user) navigate({ to: "/login", replace: true });
  }, [isReady, user, navigate]);

  if (!isReady || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Loading workspace…</div>
      </div>
    );
  }

  if (!canAccessPath(user.role, pathname)) {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center">
          <div className="max-w-md text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <ShieldX className="h-5 w-5" />
            </div>
            <h1 className="mt-4 font-display text-xl font-bold">Access restricted</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This area is not available to the {user.role.replace("_", " ")} portal.
            </p>
            <Button asChild className="mt-5"><Link to="/app">Return to dashboard</Link></Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return <AppShell><Outlet /></AppShell>;
}
