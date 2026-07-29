# Operations Automation

This repository provides free-tier-safe operational checks. They use synthetic
data and public health endpoints only. They are safeguards, not a replacement
for the hospital's production agreements, independent assessment, or incident
team.

## Availability Monitoring

`.github/workflows/production-smoke.yml` runs every 30 minutes and checks:

- application and login availability;
- application readiness without disclosing configuration values;
- required browser security headers;
- response-time budgets;
- Supabase Auth health; and
- the staff invitation function's CORS boundary.

A failed workflow is the initial alert. Repository administrators must enable
GitHub Actions failure notifications and assign an on-call owner before go-live.
No patient identifiers, response bodies, tokens, or credentials are recorded.

Application and staff-invitation responses carry `X-Request-ID`. Server logs
use that identifier with method, path, status, and duration only. Never add
request bodies, patient names, contact details, prescriptions, or tokens to
operational logs.

## Durable Work Queues

The database defines service-role-only `pgmq` queues for document scanning,
notification delivery, and security alerts. Queue contents are inaccessible to
browser roles. `queue_operational_metrics()` exposes payload-free counts to
authorized audit users and workers.

Workers are not deployed in Phase 1. Until the corresponding worker and alert
route are tested, no user-facing workflow may depend on these queues.

## Portable Runtime

`Dockerfile` builds a non-root production image and `compose.yaml` runs it with
a read-only filesystem, no-new-privileges, and a `/readyz` health check.
`infra/opentofu` validates the non-secret environment contract. These files do
not alter Vercel or provision paid resources.

## Bounded Load Check

`.github/workflows/performance.yml` runs weekly and can be started manually. It
sends 80 requests with concurrency 4 to `/healthz` and `/login`, then rejects
an error rate above 1% or a p95 response time above 3 seconds.

This small production probe detects obvious regressions without creating
material free-tier cost. It is not the hospital capacity test. Before go-live,
replace its limits with a signed volume model and run an approved staging soak
and failure test.

The first baseline on 2026-07-29 exposed repeated 10-second timeouts from both
`/login` and `/healthz`. The repository then enabled Vercel Fluid Compute and
placed the single Hobby function region in Mumbai (`bom1`), next to the
Supabase Mumbai database.

After production deployment, the same 80-request, concurrency-4 probe completed
with zero failures: p50 273 ms, p95 658 ms, and maximum 1001 ms. This is a useful
regression baseline, but it is not evidence of full hospital capacity.

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
