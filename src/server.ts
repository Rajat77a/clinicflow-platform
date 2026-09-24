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

        const resendApiKey = runtimeValue(env, "RESEND_API_KEY");
        const fromEmail = runtimeValue(env, "EMAIL_FROM") || "ClinicFlow <onboarding@resend.dev>";
        const subject = `You're invited to manage ${body.clinicName || "your clinic"} on ClinicFlow`;

        let delivered = false;
        let provider = "local-simulated";
        let providerId: string | undefined;
        let errorDetails: string | undefined;

        if (resendApiKey) {
          try {
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
                html: body.setupUrl
                  ? `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
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
                        <a href="${body.setupUrl}" style="background:#0284c7;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Create Your Password</a>
                      </p>
                      <p style="color:#64748b;font-size:13px;">This invitation link is valid for 24 hours.</p>
                      <p style="color:#64748b;font-size:12px;">Please use this email address (${recipientEmail}) and the password you create through the link to log in.</p>
                    </div>`
                  : undefined,
              }),
            });
            const data = (await res.json()) as { id?: string; message?: string };
            if (res.ok && data?.id) {
              delivered = true;
              provider = "resend";
              providerId = data.id;
            } else {
              errorDetails = data?.message || "Resend dispatch failed";
              console.warn("[Email Dispatch] Resend error:", errorDetails);
            }
          } catch (resendErr) {
            errorDetails = resendErr instanceof Error ? resendErr.message : "Network error calling email provider";
            console.warn("[Email Dispatch] Failed to send via Resend:", errorDetails);
          }
        } else {
          console.info(`[Email Dispatch] Notice: RESEND_API_KEY environment variable is not configured. Invitation email for ${recipientEmail} (${body.setupUrl}) logged in operational logs.`);
        }

        return new Response(
          JSON.stringify({
            success: true,
            delivered,
            provider,
            providerId,
            recipient: recipientEmail,
            message: delivered
              ? `Live invitation email sent to ${recipientEmail}`
              : `Invitation registered for ${recipientEmail}. (Setup URL: ${body.setupUrl})`,
            warning: !resendApiKey ? "RESEND_API_KEY not configured on server. Live delivery simulated." : undefined,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      } catch {
        return new Response(JSON.stringify({ error: "Failed to process invitation email" }), {
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
