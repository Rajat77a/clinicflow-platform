import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthChangeEvent, AuthError, Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase/client";
import { supabaseConfig } from "./supabase/config";

export type Role = "super_admin" | "clinic_admin" | "doctor" | "receptionist";

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: Role;
  clinicId: string | null;
  facilityId: string | null;
  departmentId: string | null;
  clinic: string;
  clinicLogo: string;
}

const DEFAULT_USERS: Record<Role, AuthUser> = {
  super_admin: {
    userId: "USR-SA-001",
    name: "Dr. Helena Vance",
    email: "helena@clinicflow.io",
    role: "super_admin",
    clinicId: null,
    facilityId: null,
    departmentId: null,
    clinic: "ClinicFlow HQ",
    clinicLogo: "CF",
  },
  clinic_admin: {
    userId: "USR-CA-001",
    name: "Marcus Lindqvist",
    email: "marcus@northwood.health",
    role: "clinic_admin",
    clinicId: "CL-001",
    facilityId: null,
    departmentId: null,
    clinic: "Northwood Health",
    clinicLogo: "NH",
  },
  doctor: {
    userId: "DR-01",
    name: "Dr. Amelia Chen",
    email: "amelia.chen@northwood.health",
    role: "doctor",
    clinicId: "CL-001",
    facilityId: null,
    departmentId: null,
    clinic: "Northwood Health",
    clinicLogo: "NH",
  },
  receptionist: {
    userId: "RC-01",
    name: "Sofia Romero",
    email: "sofia@northwood.health",
    role: "receptionist",
    clinicId: "CL-001",
    facilityId: null,
    departmentId: null,
    clinic: "Northwood Health",
    clinicLogo: "NH",
  },
};

interface AuthCtx {
  user: AuthUser | null;
  isReady: boolean;
  isDemoMode: boolean;
  login: (email: string, password: string, demoRole?: Role) => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: Role) => void;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const ROLES = new Set<Role>(["super_admin", "clinic_admin", "doctor", "receptionist"]);

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<AuthUser>;
  return (
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    typeof user.role === "string" &&
    ROLES.has(user.role as Role) &&
    typeof user.clinic === "string"
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const hydrateSupabaseUser = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setUser(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] =
      await Promise.all([
        supabase.from("profiles").select("display_name, email").eq("id", authUser.id).maybeSingle(),
        supabase
          .from("staff_memberships")
          .select("hospital_id, facility_id, department_id, role_code")
          .eq("user_id", authUser.id)
          .eq("active", true)
          .maybeSingle(),
      ]);

    if (profileError || membershipError) {
      throw profileError ?? membershipError;
    }
    if (!membership) {
      await supabase.auth.signOut();
      throw new Error("Your account is not assigned to this hospital");
    }
    if (!ROLES.has(membership.role_code as Role)) {
      await supabase.auth.signOut();
      throw new Error("This role is not supported by the current portal");
    }

    const { data: hospital, error: hospitalError } = await supabase
      .from("hospitals")
      .select("name")
      .eq("id", membership.hospital_id)
      .single();
    if (hospitalError) throw hospitalError;

    const name =
      profile?.display_name ||
      authUser.user_metadata.full_name ||
      authUser.email ||
      "Hospital user";
    const clinic = hospital.name;
    setUser({
      userId: authUser.id,
      name,
      email: profile?.email || authUser.email || "",
      role: membership.role_code as Role,
      clinicId: membership.hospital_id,
      facilityId: membership.facility_id,
      departmentId: membership.department_id,
      clinic,
      clinicLogo: clinic
        .split(/\s+/)
        .map((part: string) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!supabaseConfig.demoMode) {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth
        .getUser()
        .then(async ({ data, error }: { data: { user: User | null }; error: AuthError | null }) => {
          try {
            if (error) throw error;
            await hydrateSupabaseUser(data.user);
          } catch {
            setUser(null);
          } finally {
            setIsReady(true);
          }
        });

      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          queueMicrotask(() => {
            void hydrateSupabaseUser(session?.user ?? null).catch(() => setUser(null));
          });
        },
      );

      return () => listener.subscription.unsubscribe();
    }

    const raw = localStorage.getItem("cf_user");

    if (raw) {
      try {
        const savedUser: unknown = JSON.parse(raw);
        if (isAuthUser(savedUser)) {
          const normalizedUser = { ...DEFAULT_USERS[savedUser.role], email: savedUser.email };
          setUser(normalizedUser);
          localStorage.setItem("cf_user", JSON.stringify(normalizedUser));
        } else {
          localStorage.removeItem("cf_user");
        }
      } catch {
        localStorage.removeItem("cf_user");
      }
    }
    setIsReady(true);
  }, [hydrateSupabaseUser]);

  const persist = (u: AuthUser | null) => {
    setUser(u);

    if (typeof window !== "undefined") {
      if (u) {
        localStorage.setItem("cf_user", JSON.stringify(u));
      } else {
        localStorage.removeItem("cf_user");
      }
    }
  };

  return (
    <Ctx.Provider
      value={{
        user,
        isReady,
        isDemoMode: supabaseConfig.demoMode,
        login: async (email, password, demoRole = "clinic_admin") => {
          if (supabaseConfig.demoMode) {
            persist({
              ...DEFAULT_USERS[demoRole],
              email: email.trim(),
            });
            return;
          }

          const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) throw error;
          await hydrateSupabaseUser(data.user);
        },
        logout: async () => {
          if (!supabaseConfig.demoMode) {
            const { error } = await getSupabaseBrowserClient().auth.signOut();
            if (error) throw error;
          }
          persist(null);
        },
        setRole: (role) => {
          if (!supabaseConfig.demoMode) {
            throw new Error("Roles can only be changed by an authorized administrator");
          }
          persist(DEFAULT_USERS[role]);
        },
        requestPasswordReset: async (email) => {
          if (supabaseConfig.demoMode) return;
          const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(
            email.trim(),
            { redirectTo: `${supabaseConfig.appUrl}/login` },
          );
          if (error) throw error;
        },
        updatePassword: async (password) => {
          if (supabaseConfig.demoMode) return;
          const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
          if (error) throw error;
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);

  if (!c) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return c;
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  clinic_admin: "Clinic Admin",
  doctor: "Doctor",
  receptionist: "Receptionist",
};
