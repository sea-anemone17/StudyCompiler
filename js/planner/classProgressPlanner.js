import { CLASS_REVIEW_RULES } from "../config.js";
import { addDaysISO, todayISO } from "../core/dateUtils.js";
import { uid } from "../state.js";

export function createClassProgressItem(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || uid("progress"),
    subjectId: input.subjectId || "",
    date: input.date || todayISO(),
    title: String(input.title || "").trim(),
    type: input.type || "lesson",
    teacherSignal: input.teacherSignal || "medium",
    examLikelihood: input.examLikelihood || "unknown",
    memo: String(input.memo || "").trim(),
    includedInExamRange: Boolean(input.includedInExamRange),
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

export function upsertClassProgress(state, item) {
  if (!Array.isArray(state.classProgress)) state.classProgress = [];
  const normalized = createClassProgressItem(item);
  const index = state.classProgress.findIndex(entry => entry.id === normalized.id);
  if (index >= 0) state.classProgress[index] = { ...state.classProgress[index], ...normalized };
  else state.classProgress.unshift(normalized);
  return normalized;
}

export function removeClassProgress(state, progressId) {
  state.classProgress = (state.classProgress || []).filter(item => item.id !== progressId);
  state.tasks = (state.tasks || []).filter(task => task.sourceProgressId !== progressId || task.status === "done");
}

export function toggleClassProgressExamRange(state, progressId, included) {
  const item = (state.classProgress || []).find(entry => entry.id === progressId);
  if (!item) return;
  item.includedInExamRange = Boolean(included);
  if (included) item.examLikelihood = "confirmed";
  item.updatedAt = new Date().toISOString();
}

export function syncClassProgressTasks(state) {
  if (!Array.isArray(state.classProgress)) state.classProgress = [];
  if (!Array.isArray(state.tasks)) state.tasks = [];

  const oldTasks = state.tasks.filter(task => task.type === "classReview");
  const oldBySignature = new Map(oldTasks.map(task => [classReviewSignature(task), task]));
  const progressIds = new Set(state.classProgress.map(item => item.id));
  const generated = [];

  for (const progress of state.classProgress) {
    if (!progress.subjectId || !progress.title) continue;
    for (const rule of CLASS_REVIEW_RULES) {
      const scheduledDate = addDaysISO(progress.date || todayISO(), rule.offsetDays);
      const raw = {
        id: uid("task"),
        type: "classReview",
        subjectId: progress.subjectId,
        sourceProgressId: progress.id,
        reviewRuleId: rule.id,
        title: `${progress.title} · ${rule.label}`,
        conceptTitle: progress.title,
        versionId: rule.id,
        scheduledDate,
        earliestDate: scheduledDate,
        dueDate: scheduledDate,
        estimatedMinutes: Number(rule.estimatedMinutes || 15),
        plannedMinutes: Number(rule.estimatedMinutes || 15),
        status: "pending",
        priority: getClassProgressPriority(progress, rule),
        teacherSignal: progress.teacherSignal,
        examLikelihood: progress.examLikelihood,
        includedInExamRange: Boolean(progress.includedInExamRange),
        sequenceOrder: -100000 + classProgressPriorityNumber(progress) * -100 + Number(rule.offsetDays || 0),
        createdAt: new Date().toISOString(),
        schedulerVersion: "v4-class-progress"
      };
      const old = oldBySignature.get(classReviewSignature(raw));
      generated.push(old ? preserveClassReview(raw, old) : raw);
    }
  }

  state.tasks = state.tasks.filter(task => {
    if (task.type !== "classReview") return true;
    if (task.status === "done") return true;
    return progressIds.has(task.sourceProgressId) && false;
  });
  state.tasks.push(...generated);
  return generated;
}

function preserveClassReview(next, old) {
  return {
    ...next,
    id: old.id,
    status: old.status,
    completedAt: old.completedAt || null,
    actualMinutes: old.actualMinutes ?? null,
    resultGrade: old.resultGrade || "",
    understandingStage: old.understandingStage || "",
    accuracy: old.accuracy ?? null,
    understanding: old.understanding ?? null,
    notes: old.notes || "",
    scheduledDate: old.status === "done" ? old.scheduledDate : next.scheduledDate,
    scheduledBlockId: old.status === "done" ? old.scheduledBlockId : next.scheduledBlockId,
    scheduledStart: old.status === "done" ? old.scheduledStart : next.scheduledStart,
    scheduledEnd: old.status === "done" ? old.scheduledEnd : next.scheduledEnd
  };
}

function classReviewSignature(task = {}) {
  return [task.subjectId || "", task.sourceProgressId || "", task.reviewRuleId || ""].join("|");
}

function getClassProgressPriority(progress, rule) {
  const base = classProgressPriorityNumber(progress);
  const offset = Number(rule.offsetDays || 0) / 100;
  return Math.max(0, base + offset);
}

function classProgressPriorityNumber(progress = {}) {
  if (progress.includedInExamRange || progress.examLikelihood === "confirmed") return 0;
  if (progress.teacherSignal === "critical") return 0.2;
  if (progress.teacherSignal === "high" || progress.examLikelihood === "likely") return 0.5;
  return 1;
}
