import { todayISO } from "../core/dateUtils.js";

const RECOVERABLE_STATUSES = new Set(["pending", "inProgress", "unscheduled"]);

export function normalizePastUnresolvedTasks(state, anchorDate = todayISO()) {
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];

  state.tasks = tasks.map(task => {
    if (!shouldMarkForRecovery(task, anchorDate)) return task;

    const originalDate = task.scheduledDate;

    return {
      ...task,
      status: "pending",
      recoveryStatus: task.recoveryStatus || "needsReview",
      recoveryOriginalDate: task.recoveryOriginalDate || originalDate,
      recoveryCreatedAt: task.recoveryCreatedAt || new Date().toISOString(),

      scheduledDate: null,
      scheduledBlockId: null,
      scheduledStart: null,
      scheduledEnd: null,

      lastTouchedAt: new Date().toISOString()
    };
  });

  return state;
}

function shouldMarkForRecovery(task, anchorDate) {
  if (!task) return false;
  if (task.type === "performance") return false;
  if (!RECOVERABLE_STATUSES.has(task.status)) return false;
  if (!task.scheduledDate) return false;
  if (task.scheduledDate >= anchorDate) return false;
  if (task.recoveryStatus === "resolved") return false;
  return true;
}

export function getRecoveryTasks(state) {
  return (state.tasks || []).filter(task => task.recoveryStatus === "needsReview");
}

export function resolveRecoveredTask(task, result) {
  const now = new Date().toISOString();

  if (result === "done") {
    task.status = "done";
    task.completedAt = task.completedAt || now;
  }

  if (result === "partial") {
    task.status = "inProgress";
    task.partialLogs = Array.isArray(task.partialLogs) ? task.partialLogs : [];
    task.partialLogs.push({
      date: task.recoveryOriginalDate,
      resolvedAt: now,
      note: "과거 기록 복구: 일부 완료"
    });
  }

  if (result === "notDone") {
    task.status = "pending";
  }

  task.recoveryStatus = "resolved";
  task.recoveryResolvedAt = now;
  task.lastTouchedAt = now;

  return task;
}
