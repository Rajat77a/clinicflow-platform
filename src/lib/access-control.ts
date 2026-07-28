import type { Role } from "./auth";

export type Permission =
  | "platform.clinics.manage"
  | "platform.subscriptions.manage"
  | "platform.payments.manage"
  | "users.manage"
  | "patients.read"
  | "patients.create"
  | "appointments.read"
  | "appointments.create"
  | "appointments.update"
  | "prescriptions.read"
  | "prescriptions.write"
  | "labs.write"
  | "billing.read"
  | "billing.write"
  | "people.manage"
  | "files.read"
  | "reports.read"
  | "audit.read"
  | "downloads.read"
  | "followups.manage"
  | "settings.read"
  | "settings.manage"
  | "support.read"
  | "notifications.read";

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  super_admin: new Set([
    "platform.clinics.manage",
    "platform.subscriptions.manage",
    "platform.payments.manage",
    "users.manage",
    "reports.read",
    "audit.read",
    "downloads.read",
    "settings.read",
    "settings.manage",
    "support.read",
    "notifications.read",
  ]),
  clinic_admin: new Set([
    "patients.read",
    "patients.create",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "prescriptions.read",
    "labs.write",
    "billing.read",
    "billing.write",
    "people.manage",
    "users.manage",
    "files.read",
    "reports.read",
    "audit.read",
    "downloads.read",
    "followups.manage",
    "settings.read",
    "settings.manage",
    "support.read",
    "notifications.read",
  ]),
  doctor: new Set([
    "patients.read",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "prescriptions.read",
    "prescriptions.write",
    "labs.write",
    "downloads.read",
    "followups.manage",
    "settings.read",
    "support.read",
    "notifications.read",
  ]),
  receptionist: new Set([
    "patients.read",
    "patients.create",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "billing.read",
    "billing.write",
    "files.read",
    "downloads.read",
    "settings.read",
    "support.read",
    "notifications.read",
  ]),
};

const ROUTE_RULES: ReadonlyArray<{ matches: RegExp; permission: Permission }> = [
  { matches: /^\/app\/clinics(?:\/|$)/, permission: "platform.clinics.manage" },
  { matches: /^\/app\/subscriptions(?:\/|$)/, permission: "platform.subscriptions.manage" },
  { matches: /^\/app\/payments(?:\/|$)/, permission: "platform.payments.manage" },
  { matches: /^\/app\/doctors(?:\/|$)/, permission: "people.manage" },
  { matches: /^\/app\/receptionists(?:\/|$)/, permission: "people.manage" },
  { matches: /^\/app\/users(?:\/|$)/, permission: "users.manage" },
  { matches: /^\/app\/patients\/new\/?$/, permission: "patients.create" },
  { matches: /^\/app\/patients(?:\/|$)/, permission: "patients.read" },
  { matches: /^\/app\/appointments\/new\/?$/, permission: "appointments.create" },
  { matches: /^\/app\/appointments(?:\/|$)/, permission: "appointments.read" },
  { matches: /^\/app\/prescriptions\/new\/?$/, permission: "prescriptions.write" },
  { matches: /^\/app\/prescriptions(?:\/|$)/, permission: "prescriptions.read" },
  { matches: /^\/app\/billing(?:\/|$)/, permission: "billing.read" },
  { matches: /^\/app\/files(?:\/|$)/, permission: "files.read" },
  { matches: /^\/app\/reports(?:\/|$)/, permission: "reports.read" },
  { matches: /^\/app\/audit-logs(?:\/|$)/, permission: "audit.read" },
  { matches: /^\/app\/downloads(?:\/|$)/, permission: "downloads.read" },
  { matches: /^\/app\/followups(?:\/|$)/, permission: "followups.manage" },
  { matches: /^\/app\/medical-history(?:\/|$)/, permission: "followups.manage" },
  { matches: /^\/app\/settings(?:\/|$)/, permission: "settings.read" },
  { matches: /^\/app\/support(?:\/|$)/, permission: "support.read" },
  { matches: /^\/app\/notifications(?:\/|$)/, permission: "notifications.read" },
];

export function hasPermission(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionForPath(pathname: string): Permission | null {
  return ROUTE_RULES.find((rule) => rule.matches.test(pathname))?.permission ?? null;
}

export function permissionForLocation(
  pathname: string,
  search: Readonly<Record<string, unknown>> = {},
): Permission | null {
  if (/^\/app\/prescriptions\/new\/?$/.test(pathname) && search.mode === "lab") {
    return "labs.write";
  }
  return permissionForPath(pathname);
}

export function canAccessPath(role: Role, pathname: string) {
  if (/^\/app\/?$/.test(pathname)) return true;
  const permission = permissionForPath(pathname);
  if (permission === null) return !pathname.startsWith("/app/");
  return hasPermission(role, permission);
}

export function canAccessLocation(
  role: Role,
  pathname: string,
  search: Readonly<Record<string, unknown>> = {},
) {
  if (/^\/app\/?$/.test(pathname)) return true;
  const permission = permissionForLocation(pathname, search);
  if (permission === null) return !pathname.startsWith("/app/");
  return hasPermission(role, permission);
}

export function rolesForPermission(permission: Permission): Role[] {
  return (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((role) =>
    hasPermission(role, permission),
  );
}
