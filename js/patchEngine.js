import { PATCH_POLICY } from "./config.js";
import { addDaysISO, uid } from "./state.js";

export function shouldCreatePatch(task) {
  if (!task || !["study", "review"].includes(task.type)) return false;
  if (String(task.versionId || "").includes(".5")) return false;
  const accuracy = Number(task.accuracy);
  const understanding = Number(task.understanding);
  const hasAccuracyProblem = Number.isFinite(accuracy) && accuracy > 0 && accuracy < PATCH_POLICY.accuracyThreshold;
  const hasUnderstandingProblem = Number.isFinite(understanding) && understanding > 0 && understanding <= PATCH_POLICY.understandingThreshold;
  return hasAccuracyProblem || hasUnderstandingProblem;
}

export function createPatchTask(task, existingTasks = []) {
  if (!shouldCreatePatch(task)) return null;
  if (existingTasks.some(item => item.type === "patch" && item.sourceTaskId === task.id)) return null;

  const completedDate = (task.completedAt || new Date().toISOString()).slice(0, 10);
  const patchVersion = makePatchVersion(task.versionId);
  const reason = makePatchReason(task);

  return {
    id: uid("patch"),
    subjectId: task.subjectId,
    conceptId: task.conceptId,
    conceptTitle: task.conceptTitle,
    conceptPath: task.conceptPath || [],
    versionId: patchVersion,
    versionLabel: "오답 패치",
    type: "patch",
    title: `${task.conceptTitle || task.title} ${patchVersion} 오답 패치`,
    estimatedMinutes: PATCH_POLICY.defaultEstimatedMinutes,
    status: "pending",
    priority: 0,
    scheduledDate: addDaysISO(completedDate, 1),
    sourceTaskId: task.id,
    sourceVersionId: task.versionId,
    patchReason: reason,
    createdAt: new Date().toISOString(),
    schedulerVersion: "v2.5"
  };
}

export function createMissingPatchTasksForAll(state) {
  const created = [];
  const candidates = (state.tasks || []).filter(task => ["study", "review"].includes(task.type) && task.status === "done");
  for (const task of candidates) {
    const patch = createPatchTask(task, state.tasks.concat(created));
    if (patch) created.push(patch);
  }
  return created;
}

export function makePatchVersion(versionId) {
  const raw = String(versionId || "v0");
  if (raw.startsWith("R")) return `${raw}.5`;
  const numericMatch = raw.match(/^v(\d+)$/);
  if (numericMatch) return `v${numericMatch[1]}.5`;
  return `${raw}.5`;
}

function makePatchReason(task) {
  const parts = [];
  const accuracy = Number(task.accuracy);
  const understanding = Number(task.understanding);
  if (Number.isFinite(accuracy) && accuracy > 0 && accuracy < PATCH_POLICY.accuracyThreshold) {
    parts.push(`정답률 ${accuracy}%`);
  }
  if (Number.isFinite(understanding) && understanding > 0 && understanding <= PATCH_POLICY.understandingThreshold) {
    parts.push(`이해도 ${understanding}/5`);
  }
  return parts.join(" · ") || "보정 필요";
}
