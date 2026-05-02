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
  const preservedDone = tasks.filter(task => task.status === "done" || task.type === "performance");
  const doneOrScheduledPrereqs = new Set(preservedDone.map(task => task.id));
  const schedulable = tasks.filter(task => task.status !== "done" && task.type !== "performance");
  const exploded = SCHEDULER_POLICY.splitLongTasks
    ? explodeOversizedTasks(schedulable, blocks, subjectsById, state.durationProfiles || {})
    : schedulable;

  const prepared = exploded.map(task => {
    const subject = subjectsById.get(task.subjectId);
    const estimate = estimateTaskMinutes(task, state.durationProfiles || {});
    return {
      ...task,
      estimatedMinutes: estimate,
      plannedMinutes: estimate,
      _deadline: getTaskDeadline(task, subject, anchorDate),
      _earliest: getTaskEarliestDate(task, anchorDate),
      _sortOrder: getTaskSortOrder(task, subject, anchorDate)
    };
  });

  const blocksByDate = groupBlocksByDate(blocks);
  const dayTargets = computeBalancedDayTargets({ blocksByDate, tasks: prepared, anchorDate });
  const pending = new Map(prepared.map(task => [task.id, task]));
  const scheduled = [];
  const warnings = [];
  const satisfied = new Set(doneOrScheduledPrereqs);

  for (const [date, dayBlocks] of blocksByDate.entries()) {
    const dayTarget = dayTargets.get(date) || { targetMinutes: 0, maxPlannedMinutes: 0, capacityMinutes: getDayCapacity(dayBlocks) };
    let guard = 0;
    while (guard < 500) {
      guard += 1;
      const dayUsed = getDayUsed(dayBlocks);
      const urgent = hasUrgentCandidate(pending, satisfied, date, dayBlocks);
      if (!urgent && dayUsed >= dayTarget.targetMinutes) break;
      if (dayUsed >= dayTarget.maxPlannedMinutes && !urgent) break;

      const candidate = pickCandidateForDate({ pending, satisfied, date, dayBlocks });
      if (!candidate) break;
      const block = findBestBlockInDay(candidate, dayBlocks);
      if (!block) {
        // 오늘은 조건상 안 들어가므로 뒤 날짜 후보를 기다린다.
        break;
      }
      if (!urgent && dayUsed > 0 && dayUsed + candidate.estimatedMinutes > dayTarget.maxPlannedMinutes) break;

      placeTask(candidate, block);
      scheduled.push(cleanScheduledTask(candidate, block));
      pending.delete(candidate.id);
      satisfied.add(candidate.id);
    }
  }

  for (const task of pending.values()) {
    scheduled.push({
      ...stripPrivateFields(task),
      status: task.status === "deferred" ? "deferred" : "unscheduled",
      scheduledDate: null,
      scheduledBlockId: null,
      scheduledStart: null,
      scheduledEnd: null,
      unscheduledReason: makeUnscheduledReason(task, task.estimatedMinutes, task._earliest, task._deadline)
    });
    warnings.push({
      type: "unscheduled",
      taskId: task.id,
      subjectId: task.subjectId,
      message: `${task.title || task.conceptTitle} 배치 실패 · 필요 ${task.estimatedMinutes}분 · 기한 ${task._deadline}`
    });
  }

  return {
    ...state,
    tasks: [...preservedDone, ...scheduled].sort(sortByDateAndStart),
    studyBlocks: blocks,
    dayTargets: [...dayTargets.values()],
    plannerWarnings: [...(state.plannerWarnings || []).filter(w => w.persist), ...warnings],
    lastPlannedAt: new Date().toISOString()
  };
}

export function getScheduleHorizonEnd(subjects = [], anchorDate = todayISO()) {
  const examDates = subjects.map(getSubjectTargetDate).filter(Boolean).sort();
  if (examDates.length) return examDates[examDates.length - 1];
  return addDaysISO(anchorDate, 30);
}

