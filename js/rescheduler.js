import { addDaysISO, getStudyFinishDate, getSubjectTargetDate, todayISO } from "./state.js";
import { buildDateRange } from "./scheduler.js";

export function sortTasksForDisplay(tasks = []) {
  return [...tasks]
    .filter(task => task.status !== "deferred")
    .sort((a, b) => {
      const dateA = a.scheduledDate || "9999-12-31";
      const dateB = b.scheduledDate || "9999-12-31";
      const priorityA = getTaskPriority(a);
      const priorityB = getTaskPriority(b);
      return dateA.localeCompare(dateB)
        || priorityA - priorityB
        || String(a.versionId || "").localeCompare(String(b.versionId || ""))
        || String(a.title || "").localeCompare(String(b.title || ""));
    });
}

export function rebuildSchedule(tasks = []) {
  return sortTasksForDisplay(tasks);
}

export function createRebuildPreview(state, anchorDate = todayISO()) {
  const today = anchorDate || todayISO();
  const nextDay = addDaysISO(today, 1);
  const actions = [];
  const updates = new Map();
  const deferred = new Set();
  const doneTasks = state.tasks.filter(task => task.status === "done");
  const movableTasks = state.tasks.filter(task => isStudyLike(task) && task.status !== "done");

  for (const task of doneTasks) {
    if (!isStudyLike(task) || !task.completedAt) continue;
    const completedDate = task.completedAt.slice(0, 10);
    if (task.scheduledDate && task.scheduledDate !== completedDate) {
      updates.set(task.id, { scheduledDate: completedDate });
      actions.push({
        type: "ahead_done",
        taskId: task.id,
        title: task.title,
        from: task.scheduledDate,
        to: completedDate,
        reason: "완료된 날짜로 반영"
      });
    }
  }

  for (const subject of state.subjects || []) {
    const subjectTasks = movableTasks.filter(task => task.subjectId === subject.id);
    if (!subjectTasks.length) continue;

    const used = new Map();
    const sorted = [...subjectTasks].sort((a, b) => {
      const overdueA = a.scheduledDate && a.scheduledDate < today ? 0 : 1;
      const overdueB = b.scheduledDate && b.scheduledDate < today ? 0 : 1;
      return overdueA - overdueB
        || getTaskPriority(a) - getTaskPriority(b)
        || String(a.title).localeCompare(String(b.title));
    });

    for (const task of sorted) {
      const minutes = Math.max(5, Number(task.estimatedMinutes || 30));
      const oldDate = task.scheduledDate;
      const earliest = oldDate && oldDate < today ? today : (oldDate || today);
      const dates = buildDateRange(today, getSchedulingEndDate(subject, task, today));
      const candidateDates = dates.filter(date => date >= earliest);
      const capacity = Math.max(20, Number(subject.dailyMinutes || 120));
      let placedDate = null;

      for (const date of candidateDates) {
        const current = used.get(date) || 0;
        if (current + minutes <= capacity) {
          placedDate = date;
          break;
        }
      }

      if (!placedDate && isLowPriorityShrinkCandidate(task)) {
        deferred.add(task.id);
        actions.push({
          type: "defer_low_priority",
          taskId: task.id,
          title: task.title,
          from: oldDate || "미배정",
          to: "보류",
          reason: "남은 날짜/용량 부족 → 낮은 중요도·심화 태스크 축소"
        });
        continue;
      }

      if (!placedDate) {
        placedDate = candidateDates[candidateDates.length - 1] || dates[dates.length - 1] || nextDay;
      }

      used.set(placedDate, (used.get(placedDate) || 0) + minutes);
      if (oldDate !== placedDate) {
        const reason = oldDate && oldDate < today
          ? "미완료 태스크 이월"
          : oldDate
            ? "남은 날짜 기준 재분배"
            : "미배정 태스크 배치";
        updates.set(task.id, { scheduledDate: placedDate, status: "pending" });
        actions.push({ type: "move", taskId: task.id, title: task.title, from: oldDate || "미배정", to: placedDate, reason });
      }
    }
  }

  const simulatedTasks = state.tasks.map(task => {
    if (deferred.has(task.id)) return { ...task, status: "deferred", scheduledDate: null };
    const update = updates.get(task.id);
    return update ? { ...task, ...update } : task;
  });
  const capacityWarnings = getCapacityWarnings({ ...state, tasks: simulatedTasks });

  return {
    createdAt: new Date().toISOString(),
    anchorDate: today,
    actions,
    updates: [...updates.entries()].map(([taskId, update]) => ({ taskId, ...update })),
    deferredTaskIds: [...deferred],
    capacityWarnings
  };
}

