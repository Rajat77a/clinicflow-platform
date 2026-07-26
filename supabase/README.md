# ClinicFlow Supabase backend

This directory is the versioned backend for one hospital installation. Each
hospital must receive a dedicated Supabase project (or a compatible dedicated
PostgreSQL deployment), its own secrets, storage, backups, and domain.

## Security boundaries

- The browser receives only the project URL and publishable key.
- The service-role key is restricted to Edge Functions and deployment tooling.
- Row Level Security is enabled on every exposed table.
- Clinical access is limited by hospital membership and assigned care teams.
- Signed prescriptions and audit events are append-only.
- Storage is private and object paths begin with the hospital UUID.
- Staff accounts are invited through `invite-staff`; public signup is disabled.
- Audit metadata must never contain diagnoses, notes, document contents, or
  other protected health information.

## Deployment order

1. Create a dedicated project in the hospital's required data region.
2. Link the CLI with `supabase link --project-ref <project-ref>`.
3. Review migrations, then run `supabase db push`.
   Run `supabase test db` before promoting the deployment.
4. Create the first hospital and administrator using an audited deployment
   runbook. Do not expose a public bootstrap endpoint.
5. Set `CLINICFLOW_ALLOWED_ORIGIN` for Edge Functions and deploy
   `invite-staff`.
6. Configure Auth redirect URLs, SMTP, CAPTCHA, TOTP MFA, session limits,
   backups, recovery testing, monitoring, and network restrictions.
7. Put only `VITE_SUPABASE_URL` and the publishable key in the frontend.

The free plan is suitable for development only. A real hospital rollout also
requires legal/compliance review, a data-processing agreement, tested restore
procedures, incident response, retention policy, and an independent security
assessment.
