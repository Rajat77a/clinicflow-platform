import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  realtimeTablesForRole,
  subscribeToWorkspaceChanges,
} from "./supabase/workspace-realtime.ts";

function tableNames(role: Parameters<typeof realtimeTablesForRole>[0]) {
  return realtimeTablesForRole(role).map(({ table }) => table);
}

test("clinic administrators receive every hospital operation they can read", () => {
  assert.deepEqual(tableNames("clinic_admin"), [
    "hospitals",
    "staff_memberships",
    "patients",
    "appointments",
    "prescriptions",
    "lab_orders",
    "invoices",
    "audit_events",
  ]);
});

test("clinical roles subscribe only to relevant hospital records", () => {
  assert.deepEqual(tableNames("doctor"), [
    "hospitals",
    "patients",
    "appointments",
    "prescriptions",
    "lab_orders",
  ]);
  assert.deepEqual(tableNames("receptionist"), [
    "hospitals",
    "patients",
    "appointments",
    "invoices",
  ]);
});

test("platform administrators do not subscribe to clinical record tables", () => {
  assert.deepEqual(tableNames("super_admin"), [
    "hospitals",
    "staff_memberships",
    "audit_events",
  ]);
});

test("subscriptions are hospital-filtered and removed during cleanup", async () => {
  const filters: Array<Record<string, string>> = [];
  const statuses: string[] = [];
  let subscribed = false;
  let removed = false;
  const channel = {
    on: (
      _event: string,
      filter: Record<string, string>,
      _callback: () => void,
    ) => {
      filters.push(filter);
      return channel;
    },
    subscribe: (callback: (status: string) => void) => {
      subscribed = true;
      callback("SUBSCRIBED");
      return channel;
    },
  };
  const client = {
    channel: (name: string) => {
      assert.equal(name, "workspace:hospital-1:user-1");
      return channel;
    },
    removeChannel: async (target: unknown) => {
      assert.equal(target, channel);
      removed = true;
      return "ok";
    },
  } as unknown as SupabaseClient;

  const unsubscribe = subscribeToWorkspaceChanges({
    client,
    hospitalId: "hospital-1",
    role: "receptionist",
    userId: "user-1",
    onChange: () => undefined,
    onStatus: (status) => statuses.push(status),
  });

  assert.equal(subscribed, true);
  assert.deepEqual(statuses, ["connecting", "live"]);
  assert.deepEqual(filters, [
    {
      event: "*",
      schema: "public",
      table: "hospitals",
      filter: "id=eq.hospital-1",
    },
    {
      event: "*",
      schema: "public",
      table: "patients",
      filter: "hospital_id=eq.hospital-1",
    },
    {
      event: "*",
      schema: "public",
      table: "appointments",
      filter: "hospital_id=eq.hospital-1",
    },
    {
      event: "*",
      schema: "public",
      table: "invoices",
      filter: "hospital_id=eq.hospital-1",
    },
  ]);

  await unsubscribe();
  assert.equal(removed, true);
});
