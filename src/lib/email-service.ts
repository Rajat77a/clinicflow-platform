export interface InvitationEmailParams {
  recipientEmail: string;
  recipientName: string;
  clinicName: string;
  clinicId?: string;
  clinicAddress?: string;
  clinicCity?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  setupUrl: string;
  roleTitle?: string;
  expiresInHours?: number;
}

export interface DispatchedEmailRecord extends InvitationEmailParams {
  id: string;
  sentAt: string;
}

const memoryDispatchedEmails: DispatchedEmailRecord[] = [];

export function generateInvitationEmailHtml(params: InvitationEmailParams): string {
  const {
    recipientName,
    recipientEmail,
    clinicName,
    clinicId,
    clinicAddress,
    clinicCity,
    clinicPhone,
    clinicEmail,
    setupUrl,
    roleTitle = "Clinical Admin",
    expiresInHours = 24,
  } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to manage ${clinicName} - ClinicFlow</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px; text-align: left;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <div style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">ClinicFlow</div>
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255, 255, 255, 0.85); margin-top: 4px;">Healthcare Operations Platform</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h1 style="font-size: 21px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">
                You're invited to manage ${clinicName}
              </h1>
              
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                Hello <strong>${recipientName}</strong>,
              </p>

              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
                You have been invited to join ClinicFlow as the <strong>${roleTitle}</strong> for:
              </p>

              <!-- Clinic Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0 0 24px 0; overflow: hidden;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6">
                      <tr>
                        <td width="32%" style="font-size: 13px; font-weight: 600; color: #64748b;">Clinic:</td>
                        <td style="font-size: 14px; font-weight: 700; color: #0f172a;">${clinicName}</td>
                      </tr>
                      ${clinicId ? `
                      <tr>
                        <td style="font-size: 13px; font-weight: 600; color: #64748b;">Clinic ID:</td>
                        <td style="font-size: 13px; font-family: monospace; color: #0284c7; font-weight: 600;">${clinicId}</td>
                      </tr>` : ""}
                      ${clinicCity ? `
                      <tr>
                        <td style="font-size: 13px; font-weight: 600; color: #64748b;">Location:</td>
                        <td style="font-size: 13px; color: #334155;">${clinicCity}</td>
                      </tr>` : ""}
                      ${clinicAddress ? `
                      <tr>
                        <td style="font-size: 13px; font-weight: 600; color: #64748b;">Address:</td>
                        <td style="font-size: 13px; color: #334155;">${clinicAddress}</td>
                      </tr>` : ""}
                      ${clinicPhone ? `
                      <tr>
                        <td style="font-size: 13px; font-weight: 600; color: #64748b;">Contact:</td>
                        <td style="font-size: 13px; color: #334155;">${clinicPhone}</td>
                      </tr>` : ""}
                      ${clinicEmail ? `
                      <tr>
                        <td style="font-size: 13px; font-weight: 600; color: #64748b;">Clinic Email:</td>
                        <td style="font-size: 13px; color: #334155;">${clinicEmail}</td>
                      </tr>` : ""}
                      <tr>
                        <td style="font-size: 13px; font-weight: 600; color: #64748b;">Clinical Admin:</td>
                        <td style="font-size: 13px; color: #334155;">${recipientName} (${recipientEmail})</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
                Click the button below to create your password and access the ClinicFlow portal.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${setupUrl}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
                      Create Password & Activate Account
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <div style="background-color: #fefce8; border-left: 4px solid #eab308; border-radius: 6px; padding: 14px 16px; margin: 20px 0;">
                <p style="font-size: 13px; line-height: 1.5; color: #854d0e; margin: 0;">
                  ⏰ <strong>Security Notice:</strong> This invitation link will expire in <strong>${expiresInHours} hours</strong>. Please set your password before it expires.
                </p>
              </div>

              <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin: 24px 0 0 0;">
                If you were not expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                ClinicFlow Healthcare Operations Platform &bull; Secure Hospital Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function generateInvitationEmailText(params: InvitationEmailParams): string {
  const {
    recipientName,
    recipientEmail,
    clinicName,
    clinicId,
    clinicAddress,
    clinicCity,
    clinicPhone,
    clinicEmail,
    setupUrl,
    roleTitle = "Clinical Admin",
    expiresInHours = 24,
  } = params;

  const lines = [
    `You're invited to manage ${clinicName}`,
    ``,
    `Hello ${recipientName},`,
    ``,
    `You have been invited to join ClinicFlow as the ${roleTitle} for:`,
    `Clinic: ${clinicName}`,
  ];

  if (clinicId) lines.push(`Clinic ID: ${clinicId}`);
  if (clinicCity) lines.push(`Location: ${clinicCity}`);
  if (clinicAddress) lines.push(`Address: ${clinicAddress}`);
  if (clinicPhone) lines.push(`Contact: ${clinicPhone}`);
  if (clinicEmail) lines.push(`Clinic Email: ${clinicEmail}`);
  if (recipientEmail) lines.push(`Clinical Admin Email: ${recipientEmail}`);

  lines.push(
    ``,
    `Click the button below to create your password and access the ClinicFlow portal:`,
    setupUrl,
    ``,
    `[Create Password & Activate Account]`,
    ``,
    `This invitation link will expire in ${expiresInHours} hours.`,
    ``,
    `— ClinicFlow Healthcare Operations Platform`
  );

  return lines.join("\n");
}

