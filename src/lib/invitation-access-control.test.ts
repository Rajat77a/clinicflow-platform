import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationSource = await readFile(
  new URL("../../supabase/migrations/20260925010000_production_invitations_and_access_control.sql", import.meta.url),
  "utf8",
);
const setupSource = await readFile(
  new URL("../routes/setup.tsx", import.meta.url),
  "utf8",
);
const workspaceDataSource = await readFile(
  new URL("./workspace-data.tsx", import.meta.url),
  "utf8",
);
const repositorySource = await readFile(
  new URL("./supabase/workspace-repository.ts", import.meta.url),
  "utf8",
);
const backendRepoSource = await readFile(
  new URL("./backend/workspace-repository.ts", import.meta.url),
  "utf8",
);
const authSource = await readFile(
  new URL("./auth.tsx", import.meta.url),
  "utf8",
);

test("migration creates 24-hour expiration token generation with previous token invalidation", () => {
  assert.match(migrationSource, /create or replace function public\.create_staff_invite_token/);
  assert.match(migrationSource, /now\(\) \+ interval '24 hours'/);
  assert.match(migrationSource, /update public\.invite_tokens[\s\S]*?set expires_at = now\(\) - interval '1 second'/);
  assert.match(migrationSource, /v_hospital_email := v_config->>'email'/);
  assert.match(migrationSource, /security definer/);
  assert.match(migrationSource, /grant execute on function public\.create_staff_invite_token[\s\S]*?to authenticated, anon, service_role/);
});

test("migration validates invite token returning explicit status values", () => {
  assert.match(migrationSource, /create or replace function public\.validate_invite_token/);
  assert.match(migrationSource, /v_status := 'clinic_deleted'/);
  assert.match(migrationSource, /v_status := 'used'/);
  assert.match(migrationSource, /v_status := 'expired'/);
  assert.match(migrationSource, /v_status := 'valid'/);
  assert.match(migrationSource, /'invalid'::text/);
  assert.match(migrationSource, /grant execute on function public\.validate_invite_token\(text\) to anon, authenticated, service_role/);
});

test("migration provides atomic password activation RPC for Supabase auth and staff membership", () => {
  assert.match(migrationSource, /create or replace function public\.activate_invited_user/);
  assert.match(migrationSource, /extensions\.crypt\(p_password, extensions\.gen_salt\('bf'\)\)/);
  assert.match(migrationSource, /insert into auth\.users/);
  assert.match(migrationSource, /insert into public\.profiles/);
  assert.match(migrationSource, /insert into public\.staff_memberships/);
  assert.match(migrationSource, /update public\.invite_tokens[\s\S]*?set used_at = now\(\)/);
  assert.match(migrationSource, /grant execute on function public\.activate_invited_user\(text, text\) to anon, authenticated, service_role/);
});

test("migration defines persistent user soft delete, permanent delete, and restore RPCs", () => {
  assert.match(migrationSource, /create or replace function public\.soft_delete_staff_member/);
  assert.match(migrationSource, /create or replace function public\.permanently_delete_staff_user/);
  assert.match(migrationSource, /create or replace function public\.restore_staff_member/);
  // Soft delete deactivates membership and bans auth user
  assert.match(migrationSource, /banned_until = '3000-01-01 00:00:00\+00'::timestamptz/);
  // Permanent delete scrambles password
  assert.match(migrationSource, /encrypted_password = 'DELETED_' \|\| encode\(gen_random_bytes\(32\), 'hex'\)/);
});

test("migration hardens RLS policies for Super Admin global access and Clinical Admin hospital isolation", () => {
  // staff_memberships RLS includes platform admin
  assert.match(migrationSource, /memberships_select on public\.staff_memberships[\s\S]*?private\.is_platform_admin\(\)/);
  // profiles RLS includes platform admin
  assert.match(migrationSource, /profiles_select_self_or_staff on public\.profiles[\s\S]*?private\.is_platform_admin\(\)/);
  // facilities RLS includes platform admin
  assert.match(migrationSource, /facilities_select on public\.facilities[\s\S]*?private\.is_platform_admin\(\)/);
  // invite_tokens is protected from public/anon select
  assert.match(migrationSource, /revoke all on public\.invite_tokens from public, anon/);
  assert.match(migrationSource, /invite_tokens_admin_select on public\.invite_tokens/);
});

test("migration list_current_staff and list_active_doctors exclude deleted users and support platform admin", () => {
  assert.match(migrationSource, /create or replace function public\.list_current_staff/);
  assert.match(migrationSource, /membership\.deleted_at is null/);
  assert.match(migrationSource, /private\.is_platform_admin\(\)/);
  assert.match(migrationSource, /create or replace function public\.list_active_doctors_with_counts/);
});

test("setup page uses authoritative Supabase RPC and does not fall back to local storage in production", () => {
  assert.match(setupSource, /validate_invite_token/);
  assert.match(setupSource, /activate_invited_user/);
  assert.match(setupSource, /row\.status === "expired"/);
  assert.match(setupSource, /row\.status === "used"/);
  assert.match(setupSource, /row\.status === "clinic_deleted"/);
  // Local token fallback is restricted to demoMode
  assert.match(setupSource, /if \(supabaseConfig\.demoMode && tryLocalToken\(\)\)/);
  assert.match(setupSource, /saveRegisteredAccount/);
});

test("repository and workspace data support persistent staff deletion and global super admin queries", () => {
  // WorkspaceRepository interface defines staff deletion
  assert.match(backendRepoSource, /softDeleteStaff\?\(userId: string\): Promise<void>/);
  assert.match(backendRepoSource, /permanentlyDeleteStaff\?\(userId: string\): Promise<void>/);
  assert.match(backendRepoSource, /restoreStaff\?\(userId: string\): Promise<void>/);

  // SupabaseWorkspaceRepository implements them
  assert.match(repositorySource, /async softDeleteStaff\(userId: string\)/);
  assert.match(repositorySource, /async restoreStaff\(userId: string\)/);
  assert.match(repositorySource, /async permanentlyDeleteStaff\(userId: string\)/);

  // workspace-data delegates to repository
  assert.match(workspaceDataSource, /repository\?\.softDeleteStaff/);
  assert.match(workspaceDataSource, /repository\?\.restoreStaff/);
  assert.match(workspaceDataSource, /repository\?\.permanentlyDeleteStaff/);

  // Super Admin is not hospital-filtered
  assert.match(workspaceDataSource, /const isSuperAdmin = user\?\.role === "super_admin"/);
  assert.match(workspaceDataSource, /isSuperAdmin \? items : \(clinicId \? items\.filter/);
});

test("auth provider prioritizes Supabase authentication and restricts mock account store to demo mode", () => {
  assert.match(authSource, /signInWithPassword/);
  assert.match(authSource, /if \(!supabaseConfig\.demoMode\) {\s*throw new Error\(error\.message \|\| "Invalid email or password\."\);\s*}/);
});
