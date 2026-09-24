import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, Building2, CheckCircle2, Clock, Eye, EyeOff, Mail, MapPin, Phone, ShieldCheck, Stethoscope, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";
import { getLocalInviteToken, markLocalInviteTokenUsed } from "@/lib/email-service";
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from "@/lib/password-policy";
import { saveRegisteredAccount } from "@/lib/account-store";
import type { Role } from "@/lib/auth";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

interface TokenInfo {
  email: string;
  full_name: string;
  phone: string;
  role_code: string;
  hospital_id: string;
  facility_id: string | null;
  department_id: string | null;
  clinic_name: string | null;
  clinic_email: string | null;
  clinic_phone: string | null;
  clinic_address: string | null;
  clinic_city?: string | null;
  specialty: string | null;
  shift: string | null;
  gender: string | null;
  qualification: string | null;
  medical_registration_number: string | null;
  experience_years: number | null;
  consultation_fee: number | null;
  working_hours: string | null;
  administrative_notes: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  clinic_admin: "Clinical Admin",
  doctor: "Doctor",
  receptionist: "Receptionist",
};

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  super_admin: ShieldCheck,
  clinic_admin: Building2,
  doctor: Stethoscope,
  receptionist: UserCog,
};

function SetupPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ title: string; message: string } | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let rawToken = params.get("token") || params.get("t");
    if (!rawToken && typeof window !== "undefined" && window.location.hash) {
      const hashStr = window.location.hash;
      const qIdx = hashStr.indexOf("?");
      if (qIdx !== -1) {
        const hashParams = new URLSearchParams(hashStr.slice(qIdx));
        rawToken = hashParams.get("token") || hashParams.get("t");
      }
    }

    let t = rawToken ? decodeURIComponent(rawToken).trim() : "";
    // Clean accidental wrapping quotes, angle brackets, or trailing punctuation from email clients
    t = t.replace(/^[<"']|[>"']$/g, "").replace(/[.,;]+$/, "").trim();
    if (t.length === 64 && /^[0-9a-fA-F]{64}$/.test(t)) {
      t = t.toLowerCase();
    }

    // Safe development logging: log existence and token length only, NEVER the full token
    const tokenExists = Boolean(t);
    const tokenLength = t.length;
    console.log(`[InviteSetup] URL check: token exists = ${tokenExists}, token length = ${tokenLength}`);

    if (!t) {
      setErrorInfo({
        title: "Link Invalid",
        message: "No invitation token was provided.",
      });
      setLoading(false);
      return;
    }
    setToken(t);

    const tryLocalToken = () => {
      const local = getLocalInviteToken(t);
      if (local) {
        if (local.used) {
          setErrorInfo({
            title: "Invitation Already Used",
            message: "This invitation link has already been used.",
          });
          return true;
        }
        if (new Date(local.expiresAt) <= new Date()) {
          setErrorInfo({
            title: "Invitation Expired",
            message: "This invitation link has expired.",
          });
          return true;
        }
        setTokenInfo({
          email: local.email,
          full_name: local.name,
          phone: local.phone || "",
          role_code: local.roleCode || "clinic_admin",
          hospital_id: local.clinicId,
          facility_id: null,
          department_id: null,
          clinic_name: local.clinicName,
          clinic_email: local.clinicEmail || null,
          clinic_phone: local.clinicPhone || null,
          clinic_address: local.clinicAddress || null,
          clinic_city: local.clinicCity || null,
          specialty: null,
          shift: null,
          gender: null,
          qualification: null,
          medical_registration_number: null,
          experience_years: null,
          consultation_fee: null,
          working_hours: null,
          administrative_notes: null,
        });
        return true;
      }
      return false;
    };

    if (!supabaseConfig.configured) {
      if (!tryLocalToken()) {
        setErrorInfo({
          title: "Link Invalid",
          message: "This invitation link is invalid.",
        });
      }
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      console.log(`[InviteSetup] Calling validate_invite_token RPC (token length = ${t.length})`);
      supabase.rpc("validate_invite_token", { p_token: t })
        .then(({ data, error: rpcError }: { data: unknown; error: { message: string } | null }) => {
          if (rpcError) {
            console.error("[InviteSetup] validate_invite_token RPC error:", rpcError.message);
            if (supabaseConfig.demoMode && tryLocalToken()) return;
            setErrorInfo({
              title: "Unable to Validate Invitation",
              message: "Unable to validate this invitation. Please try again.",
            });
            return;
          }

          const row = Array.isArray(data)
            ? (data[0] as Record<string, unknown> | undefined)
            : (data && typeof data === "object" ? (data as Record<string, unknown>) : null);

          if (!row) {
            console.warn("[InviteSetup] validate_invite_token returned empty data");
            if (supabaseConfig.demoMode && tryLocalToken()) return;
            setErrorInfo({
              title: "Link Invalid",
              message: "This invitation link is invalid.",
            });
            return;
          }

          const rawStatus = String(row.status ?? row.p_status ?? "invalid").trim().toLowerCase();
          console.log(`[InviteSetup] validate_invite_token returned status = ${rawStatus}`);

          if (row.status === "expired" || rawStatus === "expired") {
            setErrorInfo({
              title: "Invitation Expired",
              message: "This invitation link has expired.",
            });
          } else if (row.status === "used" || rawStatus === "used") {
            setErrorInfo({
              title: "Invitation Already Used",
              message: "This invitation link has already been used.",
            });
          } else if (row.status === "clinic_deleted" || rawStatus === "clinic_deleted") {
            setErrorInfo({
              title: "Clinic Inactive",
              message: "This clinic invitation is no longer active.",
            });
          } else if (row.status === "valid" || rawStatus === "valid") {
            const email = String(row.p_email ?? row.email ?? "").trim();
            if (!email) {
              if (supabaseConfig.demoMode && tryLocalToken()) return;
              setErrorInfo({
                title: "Link Invalid",
                message: "This invitation link is invalid.",
              });
              return;
            }

            setTokenInfo({
              email,
              full_name: String(row.p_full_name ?? row.full_name ?? ""),
              phone: String(row.p_phone ?? row.phone ?? ""),
              role_code: String(row.p_role_code ?? row.role_code ?? "clinic_admin"),
              hospital_id: String(row.p_hospital_id ?? row.hospital_id ?? ""),
              facility_id: (row.p_facility_id ?? row.facility_id ?? null) as string | null,
              department_id: (row.p_department_id ?? row.department_id ?? null) as string | null,
              clinic_name: (row.p_clinic_name ?? row.clinic_name ?? null) as string | null,
              clinic_email: (row.p_clinic_email ?? row.clinic_email ?? null) as string | null,
              clinic_phone: (row.p_clinic_phone ?? row.clinic_phone ?? null) as string | null,
              clinic_address: (row.p_clinic_address ?? row.clinic_address ?? null) as string | null,
              clinic_city: (row.p_clinic_city ?? row.clinic_city ?? null) as string | null,
              specialty: (row.p_specialty ?? row.specialty ?? null) as string | null,
              shift: (row.p_shift ?? row.shift ?? null) as string | null,
              gender: (row.p_gender ?? row.gender ?? null) as string | null,
              qualification: (row.p_qualification ?? row.qualification ?? null) as string | null,
              medical_registration_number: (row.p_medical_registration_number ?? row.medical_registration_number ?? null) as string | null,
              experience_years: typeof (row.p_experience_years ?? row.experience_years) === "number"
                ? Number(row.p_experience_years ?? row.experience_years)
                : null,
              consultation_fee: typeof (row.p_consultation_fee ?? row.consultation_fee) === "number"
                ? Number(row.p_consultation_fee ?? row.consultation_fee)
                : null,
              working_hours: (row.p_working_hours ?? row.working_hours ?? null) as string | null,
              administrative_notes: (row.p_administrative_notes ?? row.administrative_notes ?? null) as string | null,
            });
          } else {
            if (supabaseConfig.demoMode && tryLocalToken()) return;
            setErrorInfo({
              title: "Link Invalid",
              message: "This invitation link is invalid.",
            });
          }
        })
        .catch((err: unknown) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error("[InviteSetup] validate_invite_token failure:", errorMsg);
          if (supabaseConfig.demoMode && tryLocalToken()) return;
          setErrorInfo({
            title: "Unable to Validate Invitation",
            message: "Unable to validate this invitation. Please try again.",
          });
        })
        .finally(() => setLoading(false));
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[InviteSetup] validate_invite_token initialization error:", errorMsg);
      if (supabaseConfig.demoMode && tryLocalToken()) return;
      setErrorInfo({
        title: "Unable to Validate Invitation",
        message: "Unable to validate this invitation. Please try again.",
      });
      setLoading(false);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !tokenInfo) return;

    const policyError = passwordPolicyError(pw);
    if (policyError) {
      toast.error(policyError);
      return;
    }
    if (pw !== pw2) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      if (supabaseConfig.configured) {
        const supabase = getSupabaseBrowserClient();
        console.log(`[InviteSetup] Calling activate_invited_user RPC (token length = ${token.length})`);

        // Atomically activate user in Supabase auth, profiles, and staff_memberships
        const { data: activateResult, error: activateErr } = await supabase.rpc(
          "activate_invited_user",
          { p_token: token, p_password: pw },
        );

        if (activateErr) {
          console.error("[InviteSetup] activate_invited_user RPC error:", activateErr.message);
          throw new Error(activateErr.message || "Failed to activate account");
        }

        const resultObj = activateResult as { success?: boolean; error?: string } | null;
        if (resultObj && resultObj.success === false) {
          throw new Error(resultObj.error || "Failed to activate account");
        }

        console.log("[InviteSetup] Account activated successfully via Supabase");

        // Establish live authenticated session via Supabase Auth
        try {
          await supabase.auth.signInWithPassword({
            email: tokenInfo.email.trim(),
            password: pw,
          });
        } catch (signInErr) {
          console.warn("[InviteSetup] Supabase auto-signin notice:", signInErr);
        }
      } else {
        // Fallback exclusively for demo mode without Supabase
        saveRegisteredAccount({
          userId: tokenInfo.hospital_id ? `admin-${tokenInfo.hospital_id.slice(0, 8)}` : `user-${Date.now()}`,
          email: tokenInfo.email.trim(),
          password: pw,
          name: tokenInfo.full_name,
          role: (tokenInfo.role_code as Role) || "clinic_admin",
          clinicId: tokenInfo.hospital_id,
          clinicName: tokenInfo.clinic_name || "ClinicFlow Health",
        });
        markLocalInviteTokenUsed(token);
      }

      toast.success("Your account has been activated successfully.");
      setIsActivated(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to set password");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-center">
          <Activity className="mx-auto h-8 w-8 animate-pulse text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Validating your invite link...</p>
        </div>
      </div>
    );
  }

  if (errorInfo) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-md text-center">
          <Activity className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-bold">{errorInfo.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{errorInfo.message}</p>
          <Button asChild className="mt-6">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!tokenInfo) return null;

  const RoleIcon = ROLE_ICONS[tokenInfo.role_code] ?? Building2;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-info p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 80%, white 0, transparent 40%)",
        }} />
        <div className="relative flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <Activity className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-lg font-bold">ClinicFlow</div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">Healthcare OS</div>
          </div>
        </div>
        <div className="relative">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Welcome aboard.
          </h1>
          <p className="mt-4 max-w-md text-base text-primary-foreground/85">
            Set your password to access ClinicFlow and start managing your clinic workspace.
          </p>
        </div>
        <div className="relative text-xs opacity-75">
          Secure access · dedicated hospital environment
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="font-display text-lg font-bold">ClinicFlow</div>
          </div>

          {isActivated ? (
            <div className="text-center py-6 space-y-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                  Your account has been activated successfully.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use your invited email address and newly created password to sign in.
                </p>
              </div>

              <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-4 text-left text-xs space-y-2 shadow-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Email: </span>
                  <span className="font-semibold text-foreground">{tokenInfo.email}</span>
                </div>
                {tokenInfo.clinic_name && (
                  <div>
                    <span className="font-medium text-muted-foreground">Clinic: </span>
                    <span className="font-semibold text-foreground">{tokenInfo.clinic_name}</span>
                  </div>
                )}
                {tokenInfo.hospital_id && (
                  <div>
                    <span className="font-medium text-muted-foreground">Clinic ID: </span>
                    <span className="font-mono text-primary font-medium">{tokenInfo.hospital_id}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <Button asChild className="h-11 w-full rounded-xl text-sm font-semibold">
                  <Link to="/app">
                    Go to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 w-full rounded-xl text-sm font-semibold">
                  <Link to="/login" search={{ email: tokenInfo.email.trim() }}>
                    Go to Login
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <RoleIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight">
                    You're invited to ClinicFlow
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {ROLE_LABELS[tokenInfo.role_code] ?? tokenInfo.role_code} Account Setup
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border bg-card/60 backdrop-blur-sm p-4 text-sm shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2 border-b pb-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Clinical Admin Email
                    </div>
                    <div className="font-semibold text-foreground text-sm mt-0.5 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-primary" />
                      <span>{tokenInfo.email}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {tokenInfo.full_name}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {ROLE_LABELS[tokenInfo.role_code] ?? tokenInfo.role_code}
                  </span>
                </div>

                {tokenInfo.clinic_name && (
                  <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-xs">
                    <div className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span>{tokenInfo.clinic_name}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground pt-1">
                      {tokenInfo.hospital_id && (
                        <div>
                          <span className="font-medium text-foreground">Clinic ID: </span>
                          <span className="font-mono text-[11px] text-primary">{tokenInfo.hospital_id}</span>
                        </div>
                      )}
                      {tokenInfo.clinic_city && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span>City: {tokenInfo.clinic_city}</span>
                        </div>
                      )}
                      {tokenInfo.clinic_address && (
                        <div className="sm:col-span-2 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span>Address: {tokenInfo.clinic_address}</span>
                        </div>
                      )}
                      {tokenInfo.clinic_phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span>Contact Number: {tokenInfo.clinic_phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tokenInfo.specialty && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Specialty: </span>
                    <span>{tokenInfo.specialty}</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-2.5 py-1.5 rounded-md border border-amber-200/60 dark:border-amber-900/60">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>This invitation link is valid for 24 hours.</span>
                </div>
              </div>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pw">Create Password</Label>
                  <div className="relative">
                    <Input
                      id="pw"
                      type={showPw ? "text" : "password"}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      className="h-11 rounded-xl pr-11"
                      autoComplete="new-password"
                      autoFocus
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-9 w-9"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pw2">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="pw2"
                      type={showPw2 ? "text" : "password"}
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      placeholder="Re-enter password"
                      className="h-11 rounded-xl pr-11"
                      autoComplete="new-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-9 w-9"
                      onClick={() => setShowPw2((v) => !v)}
                      aria-label={showPw2 ? "Hide password" : "Show password"}
                    >
                      {showPw2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full rounded-xl text-sm font-semibold"
                >
                  {submitting ? "Activating account..." : "Create Password & Activate Account"}{" "}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                This invitation link is valid for 24 hours. Set your password to activate your account.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