export function generateEmailSubject(params: Pick<InvitationEmailParams, "clinicName" | "roleTitle">): string {
  return `You're invited to manage ${params.clinicName} - ClinicFlow`;
}

export function generateMailtoUrl(params: InvitationEmailParams): string {
  const subject = generateEmailSubject(params);
  const body = generateInvitationEmailText(params);
  return `mailto:${encodeURIComponent(params.recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function generateGmailComposeUrl(params: InvitationEmailParams): string {
  const subject = generateEmailSubject(params);
  const body = generateInvitationEmailText(params);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(params.recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function registerLocalInviteToken(tokenInfo: {
  token: string;
  email: string;
  name: string;
  phone?: string;
  clinicName: string;
  clinicId: string;
  clinicAddress?: string;
  clinicCity?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  roleCode?: string;
  expiresAt: string;
  used?: boolean;
}) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("cf_local_tokens");
    const tokens = raw ? JSON.parse(raw) : {};
    tokens[tokenInfo.token] = tokenInfo;
    localStorage.setItem("cf_local_tokens", JSON.stringify(tokens));
  } catch {
    // ignore
  }
}

export function getLocalInviteToken(token: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("cf_local_tokens");
    if (!raw) return null;
    const tokens = JSON.parse(raw);
    return tokens[token] || null;
  } catch {
    return null;
  }
}

export function markLocalInviteTokenUsed(token: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("cf_local_tokens");
    if (!raw) return;
    const tokens = JSON.parse(raw);
    if (tokens[token]) {
      tokens[token].used = true;
      localStorage.setItem("cf_local_tokens", JSON.stringify(tokens));
    }
  } catch {
    // ignore
  }
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<{
  success: boolean;
  message: string;
  emailId: string;
  setupUrl: string;
  expiresInHours: number;
  mailtoUrl: string;
  gmailUrl: string;
  subject: string;
  textBody: string;
}> {
  const expiresInHours = params.expiresInHours ?? 24;
  const subject = generateEmailSubject(params);
  const textBody = generateInvitationEmailText(params);
  const mailtoUrl = generateMailtoUrl(params);
  const gmailUrl = generateGmailComposeUrl(params);

  const record: DispatchedEmailRecord = {
    ...params,
    expiresInHours,
    id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    sentAt: new Date().toISOString(),
  };

  memoryDispatchedEmails.unshift(record);

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("cf_sent_invitations");
      const existing = raw ? JSON.parse(raw) : [];
      localStorage.setItem("cf_sent_invitations", JSON.stringify([record, ...existing].slice(0, 50)));
    } catch {
      // ignore storage error
    }
  }

  console.log(`[Email Dispatch] Invitation email prepared for ${params.recipientEmail} (${params.clinicName}).`);
  console.log(`[Email Setup Link] Valid for ${expiresInHours} hours: ${params.setupUrl}`);

  return {
    success: true,
    emailId: record.id,
    setupUrl: params.setupUrl,
    expiresInHours,
    mailtoUrl,
    gmailUrl,
    subject,
    textBody,
    message: `Invitation email prepared for ${params.recipientEmail}. Secure setup link valid for ${expiresInHours} hours.`,
  };
}

export function getDispatchedInvitationEmails(): DispatchedEmailRecord[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("cf_sent_invitations");
      if (raw) {
        const stored = JSON.parse(raw);
        if (Array.isArray(stored) && stored.length > 0) return stored;
      }
    } catch {
      // ignore
    }
  }
  return memoryDispatchedEmails;
}
