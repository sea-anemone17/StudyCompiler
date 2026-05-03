import {
  CLASS_REVIEW_RULES,
  CLASS_PROGRESS_REVIEW_RULE_IDS_BY_LEVEL,
  CLASS_PROGRESS_STUDY_TEMPLATES,
  CLASS_PROGRESS_EXAM_PREP_TEMPLATES
} from "../config.js";
import { addDaysISO, todayISO } from "../core/dateUtils.js";
import { uid } from "../state.js";

const GENERATED_TYPES = new Set(["classReview", "classStudy", "classExamPrep"]);
const STUDY_LEVELS = new Set(["recordOnly", "reviewOnly", "examCandidate", "confirmedExam"]);

export function createClassProgressItem(input = {}) {
  const now = new Date().toISOString();
  const includedInExamRange = Boolean(input.includedInExamRange) || input.examLikelihood === "confirmed";
  const studyPlanLevel = normalizeStudyPlanLevel(input.studyPlanLevel, {
    includedInExamRange,
    teacherSignal: input.teacherSignal,
    examLikelihood: input.examLikelihood
  });
  return {
    id: input.id || uid("progress"),
    subjectId: input.subjectId || "",
    date: input.date || todayISO(),
    title: String(input.title || "").trim(),
    type: input.type || "lesson",
    teacherSignal: input.teacherSignal || "medium",
    examLikelihood: includedInExamRange ? "confirmed" : (input.examLikelihood || "unknown"),
    memo: String(input.memo || "").trim(),
    includedInExamRange,
    studyPlanLevel,
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
  if (included) {
    item.examLikelihood = "confirmed";
    item.studyPlanLevel = "confirmedExam";
  } else {
    item.examLikelihood = item.examLikelihood === "confirmed" ? "likely" : item.examLikelihood;
    item.studyPlanLevel = inferStudyPlanLevel(item);
  }
  item.updatedAt = new Date().toISOString();
}

export function syncClassProgressTasks(state) {
  if (!Array.isArray(state.classProgress)) state.classProgress = [];
  if (!Array.isArray(state.tasks)) state.tasks = [];

  const oldTasks = state.tasks.filter(task => isClassProgressGeneratedTask(task));
  const oldBySignature = new Map(oldTasks.map(task => [classProgressTaskSignature(task), task]));
  const generated = [];

  for (const progress of state.classProgress) {
    if (!progress.subjectId || !progress.title) continue;
    const normalizedProgress = createClassProgressItem(progress);
    Object.assign(progress, normalizedProgress);

    generated.push(...createReviewTasksForProgress(progress, oldBySignature));
    generated.push(...createStudyTasksForProgress(progress, state, oldBySignature));
    generated.push(...createExamPrepTasksForProgress(progress, state, oldBySignature));
  }

  const generatedSignatures = new Set(generated.map(classProgressTaskSignature));
  state.tasks = state.tasks.filter(task => {
    if (!isClassProgressGeneratedTask(task)) return true;
    // 같은 signature의 generated 태스크가 있으면 preserve된 새 태스크로 대체한다.
    if (generatedSignatures.has(classProgressTaskSignature(task))) return false;
    // 삭제된 진도의 완료 기록은 남겨서 학습 이력을 잃지 않는다.
    return task.status === "done";
  });
  state.tasks.push(...generated);
  return generated;
}

function createReviewTasksForProgress(progress, oldBySignature) {
  const level = normalizeStudyPlanLevel(progress.studyPlanLevel, progress);
  const allowedRuleIds = CLASS_PROGRESS_REVIEW_RULE_IDS_BY_LEVEL[level] || [];
  const rules = CLASS_REVIEW_RULES.filter(rule => allowedRuleIds.includes(rule.id));
  return rules.map(rule => {
    const scheduledDate = addDaysISO(progress.date || todayISO(), Number(rule.offsetDays || 0));
    const dueDate = addDaysISO(progress.date || todayISO(), Number(rule.dueOffsetDays ?? rule.offsetDays ?? 0));
    const raw = {
      id: uid("task"),
      type: "classReview",
      subjectId: progress.subjectId,
      sourceProgressId: progress.id,
      generatedFromClassProgress: true,
      reviewRuleId: rule.id,
      classTaskKind: "review",
      studyPlanLevel: level,
      title: `${progress.title} · ${rule.label}`,
      conceptTitle: progress.title,
      versionId: rule.id,
      scheduledDate,
      earliestDate: scheduledDate,
      dueDate,
      estimatedMinutes: Number(rule.estimatedMinutes || 15),
      plannedMinutes: Number(rule.estimatedMinutes || 15),
      status: "pending",
      priority: getClassProgressPriority(progress, rule),
      teacherSignal: progress.teacherSignal,
      examLikelihood: progress.examLikelihood,
      includedInExamRange: Boolean(progress.includedInExamRange),
      sequenceOrder: -100000 + classProgressPriorityNumber(progress) * -100 + Number(rule.offsetDays || 0),
      createdAt: new Date().toISOString(),
      schedulerVersion: "v4.3-class-progress"
    };
    return preserveClassProgressTask(raw, oldBySignature.get(classProgressTaskSignature(raw)));
  });
}

function createStudyTasksForProgress(progress, state, oldBySignature) {
  const level = normalizeStudyPlanLevel(progress.studyPlanLevel, progress);
  if (!["examCandidate", "confirmedExam"].includes(level)) return [];

  const templates = getStudyTemplates(progress.type);
  const result = [];
  let previousTaskId = null;

  templates.forEach((template, index) => {
    const scheduledDate = addDaysISO(progress.date || todayISO(), Math.min(index + 1, 4));
    const dueDate = getStudyDueDate(progress, state, index);
    const raw = {
      id: uid("task"),
      type: "classStudy",
      subjectId: progress.subjectId,
      sourceProgressId: progress.id,
      generatedFromClassProgress: true,
      classTaskKind: template.id,
      studyPlanLevel: level,
      title: `${progress.title} · ${template.label}`,
      conceptTitle: progress.title,
      versionId: `CS-${template.id}`,
      scheduledDate,
      earliestDate: progress.date || todayISO(),
      dueDate,
      estimatedMinutes: Number(template.estimatedMinutes || 20),
      plannedMinutes: Number(template.estimatedMinutes || 20),
      status: "pending",
      priority: level === "confirmedExam" ? 0.35 : 0.75,
      teacherSignal: progress.teacherSignal,
      examLikelihood: progress.examLikelihood,
      includedInExamRange: Boolean(progress.includedInExamRange),
      prerequisiteTaskIds: previousTaskId ? [previousTaskId] : [],
      sequenceOrder: -90000 + classProgressPriorityNumber(progress) * -100 + index,
      createdAt: new Date().toISOString(),
      schedulerVersion: "v4.3-class-progress"
    };
    const next = preserveClassProgressTask(raw, oldBySignature.get(classProgressTaskSignature(raw)));
    if (previousTaskId) next.prerequisiteTaskIds = [previousTaskId];
    previousTaskId = next.id;
    result.push(next);
  });

  return result;
}

function createExamPrepTasksForProgress(progress, state, oldBySignature) {
  const level = normalizeStudyPlanLevel(progress.studyPlanLevel, progress);
  if (level !== "confirmedExam") return [];

  const subject = getSubject(state, progress.subjectId);
  const targetDate = getSubjectTargetDateLocal(subject);
  const templates = CLASS_PROGRESS_EXAM_PREP_TEMPLATES.default || [];
  return templates.map((template, index) => {
    const scheduledDate = targetDate ? addDaysISO(targetDate, -Math.max(2, 5 - index)) : addDaysISO(progress.date || todayISO(), 7 + index);
    const dueDate = targetDate ? addDaysISO(targetDate, -1) : addDaysISO(progress.date || todayISO(), 10 + index);
    const raw = {
      id: uid("task"),
      type: "classExamPrep",
      subjectId: progress.subjectId,
      sourceProgressId: progress.id,
      generatedFromClassProgress: true,
      classTaskKind: template.id,
      studyPlanLevel: level,
      title: `${progress.title} · ${template.label}`,
      conceptTitle: progress.title,
      versionId: `CE-${template.id}`,
      scheduledDate,
      earliestDate: progress.date || todayISO(),
      dueDate,
      estimatedMinutes: Number(template.estimatedMinutes || 20),
      plannedMinutes: Number(template.estimatedMinutes || 20),
      status: "pending",
      priority: 0.2,
      teacherSignal: progress.teacherSignal,
      examLikelihood: progress.examLikelihood,
      includedInExamRange: true,
      sequenceOrder: -85000 + index,
      createdAt: new Date().toISOString(),
      schedulerVersion: "v4.3-class-progress"
    };
    return preserveClassProgressTask(raw, oldBySignature.get(classProgressTaskSignature(raw)));
  });
}

function preserveClassProgressTask(next, old) {
  if (!old) return next;
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

function classProgressTaskSignature(task = {}) {
  return [
    task.subjectId || "",
    task.sourceProgressId || "",
    task.type || "",
    task.reviewRuleId || task.classTaskKind || task.versionId || ""
  ].join("|");
}

function isClassProgressGeneratedTask(task = {}) {
  return GENERATED_TYPES.has(task.type) || Boolean(task.generatedFromClassProgress);
}

function getStudyTemplates(type) {
  return CLASS_PROGRESS_STUDY_TEMPLATES[type] || CLASS_PROGRESS_STUDY_TEMPLATES.default || [];
}

function normalizeStudyPlanLevel(value, progress = {}) {
  if (STUDY_LEVELS.has(value)) return value;
  return inferStudyPlanLevel(progress);
}

function inferStudyPlanLevel(progress = {}) {
  if (progress.includedInExamRange || progress.examLikelihood === "confirmed") return "confirmedExam";
  if (progress.teacherSignal === "critical") return "confirmedExam";
  if (progress.teacherSignal === "high" || progress.examLikelihood === "likely") return "examCandidate";
  return "reviewOnly";
}

function getClassProgressPriority(progress, rule) {
  const base = classProgressPriorityNumber(progress);
  const offset = Number(rule.offsetDays || 0) / 100;
  return Math.max(0, base + offset);
}

function classProgressPriorityNumber(progress = {}) {
  if (progress.includedInExamRange || progress.examLikelihood === "confirmed" || progress.studyPlanLevel === "confirmedExam") return 0;
  if (progress.teacherSignal === "critical") return 0.2;
  if (progress.teacherSignal === "high" || progress.examLikelihood === "likely" || progress.studyPlanLevel === "examCandidate") return 0.5;
  if (progress.studyPlanLevel === "recordOnly") return 2;
  return 1;
}

function getSubject(state, subjectId) {
  return (state.subjects || []).find(subject => subject.id === subjectId);
}

function getSubjectTargetDateLocal(subject = {}) {
  if (!subject) return null;
  if (subject.examDateStatus === "confirmed" && subject.examDate) return subject.examDate;
  if (subject.examDate) return subject.examDate;
  if (subject.provisionalExamDate) return subject.provisionalExamDate;
  if (subject.examWindowStart) return subject.examWindowStart;
  return null;
}

function getStudyDueDate(progress, state, index) {
  const subject = getSubject(state, progress.subjectId);
  const targetDate = getSubjectTargetDateLocal(subject);
  if (progress.studyPlanLevel === "confirmedExam" && targetDate) {
    const due = addDaysISO(targetDate, -Math.max(3, 7 - index));
    return due < (progress.date || todayISO()) ? addDaysISO(progress.date || todayISO(), 5 + index) : due;
  }
  return addDaysISO(progress.date || todayISO(), 7 + index);
}
