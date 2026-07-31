# Privileged MFA Recovery

There is no self-service bypass for administrator MFA. Recovery must be rare,
time-limited, independently approved, and fully recorded.

## Preconditions

- The hospital names primary and backup identity-recovery operators.
- At least two authorized people approve privileged recovery.
- The requester is verified using the hospital's approved out-of-band process.
- The incident/change record contains the account, reason, approvers, start time,
  expected completion time, and affected installation without recording secrets.

## Recovery

1. Revoke the affected user's active sessions.
2. Remove only the lost TOTP factor through the protected Supabase administrator
   interface; never change database roles or weaken `private.has_permission`.
3. Require the user to sign in, enroll a new factor, and reach AAL2 immediately.
4. Verify the `mfa.enrolled` audit event and revoke every other session again.
5. Review recent authentication, audit, deployment, and email events for compromise.
6. Close access used by the recovery operators and record completion evidence.

If identity cannot be verified or compromise is suspected, keep the account
disabled and activate the hospital's approved emergency-access process. Never
issue a shared password, disable MFA globally, or edit an applied migration.
