# Hospital Production Readiness

ClinicFlow is deployed as a dedicated installation for one hospital. A new
hospital receives its own infrastructure, secrets, database, storage, domain,
and release process. Hospital data must never be copied between installations.

## Current Status

This repository is in controlled pre-production. It is not approved for real
patient or hospital data until every critical gate below has an owner, evidence,
and written approval from the hospital and ClinicFlow.

Implemented foundations:

- Supabase authentication with public registration disabled.
- TOTP enrollment and verification support is retained, but mandatory MFA is
  temporarily disabled during development. Hospital use remains blocked until
  privileged-role MFA and recovery are re-enabled and acceptance-tested.
- Strong password policy, current-password verification, other-session
  revocation, and a 30-minute inactivity timeout.
- Dedicated hospital membership and four roles: super admin, clinic admin,
  doctor, and receptionist.
- Database row-level security and patient care-team scoping.
- Server-side transactional commands with idempotency protection.
- Append-only database audit events for core record changes.
- Direct browser role assignment blocked.
- Browser document uploads disabled until scanning is available.
- A private document quarantine schema, strict file limits, and worker-only
  scan registration exist; uploads remain disabled until a scanner is connected.
- Durable browser-inaccessible queues exist for document scanning,
  notification delivery, and security alerts.
- Request-correlated safe errors, payload-free operational logging, and separate
  liveness/readiness endpoints are implemented.
- Placeholder and sample-data modules hidden and blocked in production.
- CI runs unit tests, four-role browser workflows, typecheck, lint, and the
  production build before merge.
- Database CI replays every migration on a clean Supabase stack, runs the
  security foundation suite, and rejects database lint errors.
- Production availability and dependency health checks run every 30 minutes
  with response-time budgets.
- A bounded weekly production load probe detects basic availability and latency
  regressions.
- A weekly synthetic backup/restore drill validates schema recovery and reruns
  database security tests without retaining a data artifact.
- Supabase production deployment is connected to the GitHub `main` branch, and
  all 13 existing migration-history records are reconciled.

## Critical Release Gates

| Gate                                                 | Required evidence                                                                                                                    | Owner      | Status  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------- |
| Hospital requirements and clinical workflow sign-off | Signed workflow and role matrix                                                                                                      | Unassigned | Blocked |
| Privacy and regulatory assessment                    | Counsel-approved obligations, consent, retention, and data residency                                                                 | Unassigned | Blocked |
| Infrastructure agreements                            | Approved paid plans and required provider contracts                                                                                  | Unassigned | Blocked |
| Production identity                                  | Complete administrator MFA enrollment, recovery, offboarding, and emergency access test                                              | Unassigned | Blocked |
| Email delivery                                       | Hospital-approved SMTP, SPF, DKIM, DMARC, and invite/reset test per `docs/EMAIL_DELIVERY_RUNBOOK.md`                                 | Unassigned | Blocked |
| Backup and recovery                                  | Synthetic restore automation exists; production backups plus witnessed restore drill remain                                          | Unassigned | Blocked |
| Monitoring and alerting                              | Correlated operational logs and availability baseline exist; auth abuse, queue, database, responder routing, and error alerts remain | Unassigned | Partial |
| File security                                        | Quarantine schema and allowlist exist; scanner worker, object promotion, retention, and patient-scoped download remain               | Unassigned | Partial |
| Security assessment                                  | Independent penetration test with critical/high findings closed                                                                      | Unassigned | Blocked |
| Load and failure testing                             | Bounded weekly probe exists; hospital volume model, soak test, failover test, and capacity report remain                             | Unassigned | Partial |
| Four-portal acceptance                               | Automated demo workflows exist; production-backed tests and denied cross-role/cross-patient cases remain                             | Unassigned | Blocked |
| Incident readiness                                   | Contacts, communications, evidence preservation, and tabletop exercise                                                               | Unassigned | Blocked |
| Go-live approval                                     | Signed hospital and ClinicFlow release record                                                                                        | Unassigned | Blocked |

## Release Rules

1. Never use production patient data in local development, screenshots, logs,
   support tickets, analytics, or preview deployments.
2. Changes reach production only through a reviewed pull request with green CI,
   a successful preview, migration review, and rollback notes.
3. Database migrations are forward-only. Never rewrite a migration already
   applied to a shared environment.
4. Service-role keys, database passwords, SMTP credentials, and signing secrets
   belong only in the provider secret store. They must never enter Git or a
   browser bundle.
5. Production access is individual, least-privilege, MFA-protected, reviewed
   regularly, and removed immediately during offboarding.
6. A failed critical gate blocks go-live. Schedule pressure is not an exception.

## Module Policy

Production navigation exposes only database-backed workflows. A disabled module
may be enabled only after its schema, authorization, audit events, recovery
behavior, integration tests, and operational owner are complete.

The file module additionally requires content-type verification, malware
scanning, quarantine, immutable hashes, short-lived downloads, and patient
authorization at download time.

Phase 1 implementation details and worker boundaries are documented in
`docs/PHASE_1_PRODUCTION_FOUNDATION.md`.
