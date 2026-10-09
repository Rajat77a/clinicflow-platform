import re

with open('src/routes/setup.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

submit_regex = re.compile(r'const submit = async \(e: React\.FormEvent\) => \{.*?try \{.*?finally \{\s*setSubmitting\(false\);\s*\}\s*\};', re.DOTALL)
new_submit = '''const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8 && !userExists) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!userExists && pw !== pw2) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      if (supabaseConfig.configured && !isLocalToken) {
        const supabase = getSupabaseBrowserClient();
        console.log([InviteSetup] Processing invite... userExists=);

        if (userExists) {
          // Verify their existing password
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: tokenInfo.email.trim(),
            password: pw,
          });
          if (signInError) {
            setSubmitting(false);
            toast.error("Incorrect password. Please enter your existing ClinicFlow password.");
            return;
          }
          
          // Accept the invite
          const { error: activateErr } = await supabase.rpc("activate_invited_user", { p_token: token, p_password: null });
          if (activateErr) throw new Error(activateErr.message || "Failed to accept invitation");
        } else {
          // New user
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
          
          // Establish session
          await supabase.auth.signInWithPassword({
            email: tokenInfo.email.trim(),
            password: pw,
          });
        }

        console.log("[InviteSetup] Account activated successfully via Supabase");

        // Try getting session
        try {
          await supabase.auth.getSession();
          setIsActivated(true);
          setTimeout(() => {
            navigate({ to: "/" });
          }, 3000);
          return;
        } catch (signInErr) {
          console.warn("[InviteSetup] Supabase session notice:", signInErr);
        }
      } else {
        // Fallback exclusively for demo mode without Supabase
        saveRegisteredAccount({
          userId: tokenInfo.hospital_id ? dmin- : user-,
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
      setTimeout(() => {
        navigate({ to: "/" });
      }, 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to set password");
    } finally {
      setSubmitting(false);
    }
  };'''

code = submit_regex.sub(new_submit, code)

form_regex = re.compile(r'<form onSubmit=\{submit\} className="mt-6 space-y-4">.*?(?=<Button type="submit")', re.DOTALL)
new_form = '''<form onSubmit={submit} className="mt-6 space-y-4">
                  {userExists && (
                    <div className="rounded-md bg-blue-50 p-4 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/50">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>You already have an account!</strong> Please enter your existing password to log in and accept this new role.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="pw">{userExists ? "Current Password" : "Create Password"}</Label>
                    <div className="relative">
                      <Input
                        id="pw"
                        type={showPw ? "text" : "password"}
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        placeholder={userExists ? "Enter your password" : "At least 8 characters"}
                        className="h-11 rounded-xl pr-11"
                        autoComplete={userExists ? "current-password" : "new-password"}
                        autoFocus
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-9 w-9 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPw(!showPw)}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {!userExists && passwordPolicyError(pw) && pw.length > 0 && (
                      <p className="text-[11px] font-medium text-destructive">{passwordPolicyError(pw)}</p>
                    )}
                  </div>
  
                  {!userExists && (
                    <div className="space-y-2">
                      <Label htmlFor="pw2">Confirm Password</Label>
                      <Input
                        id="pw2"
                        type={showPw ? "text" : "password"}
                        value={pw2}
                        onChange={(e) => setPw2(e.target.value)}
                        placeholder="Re-enter password"
                        className="h-11 rounded-xl"
                        autoComplete="new-password"
                        required
                      />
                      {pw && pw2 && pw !== pw2 && (
                        <p className="text-[11px] font-medium text-destructive">Passwords do not match</p>
                      )}
                    </div>
                  )}
                  '''
code = form_regex.sub(new_form, code)

code = code.replace('{saving ? "Activating..." : "Set password & Activate"}', '{submitting ? (userExists ? "Accepting..." : "Activating...") : (userExists ? "Log In & Accept Role" : "Set password & Activate")}')
code = code.replace('{submitting ? "Activating..." : "Set password & Activate"}', '{submitting ? (userExists ? "Accepting..." : "Activating...") : (userExists ? "Log In & Accept Role" : "Set password & Activate")}')

with open('src/routes/setup.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
