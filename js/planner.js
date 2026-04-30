import { createMissingPatchTasksForAll } from "./patchEngine.js";
import { createMissingReviewTasksForAll } from "./reviewEngine.js";
import { generateStudyTasksForSubject, preserveTaskProgress } from "./taskGenerator.js";
import { getStudyFinishDate, getSubjectTargetDate, normalizeSubjectPlan } from "./state.js";

export function replanSubject(state, subjectId, options = {}) {
  if (!state || !subjectId) return { generated: 0, extras: 0, reason: options.reason || "unknown" };

  state.subjects = Array.isArray(state.subjects) ? state.subjects : [];
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];

  const subjectIndex = state.subjects.findIndex(subject => subject.id === subjectId);
  if (subjectIndex < 0) return { generated: 0, extras: 0, reason: options.reason || "missing-subject" };

  const subject = normalizeSubjectPlan(state.subjects[subjectIndex]);
  state.subjects[subjectIndex] = subject;

  if (!subject.curriculum?.length || !subject.versions?.length) {
    stampPlanMeta(subject, options.reason || "metadata-only", 0);
    return { generated: 0, extras: 0, reason: options.reason || "metadata-only" };
  }

  const oldStudyTasks = state.tasks.filter(task => task.subjectId === subjectId && task.type === "study");
  const generatedStudyTasks = preserveTaskProgress(generateStudyTasksForSubject(subject), oldStudyTasks);

  state.tasks = state.tasks.filter(task => {
    if (task.subjectId !== subjectId) return true;
    if (task.manual === true) return true;
    return task.type !== "study";
  });

  state.tasks.push(...generatedStudyTasks);
  state.tasks = dedupeTasksById(state.tasks);
  cleanupOrphanFollowups(state, subjectId);

  const extras = [
    ...createMissingReviewTasksForAll(state),
    ...createMissingPatchTasksForAll(state)
  ];
  state.tasks.push(...extras);
  state.tasks = dedupeTasksById(state.tasks);

  stampPlanMeta(subject, options.reason || "replan", generatedStudyTasks.length);

  return {
    generated: generatedStudyTasks.length,
    extras: extras.length,
    reason: options.reason || "replan",
    studyFinishDate: subject.planStudyFinishDate,
    targetExamDate: subject.planTargetExamDate
  };
}

export function replanAllSubjects(state, options = {}) {
  const summaries = [];
  for (const subject of state.subjects || []) {
    summaries.push(replanSubject(state, subject.id, options));
  }
  return summaries;
}

export function cleanupOrphanFollowups(state, subjectId = null) {
  const existingTaskIds = new Set((state.tasks || []).map(task => task.id));

  state.tasks = (state.tasks || []).filter(task => {
    if (subjectId && task.subjectId !== subjectId) return true;
    if (task.status === "done") return true;

    if (task.type === "review" && task.basedOnTaskId) {
      return existingTaskIds.has(task.basedOnTaskId);
    }
    if (task.type === "patch" && task.sourceTaskId) {
      return existingTaskIds.has(task.sourceTaskId);
    }
    return true;
  });
}

function stampPlanMeta(subject, reason, generatedCount) {
  const now = new Date().toISOString();
  subject.planUpdatedAt = now;
  subject.planReason = reason;
  subject.planGeneratedTaskCount = generatedCount;
  subject.planTargetExamDate = getSubjectTargetDate(subject);
  subject.planStudyFinishDate = getStudyFinishDate(subject);
  subject.planFingerprint = createSubjectPlanFingerprint(subject);
}

function createSubjectPlanFingerprint(subject) {
  return JSON.stringify({
    id: subject.id,
    name: subject.name,
    examDate: subject.examDate,
    provisionalExamDate: subject.provisionalExamDate,
    examWindowStart: subject.examWindowStart,
    examWindowEnd: subject.examWindowEnd,
    examDateStatus: subject.examDateStatus,
    dailyMinutes: subject.dailyMinutes,
    type: subject.type,
    studyFinishBufferDays: subject.studyFinishBufferDays,
    curriculum: subject.curriculum,
    versions: subject.versions
  });
}

function dedupeTasksById(tasks) {
  const seen = new Set();
  const result = [];

  for (const task of tasks) {
    if (!task?.id) continue;
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    result.push(task);
  }

  return result;
}
