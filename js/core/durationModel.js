import { SCHEDULER_POLICY } from "../config.js";

export function getDurationProfileKey(task = {}) {
  const subjectId = task.subjectId || "unknown";
  const versionId = task.versionId || task.type || "task";
  const type = task.type || "study";
  const importance = task.conceptImportance || task.importance || "B";
  return [subjectId, versionId, type, importance].join("::");
}

export function ensureDurationProfiles(state) {
  if (!state.durationProfiles || typeof state.durationProfiles !== "object" || Array.isArray(state.durationProfiles)) {
    state.durationProfiles = {};
  }
  return state.durationProfiles;
}

export function estimateTaskMinutes(task = {}, durationProfiles = {}) {
  const base = Math.max(SCHEDULER_POLICY.minTaskMinutes, Number(task.estimatedMinutes || task.plannedMinutes || 30));
  const profile = durationProfiles[getDurationProfileKey(task)];
  if (!profile?.estimateMinutes) return base;
  return Math.max(SCHEDULER_POLICY.minTaskMinutes, Math.round(profile.estimateMinutes));
}

export function applyDurationEstimatesToTasks(tasks = [], durationProfiles = {}) {
  return tasks.map(task => ({
    ...task,
    estimatedMinutes: estimateTaskMinutes(task, durationProfiles),
    plannedMinutes: estimateTaskMinutes(task, durationProfiles)
  }));
}

export function recordDurationResult(state, task) {
  const actual = Number(task?.actualMinutes || 0);
  if (!Number.isFinite(actual) || actual <= 0) return null;
  const profiles = ensureDurationProfiles(state);
  const key = getDurationProfileKey(task);
  const previous = profiles[key];
  const baseEstimate = Number(previous?.estimateMinutes || task.estimatedMinutes || task.plannedMinutes || actual);
  const alpha = SCHEDULER_POLICY.durationLearningRate;
  const nextEstimate = Math.round(baseEstimate * (1 - alpha) + actual * alpha);
  profiles[key] = {
    key,
    subjectId: task.subjectId,
    versionId: task.versionId,
    type: task.type,
    importance: task.conceptImportance || task.importance || "B",
    estimateMinutes: Math.max(SCHEDULER_POLICY.minTaskMinutes, nextEstimate),
    sampleCount: Number(previous?.sampleCount || 0) + 1,
    lastActualMinutes: actual,
    lastTaskId: task.id,
    updatedAt: new Date().toISOString()
  };
  return profiles[key];
}

export function rebuildDurationProfilesFromDoneTasks(tasks = []) {
  const state = { durationProfiles: {} };
  for (const task of tasks) {
    if (task.status === "done" && Number(task.actualMinutes || 0) > 0) {
      recordDurationResult(state, task);
    }
  }
  return state.durationProfiles;
}
