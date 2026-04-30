import { STORAGE_KEY, CURRENT_SCHEMA_VERSION } from "./config.js";
import { createEmptyState, normalizeSubjectPlan, todayISO } from "./state.js";

const SAFETY_BACKUP_KEY = `${STORAGE_KEY}_safety_backup`;

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
  const now = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    syncMeta: {
      ...(state.syncMeta || {}),
      localUpdatedAt: now
    }
  }));
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify({ ...state, schemaVersion: CURRENT_SCHEMA_VERSION }, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `study-compiler-backup-${todayISO()}.json`;
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

export function createSafetyBackup(state, reason = "manual") {
  try {
    const backup = {
      reason,
      createdAt: new Date().toISOString(),
      data: state
    };
    localStorage.setItem(SAFETY_BACKUP_KEY, JSON.stringify(backup));
    return backup;
  } catch (error) {
    console.warn("Failed to create safety backup", error);
    return null;
  }
}

export function getSafetyBackup() {
  try {
    return JSON.parse(localStorage.getItem(SAFETY_BACKUP_KEY));
  } catch {
    return null;
  }
}

function migrateState(state) {
  const base = createEmptyState();
  const subjects = Array.isArray(state.subjects)
    ? state.subjects.map(subject => normalizeSubjectPlan({
        dailyMinutes: 120,
        type: "problem",
        curriculum: [],
        versions: [],
        studyFinishBufferDays: 7,
        examDateStatus: "estimated",
        ...subject
      }))
    : [];

  const tasks = Array.isArray(state.tasks)
    ? state.tasks.map(task => ({
        type: "study",
        status: "pending",
        estimatedMinutes: 30,
        priority: getDefaultPriority(task),
        actualMinutes: task.actualMinutes ?? null,
        accuracy: task.accuracy ?? null,
        understanding: task.understanding ?? null,
        notes: task.notes || "",
        completedAt: task.completedAt || null,
        ...task,
        schedulerVersion: task.schedulerVersion || "legacy"
      }))
    : [];

  const performanceItems = Array.isArray(state.performanceItems) ? state.performanceItems : [];

  return {
    ...base,
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    subjects,
    activeSubjectId: state.activeSubjectId || subjects[0]?.id || null,
    tasks,
    performanceItems,
    syncMeta: {
      ...(base.syncMeta || {}),
      ...(state.syncMeta || {})
    }
  };
}

function getDefaultPriority(task = {}) {
  if (task.type === "patch") return 0;
  if (task.type === "review") return 0.5;
  if (task.versionId === "v0") return 1;
  if (task.versionId === "v1") return 2;
  if (task.versionId === "v2") return 3;
  if (task.versionId === "v3") return 4;
  return 10;
}