function groupBlocksByDate(blocks) {
  const map = new Map();
  for (const block of blocks) {
    const list = map.get(block.date) || [];
    list.push(block);
    map.set(block.date, list);
  }
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function computeBalancedDayTargets({ blocksByDate, tasks }) {
  const map = new Map();
  const dates = [...blocksByDate.keys()];
  const activeTasks = tasks.filter(task => task.status !== "deferred");

  const estimatedMinutes = activeTasks
    .map(task => Number(task.estimatedMinutes || 0))
    .filter(Boolean);

  const smallestTaskMinutes = Math.max(
    SCHEDULER_POLICY.minTaskMinutes || 10,
    estimatedMinutes.length
      ? Math.min(...estimatedMinutes, SCHEDULER_POLICY.defaultBlockMinutes)
      : SCHEDULER_POLICY.minTaskMinutes || 10
  );

  const usableDates = dates.filter(date => getDayCapacity(blocksByDate.get(date)) > 0);
  if (!usableDates.length || !activeTasks.length) return map;

  const studyTasks = activeTasks.filter(task => task.type === "study");
  const otherTasks = activeTasks.filter(task => task.type !== "study");

  const studyTotal = studyTasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0);
  const otherTotal = otherTasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0);

  const lastStudyDeadline = studyTasks
    .map(task => task._deadline)
    .filter(Boolean)
    .sort()
    .at(-1);

  const studyDates = lastStudyDeadline
    ? usableDates.filter(date => date <= lastStudyDeadline)
    : usableDates;

  const studyWeights = makeCapacityWeights(studyDates, blocksByDate);
  const otherWeights = makeCapacityWeights(usableDates, blocksByDate);

  const studyWeightSum = studyWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const otherWeightSum = otherWeights.reduce((sum, weight) => sum + weight, 0) || 1;

  usableDates.forEach(date => {
    const blocks = blocksByDate.get(date) || [];
    const capacity = getDayCapacity(blocks);

    const studyIndex = studyDates.indexOf(date);
    const otherIndex = usableDates.indexOf(date);

    const studyTarget = studyIndex >= 0
      ? Math.ceil((studyTotal * studyWeights[studyIndex]) / studyWeightSum)
      : 0;

    const otherTarget = Math.ceil((otherTotal * otherWeights[otherIndex]) / otherWeightSum);

    const rawTarget = studyTarget + otherTarget;
    const target = Math.min(capacity, Math.max(smallestTaskMinutes, rawTarget));

    const maxPlanned = Math.min(
      capacity,
      Math.max(target + SCHEDULER_POLICY.minTaskMinutes, Math.ceil(target * 1.35))
    );

    map.set(date, {
      date,
      capacityMinutes: capacity,
      targetMinutes: target,
      maxPlannedMinutes: maxPlanned
    });
  });

  return map;
}

function makeCapacityWeights(dates, blocksByDate) {
  return dates.map((date, index) => {
    const blocks = blocksByDate.get(date) || [];
    const capacity = getDayCapacity(blocks);
    const ratio = dates.length <= 1 ? 1 : index / (dates.length - 1);
    const timingWeight = ratio < 0.33 ? 0.82 : ratio < 0.72 ? 1.0 : 1.18;
    return Math.max(1, capacity) * timingWeight;
  });
}

function hasUrgentCandidate(pending, satisfied, date, blocks) {
  for (const task of pending.values()) {
    if (task._deadline > date) continue;
    if (!isCandidateReady(task, satisfied, date, blocks)) continue;
    return true;
  }
  return false;
}

function pickCandidateForDate({ pending, satisfied, date, dayBlocks }) {
  const candidates = [...pending.values()]
    .filter(task => isCandidateReady(task, satisfied, date, dayBlocks))
    .sort((a, b) => {
      const urgent = urgencyScore(a, date) - urgencyScore(b, date);
      if (urgent !== 0) return urgent;
      const req = bestRequiredBoost(dayBlocks, a) - bestRequiredBoost(dayBlocks, b);
      if (req !== 0) return req;
      const deadline = String(a._deadline).localeCompare(String(b._deadline));
      if (deadline !== 0) return deadline;
      const order = Number(a._sortOrder || 0) - Number(b._sortOrder || 0);
      if (order !== 0) return order;
      return Number(a.estimatedMinutes || 0) - Number(b.estimatedMinutes || 0);
    });
  return candidates[0] || null;
}

function isCandidateReady(task, satisfied, date, dayBlocks) {
  if (task._earliest && task._earliest > date) return false;
  if (task._deadline && task._deadline < date && task.type === "study") return false;
  if (!prerequisitesSatisfied(task, satisfied)) return false;
  return dayBlocks.some(block => canFitTaskInBlock(task, block));
}

function prerequisitesSatisfied(task, satisfied) {
  return (task.prerequisiteTaskIds || []).every(id => satisfied.has(id));
}

function findBestBlockInDay(task, dayBlocks) {
  return dayBlocks
    .filter(block => canFitTaskInBlock(task, block))
    .sort((a, b) => {
      const required = getRequiredSubjectBoost(a, task) - getRequiredSubjectBoost(b, task);
      if (required !== 0) return required;
      const start = String(a.start || "").localeCompare(String(b.start || ""));
      if (start !== 0) return start;
      const remainingA = Number(a.remainingMinutes ?? a.capacityMinutes ?? a.minutes ?? 0) - Number(task.estimatedMinutes || 0);
      const remainingB = Number(b.remainingMinutes ?? b.capacityMinutes ?? b.minutes ?? 0) - Number(task.estimatedMinutes || 0);
      return remainingA - remainingB;
    })[0] || null;
}

function canFitTaskInBlock(task, block) {
  if (!isBlockCompatibleWithTask(block, task)) return false;
  const remaining = Number(block.remainingMinutes ?? block.capacityMinutes ?? block.minutes ?? 0);
  return remaining + SCHEDULER_POLICY.overflowToleranceMinutes >= Number(task.estimatedMinutes || 0);
}

