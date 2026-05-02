import { STUDY_FINISH_BUFFER_DAYS } from "../config.js";
import { addDaysISO, todayISO } from "../core/dateUtils.js";
import { ensureDurationProfiles } from "../core/durationModel.js";
import { createDefaultWeeklyAvailability } from "../core/capacityModel.js";
import { upsertSubject } from "../state.js";
import { generateStudyTasksForSubject, preserveTaskProgress } from "./taskGenerator.js";
import { scheduleTasksForState } from "./scheduleEngine.js";
import { createMissingReviewTasksForAll } from "./reviewPlanner.js";
import { createMissingPatchTasksForAll } from "./patchPlanner.js";
import { syncClassProgressTasks } from "./classProgressPlanner.js";

export function normalizeStateForPlanning(state) {
  if (!state.weeklyAvailability) state.weeklyAvailability = createDefaultWeeklyAvailability();
  if (!state.dateOverrides || typeof state.dateOverrides !== "object") state.dateOverrides = {};
  ensureDurationProfiles(state);
  if (!Array.isArray(state.classProgress)) state.classProgress = [];
  if (!Array.isArray(state.plannerWarnings)) state.plannerWarnings = [];
  return state;
}

export function replanSubject(state, subjectId, options = {}) {
  normalizeStateForPlanning(state);
  const subject = state.subjects.find(item => item.id === subjectId);
  if (!subject) return state;
  if (!subject.curriculum?.length || !subject.versions?.length) {
    return scheduleAllPending(state, options);
  }

  const oldSubjectTasks = (state.tasks || []).filter(task => task.subjectId === subjectId && task.type === "study");
  const generated = generateStudyTasksForSubject(subject, { schedule: false });
  const preserved = preserveTaskProgress(generated, oldSubjectTasks);

  state.tasks = (state.tasks || []).filter(task => {
    if (task.subjectId !== subjectId) return true;
    if (task.manual === true) return true;
    if (task.status === "done" && task.type !== "study") return true;
    return task.type !== "study";
  });

  state.tasks.push(...preserved);
  syncClassProgressTasks(state);
  attachFollowups(state);
  subject.planUpdatedAt = new Date().toISOString();
  subject.planFingerprint = createSubjectPlanFingerprint(subject);
  return scheduleAllPending(state, options);
}

export function replanAll(state, options = {}) {
  normalizeStateForPlanning(state);
  const subjectIds = (state.subjects || []).map(subject => subject.id);
  for (const subjectId of subjectIds) {
    const subject = state.subjects.find(item => item.id === subjectId);
    if (!subject?.curriculum?.length || !subject?.versions?.length) continue;
    const oldSubjectTasks = (state.tasks || []).filter(task => task.subjectId === subjectId && task.type === "study");
    const generated = generateStudyTasksForSubject(subject, { schedule: false });
    const preserved = preserveTaskProgress(generated, oldSubjectTasks);
    state.tasks = (state.tasks || []).filter(task => task.subjectId !== subjectId || task.type !== "study" || task.manual === true);
    state.tasks.push(...preserved);
  }
  syncClassProgressTasks(state);
  attachFollowups(state);
  return scheduleAllPending(state, options);
}

export function scheduleAllPending(state, options = {}) {
  normalizeStateForPlanning(state);
  syncClassProgressTasks(state);
  return scheduleTasksForState(state, options);
}

export function saveSubjectAndReplan(state, subject, options = {}) {
  upsertSubject(state, subject);
  return replanSubject(state, subject.id, options);
}

export function attachFollowups(state) {
  const reviews = createMissingReviewTasksForAll(state);
  const patches = createMissingPatchTasksForAll({ ...state, tasks: state.tasks.concat(reviews) });
  state.tasks.push(...reviews, ...patches);
  cleanupOrphanFollowups(state);
  return { reviews, patches };
}

export function cleanupOrphanFollowups(state) {
  const taskIds = new Set((state.tasks || []).map(task => task.id));
  state.tasks = (state.tasks || []).filter(task => {
    if (task.status === "done") return true;
    if (task.type === "review" && task.basedOnTaskId) return taskIds.has(task.basedOnTaskId);
    if (task.type === "patch" && task.sourceTaskId) return taskIds.has(task.sourceTaskId);
    return true;
  });
}

export function getSubjectTargetDate(subject = {}) {
  if (subject.examDateStatus === "confirmed" && subject.examDate) return subject.examDate;
  if (subject.examDate) return subject.examDate;
  if (subject.provisionalExamDate) return subject.provisionalExamDate;
  if (subject.examWindowStart) return subject.examWindowStart;
  return todayISO();
}

export function getSubjectStudyDeadline(subject = {}, anchorDate = todayISO()) {
  const target = getSubjectTargetDate(subject) || anchorDate;
  const buffer = Number(subject.studyFinishBufferDays ?? STUDY_FINISH_BUFFER_DAYS);
  const deadline = subject.allowRegularStudyOnExamDay ? target : addDaysISO(target, -Math.max(0, buffer));
  return deadline < anchorDate ? anchorDate : deadline;
}

export function createSubjectPlanFingerprint(subject = {}) {
  return JSON.stringify({
    examDate: subject.examDate || null,
    examDateStatus: subject.examDateStatus || null,
    provisionalExamDate: subject.provisionalExamDate || null,
    examWindowStart: subject.examWindowStart || null,
    examWindowEnd: subject.examWindowEnd || null,
    studyFinishBufferDays: subject.studyFinishBufferDays ?? STUDY_FINISH_BUFFER_DAYS,
    type: subject.type || null,
    versions: (subject.versions || []).map(v => [v.id, v.label, v.estimatedMinutes]),
    curriculum: (subject.curriculum || []).map(n => [n.title, n.parentId, n.importance, n.targetVersions])
  });
}

export function stableTaskSignature(task = {}) {
  return [
    task.subjectId || "",
    task.conceptStableKey || (task.conceptPath || []).join(" > ") || task.conceptTitle || "",
    task.versionId || "",
    task.type || "study",
    task.partIndex || ""
  ].join("|");
}
