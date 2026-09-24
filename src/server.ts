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

function runtimeValue(env: unknown, key: string): string | undefined {
  const runtime = env && typeof env === "object" ? (env as Record<string, unknown>) : {};
  const processLike = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  const val = runtime[key] ?? processLike?.env?.[key];
  return typeof val === "string" ? val : undefined;
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
      ) && (
        Boolean(runtimeValue(env, "VITE_SUPABASE_PUBLISHABLE_KEY")) ||
        Boolean(runtimeValue(env, "VITE_SUPABASE_ANON_KEY"))
      );
      return readinessResponse(requestId, configured);
    }

    if (pathname === "/api/send-email" && request.method === "POST") {
      try {
        const body = (await request.json()) as {
          recipientEmail?: string;
          recipientName?: string;
          clinicName?: string;
          clinicId?: string;
          clinicAddress?: string;
          clinicCity?: string;
          clinicPhone?: string;
          clinicEmail?: string;
          setupUrl?: string;
          roleTitle?: string;
          expiresInHours?: number;
        };

        const recipientEmail = body.recipientEmail;
        if (!recipientEmail || !body.setupUrl) {
          return new Response(JSON.stringify({ error: "Missing required recipientEmail or setupUrl" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const resendApiKey = runtimeValue(env, "RESEND_API_KEY")?.trim();
        if (!resendApiKey) {
          return new Response(
            JSON.stringify({
              error: "Email service is not configured.",
              details: "RESEND_API_KEY environment variable is not configured on the server. Please provide a valid RESEND_API_KEY.",
            }),
            {
              status: 503,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const configuredFrom = runtimeValue(env, "EMAIL_FROM")?.trim();
        const fromEmail = configuredFrom
          ? (configuredFrom.includes("<") ? configuredFrom : `ClinicFlow <${configuredFrom}>`)
          : "ClinicFlow <onboarding@resend.dev>";

        // Normalize setupUrl to ensure it points to the deployed application URL instead of localhost
        const appUrl = (runtimeValue(env, "APP_URL") || runtimeValue(env, "VITE_APP_URL"))?.trim();
        let finalSetupUrl = body.setupUrl;
        if (finalSetupUrl) {
          try {
            const parsed = new URL(finalSetupUrl);
            const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
            if (isLocal && appUrl) {
              const base = new URL(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`);
              parsed.protocol = base.protocol;
              parsed.host = base.host;
              finalSetupUrl = parsed.toString();
            } else if (isLocal) {
              const originHeader = request.headers.get("origin") || request.headers.get("referer");
              if (originHeader) {
                const reqOrigin = new URL(originHeader);
                if (reqOrigin.hostname !== "localhost" && reqOrigin.hostname !== "127.0.0.1") {
                  parsed.protocol = reqOrigin.protocol;
                  parsed.host = reqOrigin.host;
                  finalSetupUrl = parsed.toString();
                }
              }
            }
          } catch {
            // Keep setupUrl intact if URL parsing fails
          }
        }

        const subject = `You're invited to manage ${body.clinicName || "your clinic"} on ClinicFlow`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: recipientEmail,
            subject,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
                    <h2 style="color:#0284c7;">You're invited to manage ${body.clinicName || "Clinic"} on ClinicFlow</h2>
                    <p>Hello ${body.recipientName || "Clinical Admin"},</p>
                    <p>You have been invited to manage the following clinic as the Clinical Admin:</p>
                    <table style="width:100%;margin:16px 0;background:#f8fafc;padding:12px;border-radius:8px;">
                      <tr><td><strong>Clinic Name:</strong></td><td>${body.clinicName || "ClinicFlow Health"}</td></tr>
                      ${body.clinicId ? `<tr><td><strong>Clinic ID:</strong></td><td>${body.clinicId}</td></tr>` : ""}
                      ${body.clinicAddress ? `<tr><td><strong>Address:</strong></td><td>${body.clinicAddress}</td></tr>` : ""}
                      ${body.clinicCity ? `<tr><td><strong>City:</strong></td><td>${body.clinicCity}</td></tr>` : ""}
                      ${body.clinicPhone ? `<tr><td><strong>Contact Number:</strong></td><td>${body.clinicPhone}</td></tr>` : ""}
                      <tr><td><strong>Clinical Admin Email:</strong></td><td>${recipientEmail}</td></tr>
                    </table>
                    <p style="margin:24px 0;">
                      <a href="${finalSetupUrl}" style="background:#0284c7;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Create Your Password</a>
                    </p>
                    <p style="color:#64748b;font-size:13px;">This invitation link is valid for 24 hours.</p>
                    <p style="color:#64748b;font-size:12px;">Please use this email address (${recipientEmail}) and the password you create through the link to log in.</p>
                  </div>`,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };

        if (!res.ok || !data?.id) {
          const errorMsg = data?.message || `Resend rejected email dispatch with status ${res.status}`;
          console.error("[Email Dispatch] Resend error:", errorMsg);
          return new Response(
            JSON.stringify({
              error: `Email delivery failed: ${errorMsg}`,
              details: errorMsg,
            }),
            {
              status: res.status >= 400 && res.status < 600 ? res.status : 502,
              headers: { "content-type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            delivered: true,
            provider: "resend",
            emailId: data.id,
            recipient: recipientEmail,
            message: `Invitation email sent successfully to ${recipientEmail}`,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to process invitation email";
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
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
