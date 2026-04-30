import { SCHEDULER_POLICY } from "../config.js";
import { addDaysISO, addMinutesToTime, buildDateRange, todayISO } from "../core/dateUtils.js";
import { expandStudyBlocks, getRequiredSubjectBoost, isBlockCompatibleWithTask } from "../core/capacityModel.js";
import { estimateTaskMinutes } from "../core/durationModel.js";
import { getSubjectStudyDeadline, getSubjectTargetDate } from "./planner.js";

export function scheduleTasksForState(state, options = {}) {
  const anchorDate = options.anchorDate || todayISO();
  const subjects = state.subjects || [];
  const tasks = state.tasks || [];
  const horizonEnd = options.endDate || getScheduleHorizonEnd(subjects, anchorDate);
  const blocks = expandStudyBlocks({
    weeklyAvailability: state.weeklyAvailability,
    dateOverrides: state.dateOverrides,
    startDate: anchorDate,
    endDate: horizonEnd
  });

  const subjectsById = new Map(subjects.map(subject => [subject.id, subject]));
  const preservedDone = tasks.filter(task => task.status === "done");
  const schedulable = tasks.filter(task => task.status !== "done" && task.type !== "performance");
  const exploded = SCHEDULER_POLICY.splitLongTasks
    ? explodeOversizedTasks(schedulable, blocks, subjectsById, state.durationProfiles || {})
    : schedulable;
  const sorted = [...exploded].sort((a, b) => taskSortScore(a, subjectsById, anchorDate) - taskSortScore(b, subjectsById, anchorDate));
  const scheduled = [];
  const warnings = [];

  for (const task of sorted) {
    const subject = subjectsById.get(task.subjectId);
    const estimate = estimateTaskMinutes(task, state.durationProfiles || {});
    const deadline = getTaskDeadline(task, subject, anchorDate);
    const earliest = getTaskEarliestDate(task, anchorDate);
    const candidate = findBestBlock({ task, estimate, blocks, earliest, deadline });

    if (!candidate) {
      scheduled.push({
        ...task,
        estimatedMinutes: estimate,
        plannedMinutes: estimate,
        status: task.status === "deferred" ? "deferred" : "unscheduled",
        scheduledDate: null,
        scheduledBlockId: null,
        unscheduledReason: makeUnscheduledReason(task, estimate, earliest, deadline)
      });
      warnings.push({
        type: "unscheduled",
        taskId: task.id,
        subjectId: task.subjectId,
        message: `${task.title || task.conceptTitle} 배치 실패 · 필요 ${estimate}분 · 기한 ${deadline}`
      });
      continue;
    }

    const startOffset = candidate.usedMinutes || 0;
    const scheduledStart = addMinutesToTime(candidate.start, startOffset);
    const scheduledEnd = addMinutesToTime(candidate.start, startOffset + estimate);
    candidate.usedMinutes = startOffset + estimate;
    candidate.remainingMinutes = Math.max(0, Number(candidate.capacityMinutes || candidate.minutes || 0) - candidate.usedMinutes);
    candidate.assignedTaskIds.push(task.id);

    scheduled.push({
      ...task,
      status: task.status === "unscheduled" ? "pending" : task.status,
      estimatedMinutes: estimate,
      plannedMinutes: estimate,
      scheduledDate: candidate.date,
      scheduledBlockId: candidate.id,
      scheduledStart,
      scheduledEnd,
      dailyCapacityMinutes: candidate.capacityMinutes,
      schedulerVersion: "v4-block-constraint",
      unscheduledReason: null
    });
  }

  return {
    ...state,
    tasks: [...preservedDone, ...scheduled].sort(sortByDateAndStart),
    studyBlocks: blocks,
    plannerWarnings: [...(state.plannerWarnings || []).filter(w => w.persist), ...warnings],
    lastPlannedAt: new Date().toISOString()
  };
}

export function getScheduleHorizonEnd(subjects = [], anchorDate = todayISO()) {
  const examDates = subjects.map(getSubjectTargetDate).filter(Boolean).sort();
  if (examDates.length) return examDates[examDates.length - 1];
  return addDaysISO(anchorDate, 30);
}

