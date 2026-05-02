import { CURRENT_SCHEMA_VERSION } from "./config.js";
import { todayISO, addDaysISO, daysBetween, isISODate } from "./core/dateUtils.js";
import { createDefaultWeeklyAvailability } from "./core/capacityModel.js";

export function createEmptyState() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activeSubjectId: null,
    subjects: [],
    tasks: [],
    performanceItems: [],
    classProgress: [],
    weeklyAvailability: createDefaultWeeklyAvailability(),
    dateOverrides: {},
    durationProfiles: {},
    plannerWarnings: [],
    syncMeta: {}
  };
}

export function uid(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getActiveSubject(state) {
  return state.subjects.find(subject => subject.id === state.activeSubjectId) || state.subjects[0] || null;
}

export function upsertSubject(state, subject) {
  const now = new Date().toISOString();
  const index = state.subjects.findIndex(item => item.id === subject.id);
  const normalized = {
    dailyMinutes: 120,
    type: "problem",
    curriculum: [],
    versions: [],
    examDateStatus: subject.examDateStatus || (subject.examDate ? "estimated" : "unknown"),
    studyFinishBufferDays: Number(subject.studyFinishBufferDays ?? 7),
    allowRegularStudyOnExamDay: Boolean(subject.allowRegularStudyOnExamDay),
    ...subject,
    updatedAt: now
  };
  if (index >= 0) {
    state.subjects[index] = { ...state.subjects[index], ...normalized };
  } else {
    state.subjects.push({ ...normalized, createdAt: now });
  }
  state.activeSubjectId = normalized.id;
}

export function removeSubjectTasks(state, subjectId, { includeFollowups = false } = {}) {
  state.tasks = state.tasks.filter(task => {
    if (task.subjectId !== subjectId) return true;
    if (task.manual === true) return true;
    if (task.status === "done" && task.type !== "study") return true;
    if (includeFollowups) return false;
    return task.type !== "study";
  });
}

export { todayISO, addDaysISO, daysBetween, isISODate };
