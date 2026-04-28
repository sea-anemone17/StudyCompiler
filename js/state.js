import { CURRENT_SCHEMA_VERSION } from "./config.js";

export function createEmptyState() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activeSubjectId: null,
    subjects: [],
    tasks: [],
    performanceItems: []
  };
}

export function uid(prefix = "id") {
  if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getActiveSubject(state) {
  return state.subjects.find(subject => subject.id === state.activeSubjectId) || state.subjects[0] || null;
}

export function upsertSubject(state, subject) {
  const index = state.subjects.findIndex(item => item.id === subject.id);
  if (index >= 0) {
    state.subjects[index] = { ...state.subjects[index], ...subject, updatedAt: new Date().toISOString() };
  } else {
    state.subjects.push({ ...subject, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  state.activeSubjectId = subject.id;
}

export function removeSubjectTasks(state, subjectId) {
  state.tasks = state.tasks.filter(task => task.subjectId !== subjectId || task.manual === true);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(fromISO, toISO) {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  return Math.ceil((to - from) / 86400000);
}