function findBestBlock({ task, estimate, blocks, earliest, deadline }) {
  const compatible = blocks
    .filter(block => block.date >= earliest && block.date <= deadline)
    .filter(block => isBlockCompatibleWithTask(block, task))
    .filter(block => Number(block.remainingMinutes ?? block.capacityMinutes ?? block.minutes ?? 0) + SCHEDULER_POLICY.overflowToleranceMinutes >= estimate)
    .sort((a, b) => {
      const required = getRequiredSubjectBoost(a, task) - getRequiredSubjectBoost(b, task);
      if (required !== 0) return required;
      const date = a.date.localeCompare(b.date);
      if (date !== 0) return date;
      const remainingA = Number(a.remainingMinutes ?? a.capacityMinutes ?? a.minutes ?? 0) - estimate;
      const remainingB = Number(b.remainingMinutes ?? b.capacityMinutes ?? b.minutes ?? 0) - estimate;
      return remainingA - remainingB;
    });
  return compatible[0] || null;
}

function getTaskDeadline(task, subject, anchorDate) {
  if (task.type === "study") return getSubjectStudyDeadline(subject, anchorDate);
  if (task.type === "review" || task.type === "patch" || task.type === "finalReview") {
    return getSubjectTargetDate(subject) || task.scheduledDate || addDaysISO(anchorDate, 14);
  }
  return task.dueDate || task.scheduledDate || addDaysISO(anchorDate, 30);
}

function getTaskEarliestDate(task, anchorDate) {
  if (task.scheduledDate && task.type !== "study") return task.scheduledDate < anchorDate ? anchorDate : task.scheduledDate;
  return anchorDate;
}

function taskSortScore(task, subjectsById, anchorDate) {
  const subject = subjectsById.get(task.subjectId);
  const deadline = getTaskDeadline(task, subject, anchorDate);
  const daysUntil = Math.max(0, buildDateRange(anchorDate, deadline).length - 1);
  const typeWeight = task.type === "patch" ? 0 : task.type === "review" ? 15 : task.type === "study" ? 30 : 50;
  const priority = Number(task.priority ?? 10) * 3;
  const overdue = task.scheduledDate && task.scheduledDate < anchorDate ? -100 : 0;
  return overdue + typeWeight + daysUntil * 2 + priority;
}

function explodeOversizedTasks(tasks, blocks, subjectsById, durationProfiles) {
  if (!blocks.length) return tasks;
  const result = [];
  for (const task of tasks) {
    const subject = subjectsById.get(task.subjectId);
    const compatibleBlockMinutes = blocks
      .filter(block => isBlockCompatibleWithTask(block, task))
      .map(block => Number(block.capacityMinutes || block.minutes || 0))
      .filter(Boolean);
    const maxBlock = Math.max(...compatibleBlockMinutes, SCHEDULER_POLICY.defaultBlockMinutes);
    const estimate = estimateTaskMinutes(task, durationProfiles);
    if (estimate <= maxBlock || task.parentTaskId) {
      result.push({ ...task, estimatedMinutes: estimate, plannedMinutes: estimate });
      continue;
    }
    const partCount = Math.ceil(estimate / maxBlock);
    const partMinutes = Math.ceil(estimate / partCount);
    for (let index = 0; index < partCount; index += 1) {
      result.push({
        ...task,
        id: `${task.id}__part_${index + 1}`,
        parentTaskId: task.id,
        title: `${task.title || task.conceptTitle} (${index + 1}/${partCount})`,
        estimatedMinutes: index === partCount - 1 ? estimate - partMinutes * (partCount - 1) : partMinutes,
        plannedMinutes: index === partCount - 1 ? estimate - partMinutes * (partCount - 1) : partMinutes,
        partIndex: index + 1,
        partCount,
        splitReason: `단일 블록 최대 ${maxBlock}분 초과`,
        subjectSnapshotName: subject?.name || ""
      });
    }
  }
  return result;
}

function makeUnscheduledReason(task, estimate, earliest, deadline) {
  return `가능한 시간 블록이 부족합니다. 필요 ${estimate}분 / 범위 ${earliest}~${deadline}`;
}

function sortByDateAndStart(a, b) {
  const da = a.scheduledDate || "9999-12-31";
  const db = b.scheduledDate || "9999-12-31";
  if (da !== db) return da.localeCompare(db);
  const sa = a.scheduledStart || "99:99";
  const sb = b.scheduledStart || "99:99";
  if (sa !== sb) return sa.localeCompare(sb);
  return String(a.title || "").localeCompare(String(b.title || ""));
}
