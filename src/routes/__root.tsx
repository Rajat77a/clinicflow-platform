import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { WorkspaceDataProvider } from "@/lib/workspace-data";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    console.error("Router error:", error);
    const errString = error instanceof Error ? error.message : String(error || "");
    const isChunkLoadFailed =
      errString.includes("Failed to fetch dynamically imported module") ||
      errString.includes("Importing a module script failed") ||
      errString.includes("error loading dynamically imported module");

    if (isChunkLoadFailed) {
      const reloadKey = "cf_chunk_reload";
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 10_000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
      }
    }
  }, [error]);

  const handleTryAgain = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    } else {
      router.invalidate();
      reset();
    }
  };

  const errorMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {errorMessage && (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive text-left font-mono break-all max-h-36 overflow-y-auto">
            {errorMessage}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={handleTryAgain}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ClinicFlow - Hospital Operations" },
      { name: "description", content: "Secure hospital operations for authorized clinical and administrative staff." },
      { name: "author", content: "ClinicFlow" },
      { property: "og:title", content: "ClinicFlow - Hospital Operations" },
      { property: "og:description", content: "Secure hospital operations for authorized clinical and administrative staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "ClinicFlow - Hospital Operations" },
      { name: "twitter:description", content: "Secure hospital operations for authorized clinical and administrative staff." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/clinicflow-icon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthenticatedWorkspace />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedWorkspace() {
  return (
    <WorkspaceDataProvider>
      <Outlet />
      <Toaster richColors position="top-right" />
    </WorkspaceDataProvider>
  );
}
