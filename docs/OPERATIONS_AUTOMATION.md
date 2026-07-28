# Operations Automation

This repository provides free-tier-safe operational checks. They use synthetic
data and public health endpoints only. They are safeguards, not a replacement
for the hospital's production agreements, independent assessment, or incident
team.

## Availability Monitoring

`.github/workflows/production-smoke.yml` runs every 30 minutes and checks:

- application and login availability;
- required browser security headers;
- response-time budgets;
- Supabase Auth health; and
- the staff invitation function's CORS boundary.

A failed workflow is the initial alert. Repository administrators must enable
GitHub Actions failure notifications and assign an on-call owner before go-live.
No patient identifiers, response bodies, tokens, or credentials are recorded.

## Bounded Load Check

`.github/workflows/performance.yml` runs weekly and can be started manually. It
sends 80 requests with concurrency 4 to `/healthz` and `/login`, then rejects
an error rate above 1% or a p95 response time above 3 seconds.

This small production probe detects obvious regressions without creating
material free-tier cost. It is not the hospital capacity test. Before go-live,
replace its limits with a signed volume model and run an approved staging soak
and failure test.

The first baseline on 2026-07-29 did not pass: repeated 10-second timeouts were
observed from both `/login` and `/healthz`, including at concurrency 1. The
normal single-request smoke check remained healthy. This blocks any claim that
the current free Vercel deployment has hospital capacity; the scheduled test is
intentionally allowed to fail until the hosting path meets its budget.

The repository now enables Vercel Fluid Compute and places the single Hobby
function region in Mumbai (`bom1`), next to the Supabase Mumbai database. The
baseline must be rerun after this configuration reaches production.

## Synthetic Backup Restore Drill

`.github/workflows/backup-restore-drill.yml` runs weekly against a disposable
local Supabase stack. It:

1. applies every migration and the synthetic seed;
2. dumps only the synthetic `public` schema data;
3. resets the database without the seed;
4. restores the dump;
5. compares a known record count; and
6. reruns the database security tests.

The authorization catalog tables are excluded from the data dump because
migrations recreate that immutable bootstrap data before restoration.

The temporary dump is deleted and is never uploaded as an artifact. This proves
that the repository's schema and backup procedure remain restorable. It does
not back up production data.

## Production Supabase Deployment

The Supabase GitHub integration connects project `ClinicFlow` to
`Rajat77a/clinicflow-platform`. Production deployment is enabled for `main`
with the repository root as its working directory.

The existing production schema was originally applied through the SQL editor.
On 2026-07-29, its migration history was reconciled to all 13 committed
migrations and verified with no incomplete records. Supabase now applies new
committed migrations and Edge Functions after a merge to `main`.

Keep database changes in forward-only migration files. Do not apply a migration
manually unless incident handling requires it; when that happens, reconcile the
history before the next merge.

## External Release Blockers

The following cannot be made production-grade from repository code alone:

- SMTP requires a hospital-approved sending domain, provider account, DNS
  records, credentials, and delivery acceptance evidence.
- Recoverable production data requires provider backups or encrypted backup
  storage, retention policy, access control, and a witnessed isolated restore.
- Alerting requires named responders, notification routes, escalation timing,
  and a tested incident process.
