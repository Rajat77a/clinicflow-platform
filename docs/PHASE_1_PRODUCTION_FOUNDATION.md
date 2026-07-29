# Phase 1 Production Foundation

Phase 1 strengthens the existing application without changing its four-role
data model or enabling unfinished modules. It is an additive foundation, not a
hospital go-live approval.

## Delivered Controls

- Safe backend error mapping prevents raw database and provider messages from
  reaching users.
- Request IDs cross the application server, browser invite request, and staff
  invitation Edge Function. Operational logs contain request metadata, never
  patient payloads.
- `/healthz` reports process health. `/readyz` reports only whether required
  public runtime configuration exists and never exposes dependency values.
- Production hides external patient-data sharing, fake document actions, and
  signed-prescription editing. Demo mode retains synthetic demonstrations.
- Private document quarantine metadata, strict 25 MB PDF/JPEG/PNG limits,
  immutable scan evidence, and worker-only scan-result functions are defined.
- Durable `pgmq` queues are defined for document scanning, notification
  delivery, and security alerts. Browser roles cannot read or operate queues.
- CI scans tracked files for common secrets and builds a portable container.
- Docker and OpenTofu files define a provider-neutral deployment path without
  changing the current Vercel deployment.

## Queue Contract

Only a trusted server or Edge Function using the service role may call:

- `enqueue_system_job(queue_name, payload, delay_seconds)`
- `read_system_jobs(queue_name, visibility_seconds, quantity)`
- `archive_system_job(queue_name, message_id)`

Workers must use bounded retries, archive only completed messages, emit
payload-free metrics, and place terminal failures in an approved incident
workflow. Never log queue payloads because they may contain record identifiers.

## Document Contract

Browser uploads remain disabled. The future upload service must:

1. authorize the actor and patient relationship;
2. upload to `hospital-document-quarantine` using the validated object path;
3. call `register_document_quarantine` with an idempotency key;
4. scan the object with an approved malware scanner;
5. copy a clean object to `hospital-documents`;
6. call `record_document_scan_result`; and
7. issue a short-lived download only after a fresh authorization check.

Rejected or unscanned objects must never be moved to the clean bucket.

## Release And Rollback

This branch must pass unit, type, lint, build, browser, database replay,
database security, container-build, and secret-scan checks before review.
Migrations are forward-only. If a migration causes a problem after deployment,
stop workers and add a corrective migration; never edit an applied migration.

Do not enable document permissions, external patient sharing, or production
deployment from this phase without a separate reviewed approval.
