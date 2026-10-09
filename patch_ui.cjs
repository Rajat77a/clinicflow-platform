const fs = require("fs");
let code = fs.readFileSync("src/routes/setup.tsx", "utf8");

const formRegex = /<form onSubmit=\{submit\} className="mt-6 space-y-4">[\s\S]*?(?=<Button\s+type="submit")/g;

const newForm = `<form onSubmit={submit} className="mt-6 space-y-4">
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
                      <div className="relative">
                        <Input
                          id="pw2"
                          type={showPw2 ? "text" : "password"}
                          value={pw2}
                          onChange={(e) => setPw2(e.target.value)}
                          placeholder="Re-enter password"
                          className="h-11 rounded-xl pr-11"
                          autoComplete="new-password"
                          required={!userExists}
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
                      {pw && pw2 && pw !== pw2 && (
                        <p className="text-[11px] font-medium text-destructive">Passwords do not match</p>
                      )}
                    </div>
                  )}
                  `;

code = code.replace(formRegex, newForm);

code = code.replace(
  '{submitting ? "Activating account..." : "Create Password & Activate Account"}',
  '{submitting ? (userExists ? "Accepting..." : "Activating account...") : (userExists ? "Log In & Accept Role" : "Create Password & Activate Account")}'
);

fs.writeFileSync("src/routes/setup.tsx", code);
console.log("Patched successfully");
