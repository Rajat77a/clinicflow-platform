import type { Role } from "./auth";

export interface RegisteredAccount {
  userId: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  clinicId: string | null;
  clinicName: string;
  createdAt: string;
  updatedAt: string;
}

const memoryAccounts = new Map<string, RegisteredAccount>();

const STORAGE_KEY = "cf_registered_accounts";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function loadAccountsFromStorage(): Record<string, RegisteredAccount> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAccountsToStorage(accounts: Record<string, RegisteredAccount>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage quota or disabled errors
  }
}

export function saveRegisteredAccount(input: {
  userId?: string;
  email: string;
  password: string;
  name: string;
  role?: Role;
  clinicId?: string | null;
  clinicName?: string;
}): RegisteredAccount {
  const normEmail = normalizeEmail(input.email);
  const now = new Date().toISOString();

  const accounts = loadAccountsFromStorage();
  const existing = accounts[normEmail] || memoryAccounts.get(normEmail);

  const account: RegisteredAccount = {
    userId: input.userId || existing?.userId || `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email: normEmail,
    password: input.password,
    name: input.name || existing?.name || "Clinical Admin",
    role: input.role || existing?.role || "clinic_admin",
    clinicId: input.clinicId !== undefined ? input.clinicId : (existing?.clinicId ?? null),
    clinicName: input.clinicName || existing?.clinicName || "ClinicFlow Health",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  memoryAccounts.set(normEmail, account);
  accounts[normEmail] = account;
  saveAccountsToStorage(accounts);

  return account;
}

export function getRegisteredAccount(email: string): RegisteredAccount | null {
  const normEmail = normalizeEmail(email);
  if (memoryAccounts.has(normEmail)) {
    return memoryAccounts.get(normEmail)!;
  }
  const accounts = loadAccountsFromStorage();
  if (accounts[normEmail]) {
    memoryAccounts.set(normEmail, accounts[normEmail]);
    return accounts[normEmail];
  }
  return null;
}

export function verifyRegisteredAccount(email: string, password: string): RegisteredAccount | null {
  const account = getRegisteredAccount(email);
  if (!account) return null;
  if (account.password === password) {
    return account;
  }
  return null;
}

export function updateRegisteredPassword(email: string, newPassword: string): boolean {
  const account = getRegisteredAccount(email);
  if (!account) return false;
  account.password = newPassword;
  account.updatedAt = new Date().toISOString();
  saveRegisteredAccount(account);
  return true;
}
