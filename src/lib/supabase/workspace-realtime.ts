import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "../auth";
import { hasPermission, type Permission } from "../access-control.ts";

type RealtimeTable = {
  table: string;
  filterColumn?: "hospital_id" | "id";
  anyPermission?: readonly Permission[];
  platformOnly?: boolean;
};

const REALTIME_TABLES: readonly RealtimeTable[] = [
  { table: "hospitals", filterColumn: "id" },
  { table: "staff_memberships", filterColumn: "hospital_id", anyPermission: ["people.manage"] },
  { table: "patients", filterColumn: "hospital_id", anyPermission: ["patients.read"] },
  { table: "appointments", filterColumn: "hospital_id", anyPermission: ["appointments.read"] },
  { table: "prescriptions", filterColumn: "hospital_id", anyPermission: ["prescriptions.read"] },
  {
    table: "lab_orders",
    filterColumn: "hospital_id",
    anyPermission: ["labs.write", "prescriptions.read"],
  },
  { table: "invoices", filterColumn: "hospital_id", anyPermission: ["billing.read"] },
  { table: "audit_events", filterColumn: "hospital_id", anyPermission: ["audit.read"] },
  { table: "hospital_subscriptions", platformOnly: true },
  { table: "hospital_subscription_events", platformOnly: true },
];

export function realtimeTablesForRole(role: Role) {
  return REALTIME_TABLES.filter(
    ({ anyPermission, platformOnly }) =>
      (!platformOnly || role === "super_admin")
      && (!anyPermission || anyPermission.some((permission) => hasPermission(role, permission))),
  );
}

interface WorkspaceRealtimeOptions {
  client: SupabaseClient;
  hospitalId: string;
  role: Role;
  userId: string;
  onChange: () => void;
  onStatus?: (status: WorkspaceRealtimeStatus) => void;
}

export type WorkspaceRealtimeStatus = "connecting" | "live" | "error";

export function subscribeToWorkspaceChanges({
  client,
  hospitalId,
  role,
  userId,
  onChange,
  onStatus,
}: WorkspaceRealtimeOptions) {
  const channel = client.channel(`workspace:${hospitalId}:${userId}`);

  for (const { table, filterColumn } of realtimeTablesForRole(role)) {
    const changeConfig = {
      event: "*" as const,
      schema: "public",
      table,
      ...(role === "super_admin" && (table === "hospitals" || table.startsWith("hospital_subscription"))
        ? {}
        : { filter: `${filterColumn}=eq.${hospitalId}` }),
    };
    channel.on(
      "postgres_changes",
      changeConfig,
      onChange,
    );
  }

  onStatus?.("connecting");
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") onStatus?.("live");
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus?.("error");
  });

  return async () => {
    await client.removeChannel(channel);
  };
}
