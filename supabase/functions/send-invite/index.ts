import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const allowedOrigin = Deno.env.get("CLINICFLOW_ALLOWED_ORIGIN") ?? "";
const allowedHeaders = [
  "authorization",
  "apikey",
  "content-type",
  "idempotency-key",
  "x-client-info",
  "x-request-id",
].join(", ");

// Email provider configuration
const EMAIL_PROVIDER = Deno.env.get("EMAIL_PROVIDER") ?? "resend"; // resend, sendgrid, mailgun, smtp
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");
const SMTP_HOST = Deno.env.get("SMTP_HOST");
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") ?? "587");
const SMTP_USER = Deno.env.get("SMTP_USER");
const SMTP_PASS = Deno.env.get("SMTP_PASS");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "noreply@clinicflow.com";
const EMAIL_FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") ?? "ClinicFlow";

function createResponse(
  status: number,
  body: Record<string, unknown> | null,
  requestId: string,
) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": allowedHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "X-Request-ID": requestId,
      Vary: "Origin",
    },
  });
}

async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    switch (EMAIL_PROVIDER) {
      case "resend": {
        if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY not configured" };
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
            to: [to],
            subject,
            html,
            text,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          return { success: false, error: `Resend error: ${err.message || res.statusText}` };
        }
        return { success: true };
      }
      case "sendgrid": {
        if (!SENDGRID_API_KEY) return { success: false, error: "SENDGRID_API_KEY not configured" };
        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }], subject }],
            from: { email: EMAIL_FROM, name: EMAIL_FROM_NAME },
            content: [
              { type: "text/plain", value: text },
              { type: "text/html", value: html },
            ],
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          return { success: false, error: `SendGrid error: ${err.errors?.[0]?.message || res.statusText}` };
        }
        return { success: true };
      }
      case "mailgun": {
        if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) return { success: false, error: "MAILGUN_API_KEY or MAILGUN_DOMAIN not configured" };
        const formData = new FormData();
        formData.append("from", `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`);
        formData.append("to", to);
        formData.append("subject", subject);
        formData.append("text", text);
        formData.append("html", html);
        const res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
          },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          return { success: false, error: `Mailgun error: ${err.message || res.statusText}` };
        }
        return { success: true };
      }
      case "smtp": {
        if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return { success: false, error: "SMTP configuration incomplete" };
        // For SMTP, we'd need a library like nodemailer, which isn't available in Deno edge functions easily
        // This is a placeholder - in production, use a proper email service
        console.warn("SMTP email sending not implemented in edge function. Use Resend, SendGrid, or Mailgun.");
        return { success: false, error: "SMTP not supported in edge functions. Use Resend, SendGrid, or Mailgun." };
      }
      default:
        return { success: false, error: `Unknown email provider: ${EMAIL_PROVIDER}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown email error" };
  }
}

function generateInviteEmail({
  fullName,
  clinicName,
  clinicEmail,
  clinicPhone,
  clinicAddress,
  setupUrl,
  roleLabel,
}: {
  fullName: string;
  clinicName: string | null;
  clinicEmail: string | null;
  clinicPhone: string | null;
  clinicAddress: string | null;
  setupUrl: string;
  roleLabel: string;
}): { subject: string; html: string; text: string } {
  const subject = `You're invited to join ${clinicName ?? "ClinicFlow"} as a ${roleLabel}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">ClinicFlow</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Healthcare OS</p>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="margin: 0 0 16px; font-size: 20px;">Welcome aboard, ${fullName}!</h2>
    <p style="margin: 0 0 16px;">You've been invited to join <strong>${clinicName ?? "your clinic"}</strong> as a <strong>${roleLabel}</strong> on ClinicFlow.</p>
    ${clinicEmail ? `<p style="margin: 0 0 8px;"><strong>Clinic Email:</strong> ${clinicEmail}</p>` : ""}
    ${clinicPhone ? `<p style="margin: 0 0 8px;"><strong>Clinic Phone:</strong> ${clinicPhone}</p>` : ""}
    ${clinicAddress ? `<p style="margin: 0 0 16px;"><strong>Clinic Address:</strong> ${clinicAddress}</p>` : ""}
    <div style="text-align: center; margin: 24px 0;">
      <a href="${setupUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Set Up Your Account</a>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin: 16px 0 0;">Or copy this link to your browser:</p>
    <p style="font-size: 12px; color: #9ca3af; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 6px;">${setupUrl}</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">This invitation expires in 24 hours. If you didn't expect this invitation, please ignore this email.</p>
    <p style="font-size: 12px; color: #9ca3af; margin: 8px 0 0;">— The ClinicFlow Team</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Welcome aboard, ${fullName}!

You've been invited to join ${clinicName ?? "your clinic"} as a ${roleLabel} on ClinicFlow.
${clinicEmail ? `Clinic Email: ${clinicEmail}` : ""}
${clinicPhone ? `Clinic Phone: ${clinicPhone}` : ""}
${clinicAddress ? `Clinic Address: ${clinicAddress}` : ""}

Set up your account: ${setupUrl}

This invitation expires in 24 hours. If you didn't expect this invitation, please ignore this email.

— The ClinicFlow Team
  `.trim();

  return { subject, html, text };
}

function getRoleLabel(roleCode: string): string {
  const labels: Record<string, string> = {
    clinic_admin: "Clinic Admin",
    doctor: "Doctor",
    receptionist: "Receptionist",
    super_admin: "Super Admin",
  };
  return labels[roleCode] ?? roleCode;
}

Deno.serve(async (request) => {
  const requestedId = request.headers.get("x-request-id")?.trim() ?? "";
  const requestId = /^[0-9a-f-]{36}$/i.test(requestedId)
    ? requestedId
    : crypto.randomUUID();
  const response = (status: number, body: Record<string, unknown> | null) => {
    return createResponse(status, body, requestId);
  };

  if (request.method === "OPTIONS") {
    return response(204, null);
  }
  if (request.method !== "POST") {
    return response(405, { error: "Method not allowed" });
  }
  if (!allowedOrigin || request.headers.get("origin") !== allowedOrigin) {
    return response(403, { error: "Origin not allowed" });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return response(400, { error: "Missing authorization" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return response(503, { error: "Service configuration is incomplete" });
  }

  try {
    const payload = await request.json();
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const roleCode = typeof payload.roleCode === "string" ? payload.roleCode : "";
    const hospitalId = typeof payload.hospitalId === "string" ? payload.hospitalId : "";
    const facilityId = typeof payload.facilityId === "string" ? payload.facilityId : null;
    const clinicName = typeof payload.clinicName === "string" ? payload.clinicName.trim() : null;
    const clinicEmail = typeof payload.clinicEmail === "string" ? payload.clinicEmail.trim() : null;
    const clinicPhone = typeof payload.clinicPhone === "string" ? payload.clinicPhone.trim() : null;
    const clinicAddress = typeof payload.clinicAddress === "string" ? payload.clinicAddress.trim() : null;
    const setupUrl = typeof payload.setupUrl === "string" ? payload.setupUrl.trim() : "";

    if (!email || !fullName || !roleCode || !hospitalId) {
      return response(422, { error: "Email, name, role, and hospital are required" });
    }

    const allowedRoles = new Set(["clinic_admin", "doctor", "receptionist", "super_admin"]);
    if (!allowedRoles.has(roleCode)) {
      return response(422, { error: "Unsupported role" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let token: string;
    let finalSetupUrl: string;

    if (setupUrl) {
      // Extract token from provided setupUrl
      const url = new URL(setupUrl);
      token = url.searchParams.get("token") ?? "";
      finalSetupUrl = setupUrl;
    } else {
      // Generate new token
      token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      finalSetupUrl = `${allowedOrigin}/setup?token=${token}`;

      const { error: insertError } = await adminClient.from("invite_tokens").insert({
        email,
        full_name: fullName,
        phone,
        role_code: roleCode,
        hospital_id: hospitalId,
        facility_id: facilityId,
        token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        clinic_name: clinicName,
        clinic_email: clinicEmail,
        clinic_phone: clinicPhone,
        clinic_address: clinicAddress,
      });
      if (insertError) {
        console.error(JSON.stringify({ event: "invite_token_insert_failed", error: insertError.message }));
        return response(500, { error: "Failed to generate invite token" });
      }
    }

    // Send invitation email
    const roleLabel = getRoleLabel(roleCode);
    const emailContent = generateInviteEmail({
      fullName,
      clinicName,
      clinicEmail,
      clinicPhone,
      clinicAddress,
      setupUrl: finalSetupUrl,
      roleLabel,
    });

    const emailResult = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return response(201, {
      token,
      setupUrl: finalSetupUrl,
      email,
      emailSent: emailResult.success,
      emailError: emailResult.error,
      message: emailResult.success
        ? "Invitation email sent successfully"
        : "Invite token generated but email could not be sent. Share the setup URL manually.",
    });
  } catch (error) {
    return response(500, { error: "Unable to process the invitation" });
  }
});