import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, Loader2, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

function qrCodeSource(qrCode: string) {
  if (qrCode.startsWith("data:")) return qrCode;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
}

async function recordSecurityEvent(action: "mfa.enrolled" | "mfa.verified") {
  const { error } = await getSupabaseBrowserClient().rpc("record_security_event", {
    p_action: action,
  });
  if (error) {
    // Authentication succeeded even if the secondary audit write is temporarily unavailable.
    console.error("Unable to record the security event");
  }
}

export function PrivilegedMfaGate({ children }: { children: ReactNode }) {
  const { user, isDemoMode, logout } = useAuth();
  const [checking, setChecking] = useState(true);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const requiresMfa =
    !isDemoMode && (user?.role === "super_admin" || user?.role === "clinic_admin");

  const inspectMfa = useCallback(async () => {
    if (!requiresMfa) {
      setChecking(false);
      return;
    }

    setVerifiedUserId(null);
    setChecking(true);
    setError("");
    const client = getSupabaseBrowserClient();
    const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] =
      await Promise.all([
        client.auth.mfa.getAuthenticatorAssuranceLevel(),
        client.auth.mfa.listFactors(),
      ]);

    if (assuranceError || factorsError) {
      setError("Security verification is unavailable. Try again before accessing hospital data.");
      setChecking(false);
      return;
    }

    if (assurance.currentLevel === "aal2") {
      setVerifiedUserId(user?.userId ?? null);
    } else {
      setVerifiedFactorId(factors.totp[0]?.id ?? null);
    }
    setChecking(false);
  }, [requiresMfa, user?.userId]);

  useEffect(() => {
    void inspectMfa();
  }, [inspectMfa]);

  async function beginEnrollment() {
    setBusy(true);
    setError("");
    setCode("");
    const client = getSupabaseBrowserClient();

    try {
      const { data: factors, error: listError } = await client.auth.mfa.listFactors();
      if (listError) throw listError;

      for (const factor of factors.all) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          const { error: removeError } = await client.auth.mfa.unenroll({ factorId: factor.id });
          if (removeError) throw removeError;
        }
      }

      const { data, error: enrollError } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ClinicFlow administrator",
        issuer: "ClinicFlow",
      });
      if (enrollError) throw enrollError;

      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch {
      setError("Authenticator setup could not start. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const factorId = enrollment?.factorId ?? verifiedFactorId;
    if (!factorId || code.length !== 6) return;

    setBusy(true);
    setError("");
    try {
      const { error: verifyError } =
        await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;

      await recordSecurityEvent(enrollment ? "mfa.enrolled" : "mfa.verified");
      setVerifiedUserId(user?.userId ?? null);
      setCode("");
    } catch {
      setCode("");
      setError("That code was not accepted. Enter the current code from your authenticator app.");
    } finally {
      setBusy(false);
    }
  }

  if (!requiresMfa || verifiedUserId === user?.userId) return children;

  const hasVerifiedFactor = Boolean(verifiedFactorId) && !enrollment;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <section
        className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-sm sm:p-8"
        aria-labelledby="mfa-title"
      >
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Administrator security</p>
            <h1 id="mfa-title" className="mt-1 text-2xl font-semibold">
              Two-step verification required
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Verify your identity before ClinicFlow loads hospital records or administrative tools.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <KeyRound className="h-4 w-4" />
            <AlertTitle>Verification blocked</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {checking ? (
          <div className="mt-8 flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking account security
          </div>
        ) : enrollment ? (
          <form className="mt-7" onSubmit={verifyCode}>
            <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
              <div className="grid place-items-center rounded-lg border bg-white p-3">
                <img
                  src={qrCodeSource(enrollment.qrCode)}
                  alt="QR code for authenticator enrollment"
                  className="h-40 w-40"
                />
              </div>
              <div>
                <h2 className="font-semibold">Scan with an authenticator app</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Add this account in Google Authenticator, Microsoft Authenticator, 1Password, or
                  another TOTP app.
                </p>
                <label className="mt-4 block text-xs font-medium text-muted-foreground">
                  Manual setup key
                  <input
                    readOnly
                    type="password"
                    value={enrollment.secret}
                    aria-label="Manual authenticator setup key"
                    className="mt-1 h-9 w-full rounded-md border bg-muted/40 px-3 font-mono text-xs"
                  />
                </label>
              </div>
            </div>
            <VerificationCode code={code} setCode={setCode} busy={busy} />
          </form>
        ) : hasVerifiedFactor ? (
          <form className="mt-7" onSubmit={verifyCode}>
            <div className="flex gap-3 rounded-lg border bg-muted/30 p-4">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold">Open your authenticator app</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Enter the current six-digit code for your ClinicFlow administrator account.
                </p>
              </div>
            </div>
            <VerificationCode code={code} setCode={setCode} busy={busy} />
          </form>
        ) : (
          <div className="mt-7">
            <div className="flex gap-3 rounded-lg border bg-muted/30 p-4">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold">Set up an authenticator</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  A rotating code protects privileged hospital access even if a password is exposed.
                </p>
              </div>
            </div>
            <Button className="mt-5 w-full" onClick={beginEnrollment} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Set up authenticator
            </Button>
          </div>
        )}

        <div className="mt-6 border-t pt-4">
          <Button variant="ghost" className="w-full" onClick={() => void logout()} disabled={busy}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </section>
    </main>
  );
}

function VerificationCode({
  code,
  setCode,
  busy,
}: {
  code: string;
  setCode: (value: string) => void;
  busy: boolean;
}) {
  return (
    <div className="mt-6">
      <label className="text-sm font-medium" htmlFor="administrator-mfa-code">
        Six-digit verification code
      </label>
      <InputOTP
        id="administrator-mfa-code"
        maxLength={6}
        value={code}
        onChange={setCode}
        disabled={busy}
        inputMode="numeric"
        pattern="[0-9]*"
        containerClassName="mt-2"
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, index) => (
            <InputOTPSlot key={index} index={index} className="h-11 w-11 text-base" />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <Button type="submit" className="mt-5 w-full" disabled={busy || code.length !== 6}>
        {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        Verify and continue
      </Button>
    </div>
  );
}
