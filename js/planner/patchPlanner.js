import { PATCH_POLICY } from "../config.js";
import { addDaysISO } from "../core/dateUtils.js";
import { evaluateTaskRisk, getResultLabel, getUnderstandingLabel } from "../core/scoreModel.js";
import { uid } from "../state.js";

export function shouldCreatePatch(task) {
  if (!task || !["study", "review"].includes(task.type)) return false;
  if (String(task.versionId || "").includes(".5")) return false;
  const risk = evaluateTaskRisk(task);
  return risk.riskScore >= PATCH_POLICY.riskThreshold;
}

export function createPatchTask(task, existingTasks = []) {
  if (!shouldCreatePatch(task)) return null;
  if (existingTasks.some(item => item.type === "patch" && item.sourceTaskId === task.id)) return null;
  const completedDate = (task.completedAt || new Date().toISOString()).slice(0, 10);
  const patchVersion = makePatchVersion(task.versionId);
  const risk = evaluateTaskRisk(task);
  return {
    id: uid("patch"),
    subjectId: task.subjectId,
    conceptId: task.conceptId,
    conceptStableKey: task.conceptStableKey,
    conceptTitle: task.conceptTitle,
    conceptPath: task.conceptPath || [],
    versionId: patchVersion,
    versionLabel: risk.level === "heavy" ? "강화 패치" : "오답 패치",
    type: "patch",
    title: `${task.conceptTitle || task.title} ${patchVersion} ${risk.level === "heavy" ? "강화 패치" : "오답 패치"}`,
    estimatedMinutes: risk.level === "heavy" ? Math.round(PATCH_POLICY.defaultEstimatedMinutes * 1.5) : PATCH_POLICY.defaultEstimatedMinutes,
    plannedMinutes: risk.level === "heavy" ? Math.round(PATCH_POLICY.defaultEstimatedMinutes * 1.5) : PATCH_POLICY.defaultEstimatedMinutes,
    status: "pending",
    priority: 0,
    scheduledDate: addDaysISO(completedDate, 1),
    sourceTaskId: task.id,
    sourceVersionId: task.versionId,
    patchReason: makePatchReason(task, risk),
    riskScore: risk.riskScore,
    createdAt: new Date().toISOString(),
    schedulerVersion: "v4-patch"
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

function makePatchReason(task, risk = evaluateTaskRisk(task)) {
  const parts = [];
  if (risk.resultGrade) parts.push(getResultLabel(risk.resultGrade));
  if (risk.understandingStage) parts.push(getUnderstandingLabel(risk.understandingStage));
  if (risk.timeOverrunRisk > 0.25) parts.push(`예상 시간 초과 ${Math.round(risk.timeOverrunRisk * 100)}%`);
  return parts.join(" · ") || "보정 필요";
}
