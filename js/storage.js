import { STORAGE_KEY, CURRENT_SCHEMA_VERSION } from "./config.js";
import { createEmptyState } from "./state.js";

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `study-compiler-backup-${new Date().toISOString().slice(0, 10)}.json`;
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

function migrateState(state) {
  const base = createEmptyState();
  return {
    ...base,
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    subjects: Array.isArray(state.subjects) ? state.subjects : [],
    activeSubjectId: state.activeSubjectId || state.subjects?.[0]?.id || null,
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    performanceItems: Array.isArray(state.performanceItems) ? state.performanceItems : []
  };
}
