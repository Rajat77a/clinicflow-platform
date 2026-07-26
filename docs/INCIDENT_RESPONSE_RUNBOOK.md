# Incident Response Runbook

## Severity

- `SEV-1`: Confirmed or suspected patient-data exposure, destructive compromise,
  widespread outage, or loss of clinical availability.
- `SEV-2`: Material degradation, repeated authorization failures, or contained
  security event without confirmed exposure.
- `SEV-3`: Limited defect with a safe workaround and no sensitive-data impact.

## Immediate Actions

1. Name an incident commander and start a time-stamped incident record.
2. Protect patients first. Give the hospital a safe clinical continuity path.
3. Contain access using the smallest effective change: disable an account,
   revoke a session, rotate a secret, block a route, or isolate the deployment.
4. Preserve database audit events, provider logs, deployment identifiers,
   request IDs, and relevant configuration before changing evidence.
5. Do not place patient data, credentials, or raw clinical records in chat,
   email, screenshots, or public issue trackers.
6. Notify the hospital security/privacy contacts and follow the approved legal
   notification process. Do not guess notification deadlines.

## Investigation and Recovery

- Build a timeline using immutable sources and record every operator action.
- Determine affected identities, records, environments, and time range.
- Rotate exposed credentials and invalidate affected sessions.
- Patch through the normal reviewed release process unless emergency access is
  formally declared and documented.
- Recover from a validated restore when integrity is uncertain.
- Verify every role boundary and monitor closely after restoration.

## Closure

Close only after containment, recovery, hospital communication, evidence
retention, root-cause review, and tracked corrective actions. Run a blameless
post-incident review and test the prevention and detection changes.
