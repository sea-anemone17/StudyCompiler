import { todayISO } from "../core/dateUtils.js";
import { recordDurationResult } from "../core/durationModel.js";
import { scheduleAllPending } from "./planner.js";

export function createRebuildPreview(state, anchorDate = todayISO()) {
  const before = new Map((state.tasks || []).map(task => [task.id, task]));
  const cloned = structuredCloneSafe(state);
  const next = scheduleAllPending(cloned, { anchorDate });
  const actions = [];
  for (const task of next.tasks || []) {
    const old = before.get(task.id);
    if (!old) continue;
    if (old.scheduledDate !== task.scheduledDate || old.scheduledBlockId !== task.scheduledBlockId || old.status !== task.status) {
      actions.push({
        taskId: task.id,
        title: task.title || task.conceptTitle || task.id,
        from: old.scheduledDate || old.status || "미배치",
        to: task.scheduledDate || task.status || "미배치",
        reason: task.status === "unscheduled" ? "배치 실패" : "시간 블록 재배치"
      });
    }
  }
  return {
    anchorDate,
    actions,
    updates: actions,
    deferredTaskIds: (next.tasks || []).filter(task => task.status === "deferred" || task.status === "unscheduled").map(task => task.id),
    capacityWarnings: next.plannerWarnings || [],
    nextState: next
  };
}

export function applyRebuildPlan(state, plan) {
  if (plan?.nextState) return plan.nextState;
  return scheduleAllPending(state, { anchorDate: plan?.anchorDate || todayISO() });
}

export function recordTaskCompletionAndReplan(state, task) {
  recordDurationResult(state, task);
  return scheduleAllPending(state, { anchorDate: todayISO() });
}

export function sortTasksForDisplay(tasks = []) {
  return [...tasks].sort((a, b) => {
    const sa = statusScore(a) - statusScore(b);
    if (sa !== 0) return sa;
    const da = String(a.scheduledDate || "9999-12-31").localeCompare(String(b.scheduledDate || "9999-12-31"));
    if (da !== 0) return da;
    const ta = String(a.scheduledStart || "99:99").localeCompare(String(b.scheduledStart || "99:99"));
    if (ta !== 0) return ta;
    return Number(a.priority || 10) - Number(b.priority || 10);
  });
}

export function getCapacityWarnings(state) {
  const warnings = [...(state.plannerWarnings || [])];
  const byDate = new Map();
  for (const task of state.tasks || []) {
    if (!task.scheduledDate || task.status === "done") continue;
    const item = byDate.get(task.scheduledDate) || { date: task.scheduledDate, minutes: 0 };
    item.minutes += Number(task.estimatedMinutes || 0);
    byDate.set(task.scheduledDate, item);
  }
  const blocksByDate = new Map();
  for (const block of state.studyBlocks || []) {
    const item = blocksByDate.get(block.date) || { date: block.date, capacity: 0 };
    item.capacity += Number(block.capacityMinutes || block.minutes || 0);
    blocksByDate.set(block.date, item);
  }
  for (const [date, usage] of byDate) {
    const capacity = blocksByDate.get(date)?.capacity;
    if (capacity && usage.minutes > capacity) {
      warnings.push({ type: "over-capacity", date, message: `${date}: ${usage.minutes}분 배치 / 가능 ${capacity}분` });
    }
  }
  return warnings;
}

function statusScore(task) {
  if (task.status === "unscheduled") return -1;
  if (task.type === "patch") return 0;
  if (task.type === "review") return 1;
  if (task.type === "study") return 2;
  return 5;
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
