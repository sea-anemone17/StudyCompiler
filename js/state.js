import { CURRENT_SCHEMA_VERSION } from "./config.js";

export const DEFAULT_STUDY_FINISH_BUFFER_DAYS = 7;

export function createEmptyState() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activeSubjectId: null,
    subjects: [],
    tasks: [],
    performanceItems: [],
    syncMeta: {
      localUpdatedAt: null,
      lastPulledAt: null,
      lastPushedAt: null
    }
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
  const normalized = normalizeSubjectPlan(subject);
  const index = state.subjects.findIndex(item => item.id === normalized.id);
  const now = new Date().toISOString();

  if (index >= 0) {
    state.subjects[index] = {
      ...state.subjects[index],
      ...normalized,
      updatedAt: now
    };
  } else {
    state.subjects.push({
      ...normalized,
      createdAt: now,
      updatedAt: now
    });
  }

  state.activeSubjectId = normalized.id;
}

export function removeSubjectTasks(state, subjectId) {
  state.tasks = state.tasks.filter(task => task.subjectId !== subjectId || task.manual === true || task.type !== "study");
}

export function normalizeSubjectPlan(subject = {}) {
  const examDate = isISODate(subject.examDate) ? subject.examDate : todayISO();
  const provisionalExamDate = isISODate(subject.provisionalExamDate)
    ? subject.provisionalExamDate
    : examDate;
  const examWindowStart = isISODate(subject.examWindowStart) ? subject.examWindowStart : "";
  const examWindowEnd = isISODate(subject.examWindowEnd) ? subject.examWindowEnd : "";
  const rawStatus = String(subject.examDateStatus || "estimated");
  const examDateStatus = ["unknown", "estimated", "confirmed"].includes(rawStatus)
    ? rawStatus
    : "estimated";
  const buffer = Number(subject.studyFinishBufferDays ?? DEFAULT_STUDY_FINISH_BUFFER_DAYS);

  return {
    ...subject,
    examDate,
    provisionalExamDate,
    examWindowStart,
    examWindowEnd,
    examDateStatus,
    studyFinishBufferDays: Number.isFinite(buffer) ? Math.max(0, Math.floor(buffer)) : DEFAULT_STUDY_FINISH_BUFFER_DAYS,
    allowRegularStudyOnExamDay: subject.allowRegularStudyOnExamDay === true
  };
}

export function getSubjectTargetDate(subject = {}) {
  const normalized = normalizeSubjectPlan(subject);

  if (normalized.examDateStatus === "confirmed" && isISODate(normalized.examDate)) {
    return normalized.examDate;
  }

  if (isISODate(normalized.provisionalExamDate)) {
    return normalized.provisionalExamDate;
  }

  if (isISODate(normalized.examWindowStart)) {
    return normalized.examWindowStart;
  }

  return normalized.examDate || todayISO();
}

export function getStudyFinishDate(subject = {}) {
  const normalized = normalizeSubjectPlan(subject);
  const targetDate = getSubjectTargetDate(normalized);
  const bufferDays = normalized.allowRegularStudyOnExamDay
    ? 0
    : Number(normalized.studyFinishBufferDays ?? DEFAULT_STUDY_FINISH_BUFFER_DAYS);

  if (!isISODate(targetDate)) return todayISO();
  return addDaysISO(targetDate, -Math.max(0, bufferDays));
}

export function formatDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateOnly(dateISO) {
  if (!isISODate(dateISO)) return null;
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function todayISO() {
  return formatDateOnly(new Date());
}

export function addDaysISO(dateISO, amount) {
  const date = parseDateOnly(dateISO) || parseDateOnly(todayISO()) || new Date();
  date.setDate(date.getDate() + Number(amount || 0));
  return formatDateOnly(date);
}

export function daysBetween(fromISO, toISO) {
  const from = parseDateOnly(fromISO);
  const to = parseDateOnly(toISO);
  if (!from || !to) return NaN;
  return Math.ceil((to - from) / 86400000);
}

export function isISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function markLocalUpdated(state) {
  state.syncMeta = {
    ...(state.syncMeta || {}),
    localUpdatedAt: new Date().toISOString()
  };
  return state;
}
