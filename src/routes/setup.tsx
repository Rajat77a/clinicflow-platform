import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, Building2, Eye, EyeOff, ShieldCheck, Stethoscope, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";
import { getLocalInviteToken, markLocalInviteTokenUsed } from "@/lib/email-service";
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from "@/lib/password-policy";

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
  clinic_admin: "Clinic Admin",
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
  const [error, setError] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setError("No invite token found. Please check the link you received.");
      setLoading(false);
      return;
    }
    setToken(t);

    const tryLocalToken = () => {
      const local = getLocalInviteToken(t);
      if (local) {
        if (local.used) {
          setError("This invitation link has already been used. Please contact your administrator or sign in.");
          return true;
        }
        if (new Date(local.expiresAt) <= new Date()) {
          setError("This invitation link has expired. Invitation links are valid for 24 hours. Please contact the Super Admin for a new invitation.");
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
          clinic_email: null,
          clinic_phone: null,
          clinic_address: null,
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
        setError("Unable to validate the invite link. Please contact the Super Admin to request a new invitation.");
      }
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      supabase.rpc("validate_invite_token", { p_token: t })
        .then(({ data, error: rpcError }: { data: Array<{ status: string; p_email: string | null; p_full_name: string | null; p_phone: string | null; p_role_code: string | null; p_hospital_id: string | null; p_facility_id: string | null; p_department_id: string | null; p_clinic_name: string | null; p_clinic_email: string | null; p_clinic_phone: string | null; p_clinic_address: string | null; p_specialty: string | null; p_shift: string | null; p_gender: string | null; p_qualification: string | null; p_medical_registration_number: string | null; p_experience_years: number | null; p_consultation_fee: number | null; p_working_hours: string | null; p_administrative_notes: string | null }> | null; error: { message: string } | null }) => {
          if (rpcError || !data || data.length === 0) {
            if (tryLocalToken()) return;
            return supabase.rpc("consume_invite_token", { p_token: t })
              .then(({ data: consumeData }: { data: TokenInfo[] | null }) => {
                if (!consumeData || consumeData.length === 0) {
                  setError("This invitation link has expired (links are valid for 24 hours). Please contact the Super Admin to request a new invitation.");
                } else {
                  setTokenInfo(consumeData[0] as TokenInfo);
                }
              });
          }

          const row = data[0];
          if (row.status === "expired") {
            setError("This invitation link has expired. Invitation links are valid for 24 hours. Please contact the Super Admin to request a new invitation.");
          } else if (row.status === "used") {
            setError("This invitation link has already been used. Please contact your administrator or sign in.");
          } else if (row.status === "invalid" || !row.p_email) {
            if (!tryLocalToken()) {
              setError("This invitation link is invalid. Please check the link you received.");
            }
          } else {
            setTokenInfo({
              email: row.p_email ?? "",
              full_name: row.p_full_name ?? "",
              phone: row.p_phone ?? "",
              role_code: row.p_role_code ?? "",
              hospital_id: row.p_hospital_id ?? "",
              facility_id: row.p_facility_id,
              department_id: row.p_department_id,
              clinic_name: row.p_clinic_name,
              clinic_email: row.p_clinic_email,
              clinic_phone: row.p_clinic_phone,
              clinic_address: row.p_clinic_address,
              specialty: row.p_specialty,
              shift: row.p_shift,
              gender: row.p_gender,
              qualification: row.p_qualification,
              medical_registration_number: row.p_medical_registration_number,
              experience_years: row.p_experience_years,
              consultation_fee: row.p_consultation_fee,
              working_hours: row.p_working_hours,
              administrative_notes: row.p_administrative_notes,
            });
          }
        })
        .catch(() => {
          if (!tryLocalToken()) {
            setError("Unable to validate the invite link. Please try again.");
          }
        })
        .finally(() => setLoading(false));
    } catch {
      if (!tryLocalToken()) {
        setError("Unable to validate the invite link. Please try again.");
      }
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

        // Consume the invite token first to enforce single-use
        const { data: consumedData, error: consumeError } = await supabase.rpc("consume_invite_token", { p_token: token });
        if (consumeError || !consumedData || consumedData.length === 0) {
          throw new Error("This invitation link has expired or has already been used.");
        }

        // Check if user already exists
        const { data: existingUser } = await supabase.auth.admin.listUsers({
          filter: `email = "${tokenInfo.email}"`,
        });
        const existing = existingUser?.users?.find((u: { email?: string }) => u.email === tokenInfo.email);

        let userId: string;

        if (existing) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existing.id,
            { password: pw },
          );
          if (updateError) throw updateError;
          userId = existing.id;
        } else {
          const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email: tokenInfo.email,
            password: pw,
            email_confirm: true,
            user_metadata: {
              full_name: tokenInfo.full_name,
              phone: tokenInfo.phone,
            },
          });
          if (createError) throw createError;
          if (!created.user) throw new Error("User creation failed");
          userId = created.user.id;

          await supabase.from("profiles").upsert({
            id: userId,
            display_name: tokenInfo.full_name,
            email: tokenInfo.email,
          });

          await supabase.from("staff_memberships").insert({
            user_id: userId,
            hospital_id: tokenInfo.hospital_id,
            facility_id: tokenInfo.facility_id,
            department_id: tokenInfo.department_id,
            role_code: tokenInfo.role_code,
            active: true,
          });

          if (tokenInfo.role_code === "doctor") {
            await supabase.from("doctors").insert({
              user_id: userId,
              hospital_id: tokenInfo.hospital_id,
              facility_id: tokenInfo.facility_id,
              department_id: tokenInfo.department_id,
              display_name: tokenInfo.full_name,
              email: tokenInfo.email,
              phone: tokenInfo.phone,
              gender: tokenInfo.gender,
              specialty: tokenInfo.specialty,
              qualification: tokenInfo.qualification,
              medical_registration_number: tokenInfo.medical_registration_number,
              experience_years: tokenInfo.experience_years,
              consultation_fee: tokenInfo.consultation_fee,
              working_hours: tokenInfo.working_hours,
              administrative_notes: tokenInfo.administrative_notes,
              status: "active",
            });
          }

          if (tokenInfo.role_code === "receptionist" && tokenInfo.shift) {
            await supabase.from("staff_memberships")
              .update({ shift: tokenInfo.shift })
              .eq("user_id", userId);
          }
        }
      }

      markLocalInviteTokenUsed(token);
      toast.success("Password set successfully! You can now sign in with your email and password.");
      navigate({ to: "/login", search: { email: tokenInfo.email } });
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

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-md text-center">
          <Activity className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-bold">Link invalid</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
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

          <div className="flex items-center gap-3 mb-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <RoleIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Set up your account
              </h2>
              <p className="text-sm text-muted-foreground">
                {ROLE_LABELS[tokenInfo.role_code] ?? tokenInfo.role_code}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border bg-muted/40 p-4 text-sm">
            <div className="font-semibold">{tokenInfo.full_name}</div>
            <div className="text-muted-foreground">{tokenInfo.email}</div>
            {tokenInfo.clinic_name && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                <span>{tokenInfo.clinic_name}</span>
                {tokenInfo.clinic_address && <span>· {tokenInfo.clinic_address}</span>}
              </div>
            )}
            {tokenInfo.specialty && (
              <div className="mt-1 text-xs text-muted-foreground">
                Specialty: {tokenInfo.specialty}
              </div>
            )}
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-md">
              <span>⏰ 24-Hour Invitation Link · Valid for password generation</span>
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">New password</Label>
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
              <Label htmlFor="pw2">Confirm password</Label>
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
              {submitting ? "Setting password..." : "Set password & sign in"} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            This invite link expires in 24 hours. Set your password before it expires.
          </p>
        </div>
      </div>
    </div>
  );
}