export function applyRebuildPlan(state, plan) {
  const updateMap = new Map((plan?.updates || []).map(item => [item.taskId, item]));
  const deferred = new Set(plan?.deferredTaskIds || []);

  state.tasks = state.tasks.map(task => {
    if (deferred.has(task.id)) {
      return {
        ...task,
        status: "deferred",
        scheduledDate: null,
        deferredAt: new Date().toISOString(),
        deferredReason: "v4.0 자동 재편성: 낮은 중요도·용량 부족"
      };
    }

    const update = updateMap.get(task.id);
    if (!update) return task;
    return {
      ...task,
      scheduledDate: update.scheduledDate,
      status: update.status || task.status || "pending",
      rescheduledAt: new Date().toISOString(),
      schedulerVersion: "v4.0-rebuild"
    };
  });

  return state;
}

export function getCapacityWarnings(state) {
  const warnings = [];
  const subjectsById = new Map((state.subjects || []).map(subject => [subject.id, subject]));
  const subjectDateUsage = new Map();
  const totalDateUsage = new Map();
  const totalDateCapacity = new Map();

  for (const subject of state.subjects || []) {
    const targetDate = getSubjectTargetDate(subject);
    const endDate = targetDate && targetDate >= todayISO() ? targetDate : addDaysISO(todayISO(), 14);
    const dates = buildDateRange(todayISO(), endDate);
    for (const date of dates) {
      totalDateCapacity.set(date, (totalDateCapacity.get(date) || 0) + Math.max(20, Number(subject.dailyMinutes || 120)));
    }
  }

  for (const task of state.tasks || []) {
    if (!task.scheduledDate || task.status === "deferred") continue;
    const minutes = Math.max(0, Number(task.estimatedMinutes || 0));
    const key = `${task.subjectId}::${task.scheduledDate}`;
    subjectDateUsage.set(key, (subjectDateUsage.get(key) || 0) + minutes);
    totalDateUsage.set(task.scheduledDate, (totalDateUsage.get(task.scheduledDate) || 0) + minutes);
  }

  for (const [key, used] of subjectDateUsage.entries()) {
    const [subjectId, date] = key.split("::");
    const subject = subjectsById.get(subjectId);
    const capacity = Math.max(20, Number(subject?.dailyMinutes || 120));
    if (used > capacity) {
      warnings.push({
        scope: "subject",
        date,
        subjectId,
        subjectName: subject?.name || "미지정 과목",
        used,
        capacity,
        message: `${date} ${subject?.name || "과목"}: ${used}분 / ${capacity}분으로 하루 용량 초과`
      });
    }
  }

  for (const [date, used] of totalDateUsage.entries()) {
    const capacity = totalDateCapacity.get(date)
      || [...subjectsById.values()].reduce((sum, subject) => sum + Math.max(20, Number(subject.dailyMinutes || 120)), 0);
    if (capacity && used > capacity) {
      warnings.push({
        scope: "total",
        date,
        used,
        capacity,
        message: `${date} 전체 학습량: ${used}분 / ${capacity}분으로 과밀`
      });
    }
  }

  return warnings.sort((a, b) => a.date.localeCompare(b.date));
}

export function getTaskPriority(task) {
  if (task.status === "deferred") return 999;
  if (task.type === "patch") return 0;
  if (task.type === "review") return 1;
  if (task.scheduledDate && task.scheduledDate < todayISO() && task.status !== "done") return 2;

  const version = String(task.versionId || "");
  if (version === "v0") return 3;
  if (version === "v1") return 4;
  if (version === "v2") return 5;
  if (version === "v3") return 7;
  if (version === "v4") return 8;
  return Number.isFinite(Number(task.priority)) ? Number(task.priority) : 20;
}

function getSchedulingEndDate(subject, task, today) {
  const studyFinishDate = getStudyFinishDate(subject);
  const targetDate = getSubjectTargetDate(subject);

  if (task.type === "study") {
    return studyFinishDate && studyFinishDate >= today ? studyFinishDate : today;
  }

  return targetDate && targetDate >= today ? targetDate : addDaysISO(today, 7);
}

function isStudyLike(task) {
  return ["study", "review", "patch"].includes(task.type);
}

function isLowPriorityShrinkCandidate(task) {
  const version = String(task.versionId || "");
  const importance = String(task.importance || task.conceptImportance || "B").toUpperCase();
  return task.type === "study" && (importance === "C" || ["v3", "v4", "v5"].includes(version));
}
