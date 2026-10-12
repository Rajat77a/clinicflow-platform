import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";

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

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", () => {
    const key = "cf_preload_reload";
    const last = sessionStorage.getItem(key);
    const now = Date.now();
    if (!last || now - Number(last) > 10000) {
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    }
  });
}

function isDynamicChunkError(error: unknown, message: string): boolean {
  const text = (message + " " + (error instanceof Error ? error.stack || "" : "")).toLowerCase();
  return (
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("importing a module script failed") ||
    text.includes("error loading dynamically imported module") ||
    text.includes("loading chunk") ||
    text.includes("chunkloaderror")
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : (error as { message?: string })?.message || "An unexpected error occurred.";

  const isChunkError = isDynamicChunkError(error, errorMessage);
  const errorStack = error instanceof Error ? error.stack : null;

  useEffect(() => {
    console.error("ClinicFlow Route Error caught by __root:", error);

    // If this is a stale dynamic module chunk error from a new deployment, auto-reload once
    if (isChunkError && typeof window !== "undefined") {
      const retryKey = "cf_chunk_reload_" + window.location.pathname;
      const lastRetry = sessionStorage.getItem(retryKey);
      const now = Date.now();
      if (!lastRetry || now - Number(lastRetry) > 15000) {
        sessionStorage.setItem(retryKey, String(now));
        window.location.reload();
      }
    }
  }, [error, isChunkError]);

  const handleReload = () => {
    if (typeof window !== "undefined") {
      // Force a hard reload to fetch fresh HTML and new chunk hashes
      window.location.reload();
    } else {
      router.invalidate();
      reset();
    }
  };

  const handleResetSession = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("cf_user");
        localStorage.removeItem("cf_registered_accounts");
        sessionStorage.clear();
      }
    } catch {
      // ignore
    }
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {isChunkError ? "New Version Available" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isChunkError
            ? "A new update has been published. Your browser was trying to load an older cached module. Please reload to use the latest version."
            : "Something went wrong while rendering this page. You can try refreshing, return home, or reset your local session."}
        </p>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-left text-xs text-destructive">
            <div className="font-semibold uppercase tracking-wider text-[10px] text-destructive/80 mb-1">
              {isChunkError ? "Deployment status" : "Error details"}
            </div>
            <div className="font-mono break-words">{errorMessage}</div>
          </div>
        )}

        {errorStack && !isChunkError && (
          <details className="mt-3 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
              View technical stack trace
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted/60 p-3 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all border border-border">
              {errorStack}
            </pre>
          </details>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={handleReload}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
          >
            {isChunkError ? "Update & Reload" : "Try again"}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
          <button
            onClick={handleResetSession}
            className="inline-flex items-center justify-center rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            Reset Session & Login
          </button>
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
