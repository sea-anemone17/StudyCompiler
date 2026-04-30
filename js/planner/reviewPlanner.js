import { REVIEW_RULES } from "../config.js";
import { addDaysISO } from "../core/dateUtils.js";
import { uid } from "../state.js";
import { getSubjectTargetDate } from "./planner.js";

export function shouldCreateReviewsForSubject(subject) {
  return ["memory", "mixed", "problem", "code"].includes(subject?.type || "problem");
}

export function createReviewTasks(completedTask, subject, existingTasks = []) {
  if (!completedTask || completedTask.type !== "study") return [];
  if (!shouldCreateReviewsForSubject(subject)) return [];
  if (String(completedTask.versionId || "").startsWith("R")) return [];
  if (String(completedTask.versionId || "").includes(".5")) return [];
  const completedDate = (completedTask.completedAt || new Date().toISOString()).slice(0, 10);
  const examDate = getSubjectTargetDate(subject);
  return REVIEW_RULES
    .filter(rule => !hasExistingReview(existingTasks, completedTask, rule.id))
    .map((rule, index) => {
      const scheduledDate = addDaysISO(completedDate, rule.offsetDays);
      return {
        id: uid("review"),
        subjectId: completedTask.subjectId,
        conceptId: completedTask.conceptId,
        conceptStableKey: completedTask.conceptStableKey,
        conceptTitle: completedTask.conceptTitle,
        conceptPath: completedTask.conceptPath || [],
        versionId: rule.id,
        versionLabel: rule.label,
        type: "review",
        title: `${completedTask.conceptTitle || completedTask.title} ${rule.id} ${rule.label}`,
        estimatedMinutes: rule.estimatedMinutes || 10,
        plannedMinutes: rule.estimatedMinutes || 10,
        status: "pending",
        priority: 0.5 + index / 10,
        scheduledDate: examDate && scheduledDate > examDate ? examDate : scheduledDate,
        basedOnTaskId: completedTask.id,
        basedOnVersionId: completedTask.versionId,
        reviewRuleId: rule.id,
        createdAt: new Date().toISOString(),
        schedulerVersion: "v4-review"
      };
    });
}

export function createMissingReviewTasksForAll(state) {
  const created = [];
  const subjectsById = new Map((state.subjects || []).map(subject => [subject.id, subject]));
  const doneStudyTasks = (state.tasks || []).filter(task => task.type === "study" && task.status === "done");
  for (const task of doneStudyTasks) {
    const subject = subjectsById.get(task.subjectId);
    const reviews = createReviewTasks(task, subject, state.tasks.concat(created));
    created.push(...reviews);
  }
  return created;
}

function hasExistingReview(existingTasks, sourceTask, ruleId) {
  return existingTasks.some(task =>
    task.type === "review" &&
    task.basedOnTaskId === sourceTask.id &&
    task.reviewRuleId === ruleId
  );
}
