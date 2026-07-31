# Independent Penetration Test Scope

The final assessment must be performed by an independent qualified tester on a
dedicated staging installation containing synthetic data. Repository scans and
developer testing do not replace this assessment.

## In Scope

- authentication, invitation, recovery, MFA, session expiry, and offboarding;
- super administrator, clinic administrator, doctor, and receptionist portals;
- horizontal and vertical authorization, including cross-patient access;
- Supabase Data API, Realtime, Storage, database functions, and Edge Functions;
- document quarantine, malware rejection, signed downloads, and object expiry;
- input validation, injection, request smuggling, CORS, CSRF, XSS, and SSRF;
- rate limits, account enumeration, credential stuffing, and invitation abuse;
- audit integrity, sensitive-data exposure, caching, logs, errors, and exports;
- dependency, container, CI/CD, secret-management, and deployment configuration;
- backup access, recovery permissions, monitoring, and incident evidence.

## Rules

1. Use only written-approved targets, dates, source addresses, and test accounts.
2. Never use real patient data, destructive payloads, denial-of-service traffic,
   social engineering, or third-party infrastructure without written approval.
3. Stop immediately on suspected real-data exposure or material availability risk.
4. Encrypt evidence, minimize copied data, and delete it under the agreed retention policy.
5. Report findings with reproducible evidence, affected role/record boundary,
   severity, likelihood, impact, and remediation guidance.

## Exit Criteria

- every critical and high finding is fixed and independently retested;
- medium findings have an approved owner and deadline;
- no test account, token, temporary object, or privileged access remains;
- the tester signs the final report and ClinicFlow records the tested commit,
  deployment, database migration set, and remediation evidence.
