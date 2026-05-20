import { get, set } from "idb-keyval";

export type AccessCode = {
  code: string;
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
};

export type LogEntry = {
  id: string;
  ts: number;
  type: "code_entry" | "code_entry_fail" | "admin_login" | "ocr" | "print" | "image_edit";
  code?: string;
  detail?: string;
};

export type Settings = {
  brandName: string;
  primaryColor: string;
  logoDataUrl: string | null;
  watermark: string;
  maxPrintsPerSession: number;
  sessionTimeoutMin: number;
  defaultCodeValidityDays: number;
};

export const DEFAULT_SETTINGS: Settings = {
  brandName: "PrintMaster AI",
  primaryColor: "#22d3ee",
  logoDataUrl: null,
  watermark: "",
  maxPrintsPerSession: 10,
  sessionTimeoutMin: 30,
  defaultCodeValidityDays: 30,
};

const K = {
  codes: "pm:codes",
  logs: "pm:logs",
  settings: "pm:settings",
};

export async function getCodes(): Promise<AccessCode[]> {
  return (await get<AccessCode[]>(K.codes)) ?? [];
}
export async function saveCodes(codes: AccessCode[]) {
  await set(K.codes, codes);
}
export async function getLogs(): Promise<LogEntry[]> {
  return (await get<LogEntry[]>(K.logs)) ?? [];
}
export async function appendLog(entry: Omit<LogEntry, "id" | "ts">) {
  const logs = await getLogs();
  logs.unshift({ ...entry, id: crypto.randomUUID(), ts: Date.now() });
  // Cap at 1000 entries
  await set(K.logs, logs.slice(0, 1000));
}
export async function clearLogs() {
  await set(K.logs, []);
}
export async function getSettings(): Promise<Settings> {
  const s = await get<Settings>(K.settings);
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}
export async function saveSettings(s: Settings) {
  await set(K.settings, s);
}

export function generateCode(): string {
  // 6 random digits
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

export function isCodeValid(c: AccessCode | undefined): boolean {
  if (!c) return false;
  if (c.revoked) return false;
  if (Date.now() > c.expiresAt) return false;
  return true;
}

export async function validateCode(input: string): Promise<AccessCode | null> {
  const codes = await getCodes();
  const match = codes.find((c) => c.code === input);
  return isCodeValid(match) ? match! : null;
}

export async function exportAll(): Promise<string> {
  const [codes, logs, settings] = await Promise.all([getCodes(), getLogs(), getSettings()]);
  return JSON.stringify({ codes, logs, settings, exportedAt: Date.now() }, null, 2);
}

export async function importAll(json: string) {
  const data = JSON.parse(json);
  if (Array.isArray(data.codes)) await saveCodes(data.codes);
  if (Array.isArray(data.logs)) await set(K.logs, data.logs);
  if (data.settings) await saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
}