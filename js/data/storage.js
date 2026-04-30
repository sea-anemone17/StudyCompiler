import { STORAGE_KEY, CURRENT_SCHEMA_VERSION } from "../config.js";
import { createEmptyState } from "../state.js";
import { migrateState } from "./migrations.js";
import { formatDateOnly } from "../core/dateUtils.js";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return createEmptyState();
    return migrateState(parsed);
  } catch (error) {
    console.warn("Failed to load state", error);
    return createEmptyState();
  }
}

export function saveState(state) {
  const payload = {
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    syncMeta: {
      ...(state.syncMeta || {}),
      localUpdatedAt: new Date().toISOString()
    }
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify({ ...state, schemaVersion: CURRENT_SCHEMA_VERSION }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `study-compiler-backup-${formatDateOnly(new Date())}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importStateFromFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return migrateState(parsed);
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

export function createLocalSafetyBackup(reason = "manual") {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const key = `${STORAGE_KEY}_safety_backup_${Date.now()}`;
  localStorage.setItem(key, raw);
  return { key, reason, createdAt: new Date().toISOString() };
}
