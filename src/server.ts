import { renderErrorPage } from "./lib/error-page";
import { applySecurityHeaders, healthResponse, readinessResponse } from "./lib/security-headers";
import {
  requestIdFor,
  traceparentFor,
  writeOperationalLog,
} from "./lib/operational-logging";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

function runtimeValue(env: unknown, key: string) {
  const runtime = env && typeof env === "object" ? env as Record<string, unknown> : {};
  const processLike = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  return runtime[key] ?? processLike?.env?.[key];
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error("A catastrophic SSR error was handled");
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const requestId = requestIdFor(request);
    const traceparent = traceparentFor(request);
    const pathname = new URL(request.url).pathname;
    const startedAt = performance.now();

    if (pathname === "/healthz") {
      return healthResponse(requestId);
    }
    if (pathname === "/readyz") {
      const configured = Boolean(
        runtimeValue(env, "VITE_SUPABASE_URL"),
      ) && Boolean(
        runtimeValue(env, "VITE_SUPABASE_PUBLISHABLE_KEY"),
      );
      return readinessResponse(requestId, configured);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      const secured = applySecurityHeaders(normalized, pathname, requestId, traceparent);
      if (secured.status >= 500) {
        writeOperationalLog({
          event: "request_failed",
          level: "error",
          requestId,
          method: request.method,
          pathname,
          status: secured.status,
          durationMs: Math.round(performance.now() - startedAt),
        });
      }
      return secured;
    } catch {
      writeOperationalLog({
        event: "unhandled_server_error",
        level: "error",
        requestId,
        method: request.method,
        pathname,
        status: 500,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        pathname,
        requestId,
        traceparent,
      );
    }
  },
};
