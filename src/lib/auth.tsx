import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "super_admin" | "clinic_admin" | "doctor" | "receptionist";

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: Role;
  clinicId: string | null;
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
    clinic: "ClinicFlow HQ",
    clinicLogo: "CF",
  },
  clinic_admin: {
    userId: "USR-CA-001",
    name: "Marcus Lindqvist",
    email: "marcus@northwood.health",
    role: "clinic_admin",
    clinicId: "CL-001",
    clinic: "Northwood Health",
    clinicLogo: "NH",
  },
  doctor: {
    userId: "DR-01",
    name: "Dr. Amelia Chen",
    email: "amelia.chen@northwood.health",
    role: "doctor",
    clinicId: "CL-001",
    clinic: "Northwood Health",
    clinicLogo: "NH",
  },
  receptionist: {
    userId: "RC-01",
    name: "Sofia Romero",
    email: "sofia@northwood.health",
    role: "receptionist",
    clinicId: "CL-001",
    clinic: "Northwood Health",
    clinicLogo: "NH",
  },
};

interface AuthCtx {
  user: AuthUser | null;
  isReady: boolean;
  login: (role: Role, email: string) => void;
  logout: () => void;
  setRole: (role: Role) => void;
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

  useEffect(() => {
    if (typeof window === "undefined") return;

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
  }, []);

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
        login: (role, email) =>
          persist({
            ...DEFAULT_USERS[role],
            email: email.trim(),
          }),
        logout: () => persist(null),
        setRole: (role) => persist(DEFAULT_USERS[role]),
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