function placeTask(task, block) {
  const estimate = Number(task.estimatedMinutes || 0);
  const startOffset = block.usedMinutes || 0;
  task.scheduledDate = block.date;
  task.scheduledBlockId = block.id;
  task.scheduledStart = addMinutesToTime(block.start, startOffset);
  task.scheduledEnd = addMinutesToTime(block.start, startOffset + estimate);
  block.usedMinutes = startOffset + estimate;
  block.remainingMinutes = Math.max(0, Number(block.capacityMinutes || block.minutes || 0) - block.usedMinutes);
  block.assignedTaskIds.push(task.id);
}

function cleanScheduledTask(task, block) {
  return {
    ...stripPrivateFields(task),
    status: task.status === "unscheduled" ? "pending" : task.status,
    scheduledDate: task.scheduledDate,
    scheduledBlockId: block.id,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
    dailyCapacityMinutes: block.capacityMinutes,
    schedulerVersion: "v4-balanced-ordered",
    unscheduledReason: null
  };
}

function stripPrivateFields(task) {
  const { _deadline, _earliest, _sortOrder, ...rest } = task;
  return rest;
}

function urgencyScore(task, date) {
  if (task._deadline <= date) return -1000;
  if (task.type === "classReview") return -250;
  if (task.type === "patch") return -180;
  if (task.type === "review") return -120;
  return 0;
}

function bestRequiredBoost(blocks, task) {
  return Math.min(...blocks.map(block => getRequiredSubjectBoost(block, task)), 0);
}

function getTaskDeadline(task, subject, anchorDate) {
  if (task.type === "study") return getSubjectStudyDeadline(subject, anchorDate);
  if (task.type === "classReview") return task.dueDate || task.scheduledDate || addDaysISO(anchorDate, 7);
  if (task.type === "review" || task.type === "patch" || task.type === "finalReview") {
    return getSubjectTargetDate(subject) || task.scheduledDate || addDaysISO(anchorDate, 14);
  }
  return task.dueDate || task.scheduledDate || addDaysISO(anchorDate, 30);
}

function getTaskEarliestDate(task, anchorDate) {
  if (task.earliestDate) return task.earliestDate < anchorDate ? anchorDate : task.earliestDate;
  if (task.scheduledDate && task.type !== "study") return task.scheduledDate < anchorDate ? anchorDate : task.scheduledDate;
  return anchorDate;
}

function getTaskSortOrder(task, subject, anchorDate) {
  const deadline = getTaskDeadline(task, subject, anchorDate);
  const daysUntil = Math.max(0, buildDateRange(anchorDate, deadline).length - 1);
  const typeWeight = task.type === "classReview" ? -50 : task.type === "patch" ? 0 : task.type === "review" ? 15 : task.type === "study" ? 30 : 50;
  const sequence = Number(task.sequenceOrder ?? 999999);
  const priority = Number(task.priority ?? 10) * 3;
  const overdue = task.scheduledDate && task.scheduledDate < anchorDate ? -100 : 0;
  return overdue + typeWeight + daysUntil * 2 + sequence / 1000 + priority;
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
    let previousPartId = null;
    for (let index = 0; index < partCount; index += 1) {
      const partId = `${task.id}__part_${index + 1}`;
      const minutes = index === partCount - 1 ? estimate - partMinutes * (partCount - 1) : partMinutes;
      result.push({
        ...task,
        id: partId,
        parentTaskId: task.id,
        title: `${task.title || task.conceptTitle} (${index + 1}/${partCount})`,
        estimatedMinutes: minutes,
        plannedMinutes: minutes,
        prerequisiteTaskIds: previousPartId ? [previousPartId] : (task.prerequisiteTaskIds || []),
        partIndex: index + 1,
        partCount,
        sequenceOrder: Number(task.sequenceOrder || 0) + index / 100,
        splitReason: `단일 블록 최대 ${maxBlock}분 초과`,
        subjectSnapshotName: subject?.name || ""
      });
      previousPartId = partId;
    }
  }
  return result;
}

function makeUnscheduledReason(task, estimate, earliest, deadline) {
  const prereq = (task.prerequisiteTaskIds || []).length ? " / 선행 태스크 미완료 가능" : "";
  return `가능한 시간 블록이 부족합니다. 필요 ${estimate}분 / 범위 ${earliest}~${deadline}${prereq}`;
}

function getDayCapacity(blocks = []) {
  return blocks.reduce((sum, block) => sum + Number(block.capacityMinutes || block.minutes || 0), 0);
}

function getDayUsed(blocks = []) {
  return blocks.reduce((sum, block) => sum + Number(block.usedMinutes || 0), 0);
}

function sortByDateAndStart(a, b) {
  const da = a.scheduledDate || "9999-12-31";
  const db = b.scheduledDate || "9999-12-31";
  if (da !== db) return da.localeCompare(db);
  const sa = a.scheduledStart || "99:99";
  const sb = b.scheduledStart || "99:99";
  if (sa !== sb) return sa.localeCompare(sb);
  return Number(a.sequenceOrder ?? 999999) - Number(b.sequenceOrder ?? 999999) || String(a.title || "").localeCompare(String(b.title || ""));
}
