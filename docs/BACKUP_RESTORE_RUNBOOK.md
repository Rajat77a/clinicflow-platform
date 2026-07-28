# Backup and Restore Runbook

## Objectives

The hospital and ClinicFlow must agree on recovery point and recovery time
objectives before go-live. Those targets determine the database plan, backup
frequency, retention, replica strategy, and staffing.

## Required Setup

- Automated database backups and point-in-time recovery on the production plan.
- Separately protected backups for private object storage.
- Encryption in transit and at rest with access limited to recovery operators.
- Backup retention aligned with the hospital's approved retention schedule.
- Alerts for missed backups, failed jobs, and storage capacity.
- A recovery environment isolated from production.

## Repository Drill

The weekly `Backup restore drill` GitHub Action validates migrations, a
synthetic data dump, restoration, and database security tests without handling
production data. Its successful result is engineering evidence only. It does
not satisfy the production backup gate because Supabase Free does not provide
downloadable automatic backups or point-in-time recovery.

## Restore Drill

1. Open an incident/change record and record the chosen recovery point.
2. Confirm the restore destination is isolated and contains no active users.
3. Restore the database and private objects using provider-supported tooling.
4. Rotate or isolate credentials before application access.
5. Run schema migrations only if the restored version requires them.
6. Verify authentication, memberships, RLS, record counts, referential
   integrity, audit continuity, and document hashes.
7. Test one allowed and one denied workflow for each of the four roles.
8. Record achieved recovery time, recovered timestamp, data loss window,
   anomalies, and operator names.
9. Destroy the drill environment according to the approved retention process.
10. Obtain sign-off and track every corrective action to closure.

## Production Recovery

Do not overwrite the damaged production database in place. Restore to an
isolated target, investigate and validate it, then perform a controlled cutover.
Preserve affected systems and logs when security compromise is possible.

A restore is complete only after application smoke tests, role-boundary tests,
audit verification, monitoring verification, and hospital approval.
