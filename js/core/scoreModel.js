import { RESULT_GRADE_OPTIONS, UNDERSTANDING_STAGE_OPTIONS } from "../config.js";

export const RESULT_GRADE_SCORE = {
  excellent: 95,
  good: 80,
  mixed: 60,
  poor: 40,
  stuck: 20
};

export const RESULT_RISK = {
  excellent: 0.05,
  good: 0.2,
  mixed: 0.48,
  poor: 0.78,
  stuck: 1
};

export const UNDERSTANDING_STAGE_SCORE = {
  foggy: 1,
  withSolution: 2,
  sameType: 3,
  variant: 4,
  teach: 5
};

export const UNDERSTANDING_RISK = {
  foggy: 1,
  withSolution: 0.72,
  sameType: 0.42,
  variant: 0.18,
  teach: 0.05
};

export function normalizeTaskOutcome(task = {}) {
  const resultGrade = task.resultGrade || inferResultGradeFromAccuracy(task.accuracy);
  const understandingStage = task.understandingStage || inferUnderstandingStage(task.understanding);
  const accuracy = Number.isFinite(Number(task.accuracy))
    ? Number(task.accuracy)
    : (RESULT_GRADE_SCORE[resultGrade] ?? null);
  const understanding = Number.isFinite(Number(task.understanding))
    ? Number(task.understanding)
    : (UNDERSTANDING_STAGE_SCORE[understandingStage] ?? null);

  return { resultGrade, understandingStage, accuracy, understanding };
}

export function inferResultGradeFromAccuracy(accuracy) {
  const n = Number(accuracy);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 90) return "excellent";
  if (n >= 75) return "good";
  if (n >= 55) return "mixed";
  if (n >= 30) return "poor";
  return "stuck";
}

export function inferUnderstandingStage(understanding) {
  const n = Number(understanding);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 5) return "teach";
  if (n >= 4) return "variant";
  if (n >= 3) return "sameType";
  if (n >= 2) return "withSolution";
  return "foggy";
}

export function getResultLabel(value) {
  return RESULT_GRADE_OPTIONS.find(item => item.value === value)?.label || value || "결과 미입력";
}

export function getUnderstandingLabel(value) {
  return UNDERSTANDING_STAGE_OPTIONS.find(item => item.value === value)?.label || value || "설명 단계 미입력";
}

export function evaluateTaskRisk(task = {}) {
  const outcome = normalizeTaskOutcome(task);
  const resultRisk = RESULT_RISK[outcome.resultGrade] ?? (outcome.accuracy !== null ? Math.max(0, Math.min(1, (100 - outcome.accuracy) / 100)) : 0.25);
  const understandingRisk = UNDERSTANDING_RISK[outcome.understandingStage] ?? (outcome.understanding !== null ? Math.max(0, Math.min(1, (5 - outcome.understanding) / 5)) : 0.25);
  const estimated = Math.max(1, Number(task.estimatedMinutes || task.plannedMinutes || 30));
  const actual = Number(task.actualMinutes || 0);
  const timeOverrunRisk = actual > estimated ? Math.min(1, (actual - estimated) / estimated) : 0;
  const riskScore = resultRisk * 0.45 + understandingRisk * 0.35 + timeOverrunRisk * 0.2;
  return {
    ...outcome,
    resultRisk,
    understandingRisk,
    timeOverrunRisk,
    riskScore,
    level: riskScore >= 0.72 ? "heavy" : riskScore >= 0.45 ? "medium" : "low"
  };
}

export function applyOutcomeToTask(task, field, value) {
  if (field === "resultGrade") {
    task.resultGrade = value;
    task.accuracy = RESULT_GRADE_SCORE[value] ?? null;
    return;
  }
  if (field === "understandingStage") {
    task.understandingStage = value;
    task.understanding = UNDERSTANDING_STAGE_SCORE[value] ?? null;
    return;
  }
  if (["actualMinutes", "accuracy", "understanding"].includes(field)) {
    task[field] = value === "" ? null : Number(value);
    const outcome = normalizeTaskOutcome(task);
    task.resultGrade = outcome.resultGrade;
    task.understandingStage = outcome.understandingStage;
    return;
  }
  task[field] = value;
}
