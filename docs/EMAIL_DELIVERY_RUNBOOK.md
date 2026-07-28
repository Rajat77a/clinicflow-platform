# Email Delivery Runbook

ClinicFlow uses Supabase Auth invitation and recovery links. It must not email,
store, log, or display temporary passwords. Each recipient proves control of
their mailbox and chooses a password that satisfies the application policy.

## Current Live State

Verified on 2026-07-29:

- The production site URL is `https://clinicflow-platform.vercel.app`.
- The allowed Auth redirect is
  `https://clinicflow-platform.vercel.app/login`.
- Password, email, phone, sign-in method, and MFA security notifications are
  enabled.
- Custom SMTP is enabled through the personal Gmail account
  `rajatkrishnan321@gmail.com`. Supabase warns that this provider is designed
  for personal rather than transactional email and that deliverability may be
  affected.
- The production password-recovery endpoint accepted a synthetic reset request
  for that address. Mailbox receipt, one-time-link behavior, and provider
  delivery evidence have not yet been independently confirmed.

This is sufficient only for development testing. Invitations and password
recovery remain a release blocker for hospital use even when the application
and Edge Function behave correctly.

## Required Configuration

1. Obtain a hospital-approved sending domain and transactional email provider.
2. Verify the sender domain with the provider.
3. Publish SPF and DKIM records, then publish a DMARC policy and reporting
   address approved by the hospital.
4. In Supabase Auth > Emails > SMTP Settings, enter the provider host, port,
   username, password, sender address, and sender name.
5. Keep SMTP credentials only in Supabase. Never place them in Git, Vercel
   browser variables, screenshots, tickets, or chat.
6. Disable provider click/open tracking for authentication messages because
   link rewriting can invalidate or expose one-time links.
7. Set email rate limits from the hospital's expected invitation and recovery
   volume, with provider limits and abuse protection considered together.

## Acceptance Test

Use accounts created solely for acceptance testing. Do not use patient data.

1. Invite one clinic administrator, doctor, and receptionist.
2. Confirm each message arrives once, has the expected sender, uses HTTPS, and
   returns only to the production login URL.
3. Complete password setup and verify that the invitation cannot be reused.
4. Request password recovery, set a new password, and verify the old password
   no longer works.
5. Change password, email, and MFA enrollment and confirm the corresponding
   security-alert messages arrive.
6. Confirm failures produce a safe user message without provider details,
   credentials, tokens, or patient information.
7. Review Supabase Auth logs and the provider delivery log, then delete all
   acceptance accounts and messages.

Record the date, tester, provider, sender domain, message IDs, and outcome in
the hospital's release evidence. Do not record link tokens or message bodies.

## Failure Handling

- A provider rejection or exhausted email quota must block staff onboarding;
  staff must never be created with a known shared password as a workaround.
- Repeated unexpected delivery failures require an incident review of Supabase
  Auth logs, provider status, DNS records, quotas, bounces, and suppressions.
- Rotate SMTP credentials immediately after suspected exposure and repeat this
  acceptance test.

References:

- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-email-templates
