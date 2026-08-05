import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  ShieldCheck,
  Stethoscope,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth, type Role, ROLE_LABELS } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from "@/lib/password-policy";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ClinicFlow" },
      {
        name: "description",
        content: "Sign in to ClinicFlow, the modern clinic management platform.",
      },
    ],
  }),
  component: Login,
});

const ROLE_ICONS: Record<Role, React.ComponentType<{ className?: string }>> = {
  super_admin: ShieldCheck,
  clinic_admin: Building2,
  doctor: Stethoscope,
  receptionist: UserCog,
};

function Login() {
  const {
    isDemoMode,
    passwordSetupRequired,
    login,
    requestPasswordReset,
    updatePassword,
    completePasswordSetup,
  } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Email address is required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address");
      return;
    }

    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      navigate({ to: "/app" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-info p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 80%, white 0, transparent 40%)",
          }}
        />

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
            Run a calmer clinic.
          </h1>
          <p className="mt-4 max-w-md text-base text-primary-foreground/85">
            From patient registration to prescriptions and billing — ClinicFlow gives every role the
            clarity they need to deliver better care.
          </p>

          <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
            {[
              ["4", "role portals"],
              ["1", "workspace"],
              ["RBAC", "foundation"],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="font-display text-2xl font-bold">{v}</div>
                <div className="text-xs uppercase tracking-wider opacity-75">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs opacity-75">
          {isDemoMode
            ? "Demo environment · sample data only"
            : "Dedicated hospital environment · compliance validation required before clinical use"}
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

          <h2 className="font-display text-3xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to continue to your clinic workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <ForgotPasswordDialog
                  isDemoMode={isDemoMode}
                  passwordSetupRequired={passwordSetupRequired}
                  requestPasswordReset={requestPasswordReset}
                  updatePassword={updatePassword}
                  onPasswordSetupComplete={() => {
                    completePasswordSetup();
                    navigate({ to: "/app" });
                  }}
                />
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="h-11 rounded-xl pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-9 w-9"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-xl text-sm font-semibold"
            >
              {submitting ? "Signing in..." : "Sign in"} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By signing in you agree to ClinicFlow's Terms & Privacy Policy.
            </p>
          </form>

          <div className="mt-8 rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
            {isDemoMode ? (
              <>
                <span className="font-semibold text-foreground">Demo mode:</span> no real
                authentication — enter your email and password to explore the platform.{" "}
              </>
            ) : (
              <>
                <span className="font-semibold text-foreground">Secure access:</span> use the staff
                account assigned by your hospital administrator.{" "}
              </>
            )}
            <Link to="/" className="underline">
              Back home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ForgotPasswordDialog({
  isDemoMode,
  passwordSetupRequired,
  requestPasswordReset,
  updatePassword,
  onPasswordSetupComplete,
}: {
  isDemoMode: boolean;
  passwordSetupRequired: boolean;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  onPasswordSetupComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  useEffect(() => {
    if (passwordSetupRequired) {
      setStep("reset");
      setOpen(true);
    }
  }, [passwordSetupRequired]);

  const reset = () => {
    setStep("request");
    setEmail("");
    setPw("");
    setPw2("");
    setShowPw(false);
    setShowPw2(false);
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!email.trim()) {
      toast.error("Enter your email");
      return;
    }

    try {
      await requestPasswordReset(email);
      toast.success(
        isDemoMode
          ? "Demo reset flow opened"
          : "If the account exists, a secure reset link has been sent",
      );
      if (isDemoMode) {
        setStep("reset");
      } else {
        setOpen(false);
        reset();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send reset link");
    }
  };

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const policyError = passwordPolicyError(pw);
    if (policyError) {
      toast.error(policyError);
      return;
    }

    if (pw !== pw2) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      await updatePassword(pw);
      toast.success("Password updated");
      onPasswordSetupComplete();
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update password");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && passwordSetupRequired) return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-primary hover:underline"
      >
        Forgot password?
      </button>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "request" ? "Reset your password" : "Set a new password"}
          </DialogTitle>
          <DialogDescription>
            {step === "request"
              ? "Enter your work email and we'll send a secure reset link."
              : `Choose a strong password with at least ${MIN_PASSWORD_LENGTH} characters, including upper and lowercase letters, a number and a symbol.`}
          </DialogDescription>
        </DialogHeader>

        {step === "request" ? (
          <form onSubmit={sendCode} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Work email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com"
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">
                Send reset link
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={savePw} className="space-y-3">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  className="h-11 rounded-xl pr-11"
                  autoComplete="new-password"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-9 w-9"
                  onClick={() => setShowPw((visible) => !visible)}
                  aria-label={showPw ? "Hide new password" : "Show new password"}
                  title={showPw ? "Hide new password" : "Show new password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Confirm new password</Label>
              <div className="relative">
                <Input
                  type={showPw2 ? "text" : "password"}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="Re-enter password"
                  className="h-11 rounded-xl pr-11"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-9 w-9"
                  onClick={() => setShowPw2((visible) => !visible)}
                  aria-label={showPw2 ? "Hide confirmation password" : "Show confirmation password"}
                  title={showPw2 ? "Hide confirmation password" : "Show confirmation password"}
                >
                  {showPw2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("request")}>
                Back
              </Button>
              <Button type="submit">Update password</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
