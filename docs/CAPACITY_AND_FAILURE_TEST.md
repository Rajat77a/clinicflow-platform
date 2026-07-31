# Capacity and Failure Test

Hospital capacity evidence must use an approved staging installation containing
synthetic data only. Never run a soak or failure test against the free production
project or a system serving patients.

## Required Inputs

- expected peak concurrent users by role;
- hourly patient registrations, appointments, prescriptions, invoices, and files;
- largest expected document and daily document volume;
- acceptable p95/p99 latency and error rate for each clinical workflow;
- recovery-time and recovery-point objectives; and
- provider quotas, connection limits, storage growth, and cost limits.

## Test Sequence

1. Establish a quiet baseline and record provider configuration.
2. Ramp from 10% to 100% of expected peak traffic with synthetic accounts.
3. Hold the expected peak for at least one hour.
4. Run the agreed soak duration and inspect database, queue, memory, and error trends.
5. Exercise dependency timeout, worker failure, database recovery, and deployment rollback.
6. Confirm denied cross-role and cross-patient requests remain denied under load.
7. Record throughput, p50/p95/p99 latency, errors, saturation, recovery time, and cost.
8. Close every unsafe finding and repeat the affected stage before approval.

The repository probe supports a bounded duration mode for an approved target:

```powershell
$env:BASE_URL='https://approved-staging.example'
$env:LOAD_DURATION_SECONDS='300'
$env:LOAD_CONCURRENCY='8'
$env:LOAD_P95_MS='2000'
npm run load:smoke
```

This public-endpoint probe is only the first layer. Authenticated workflow load
requires dedicated synthetic users and a hospital-approved test plan.
