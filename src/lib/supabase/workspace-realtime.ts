import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "../auth";
import { hasPermission, type Permission } from "../access-control.ts";

type RealtimeTable = {
  table: string;
  filterColumn: "hospital_id" | "id";
  anyPermission?: readonly Permission[];
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
];

export function realtimeTablesForRole(role: Role) {
  return REALTIME_TABLES.filter(
    ({ anyPermission }) =>
      !anyPermission || anyPermission.some((permission) => hasPermission(role, permission)),
  );
}

interface WorkspaceRealtimeOptions {
  client: SupabaseClient;
  hospitalId: string;
  role: Role;
  userId: string;
  onChange: () => void;
}

export function subscribeToWorkspaceChanges({
  client,
  hospitalId,
  role,
  userId,
  onChange,
}: WorkspaceRealtimeOptions) {
  const channel = client.channel(`workspace:${hospitalId}:${userId}`);

  for (const { table, filterColumn } of realtimeTablesForRole(role)) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `${filterColumn}=eq.${hospitalId}`,
      },
      onChange,
    );
  }

  channel.subscribe();

  return async () => {
    await client.removeChannel(channel);
  };
}
