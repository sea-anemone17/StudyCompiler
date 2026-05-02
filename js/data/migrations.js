import { CURRENT_SCHEMA_VERSION } from "../config.js";
import { createEmptyState } from "../state.js";
import { createDefaultWeeklyAvailability } from "../core/capacityModel.js";
import { normalizeTaskOutcome } from "../core/scoreModel.js";

export function migrateState(state) {
  const base = createEmptyState();
  const subjects = Array.isArray(state?.subjects) ? state.subjects.map(migrateSubject) : [];
  const tasks = Array.isArray(state?.tasks) ? state.tasks.map(migrateTask) : [];
  const performanceItems = Array.isArray(state?.performanceItems) ? state.performanceItems : [];
  const classProgress = Array.isArray(state?.classProgress) ? state.classProgress.map(migrateClassProgress) : [];
  return {
    ...base,
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    subjects,
    activeSubjectId: state?.activeSubjectId || subjects[0]?.id || null,
    tasks,
    performanceItems,
    classProgress,
    weeklyAvailability: Array.isArray(state?.weeklyAvailability) ? state.weeklyAvailability : createDefaultWeeklyAvailability(),
    dateOverrides: state?.dateOverrides && typeof state.dateOverrides === "object" ? state.dateOverrides : {},
    durationProfiles: state?.durationProfiles && typeof state.durationProfiles === "object" ? state.durationProfiles : {},
    plannerWarnings: Array.isArray(state?.plannerWarnings) ? state.plannerWarnings : [],
    syncMeta: state?.syncMeta && typeof state.syncMeta === "object" ? state.syncMeta : {}
  };
}

export function migrateSubject(subject = {}) {
  return {
    dailyMinutes: 120,
    type: "problem",
    curriculum: [],
    versions: [],
    examDateStatus: subject.examDate ? "estimated" : "unknown",
    provisionalExamDate: subject.provisionalExamDate || "",
    examWindowStart: subject.examWindowStart || "",
    examWindowEnd: subject.examWindowEnd || "",
    studyFinishBufferDays: Number(subject.studyFinishBufferDays ?? 7),
    allowRegularStudyOnExamDay: Boolean(subject.allowRegularStudyOnExamDay),
    planningMode: subject.planningMode || "examRange",
    ...subject
  };
}

export function migrateTask(task = {}) {
  const outcome = normalizeTaskOutcome(task);
  return {
    type: "study",
    status: "pending",
    estimatedMinutes: 30,
    plannedMinutes: Number(task.plannedMinutes || task.estimatedMinutes || 30),
    priority: getDefaultPriority(task),
    actualMinutes: task.actualMinutes ?? null,
    accuracy: outcome.accuracy,
    understanding: outcome.understanding,
    resultGrade: outcome.resultGrade || "",
    understandingStage: outcome.understandingStage || "",
    notes: task.notes || "",
    completedAt: task.completedAt || null,
    scheduledBlockId: task.scheduledBlockId || null,
    scheduledStart: task.scheduledStart || null,
    scheduledEnd: task.scheduledEnd || null,
    unscheduledReason: task.unscheduledReason || null,
    ...task,
    schedulerVersion: task.schedulerVersion || "legacy"
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


export function migrateClassProgress(item = {}) {
  return {
    id: item.id || "",
    subjectId: item.subjectId || "",
    date: item.date || "",
    title: item.title || "",
    type: item.type || "lesson",
    teacherSignal: item.teacherSignal || "medium",
    examLikelihood: item.examLikelihood || "unknown",
    memo: item.memo || "",
    includedInExamRange: Boolean(item.includedInExamRange),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
  };
}
