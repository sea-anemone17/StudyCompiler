import { uid } from "./state.js";
import { normalizeAITree } from "./curriculumParser.js";
import { normalizeAIVersions } from "./versionEngine.js";

export function parseAIJson(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("JSON 객체가 아닙니다.");
  return parsed;
}

export function reviewAIJson(parsed) {
  const curriculumTree = parsed.curriculumTree || parsed.curriculum_tree || [];
  const versionRules = parsed.versionRules || parsed.version_rules || [];
  const countConcepts = countLeaves(curriculumTree);
  const warnings = [];
  if (!parsed.subject && !parsed.name) warnings.push("과목명이 없습니다. 현재 선택 과목에 적용됩니다.");
  if (!Array.isArray(curriculumTree) || curriculumTree.length === 0) warnings.push("curriculumTree가 비어 있습니다.");
  if (!Array.isArray(versionRules) || versionRules.length === 0) warnings.push("versionRules가 비어 있어 기본 버전을 사용할 수 있습니다.");
  return {
    subject: parsed.subject || parsed.name || "현재 과목",
    examDate: parsed.examDate || parsed.exam_date || "현재 시험일",
    type: parsed.subjectType || parsed.subject_type || "현재 유형",
    conceptCount: countConcepts,
    versionCount: Array.isArray(versionRules) ? versionRules.length : 0,
    warnings
  };
}

export function applyAIJsonToSubject(parsed, currentSubject) {
  const subjectId = currentSubject?.id || uid("subject");
  return {
    ...(currentSubject || {}),
    id: subjectId,
    name: parsed.subject || parsed.name || currentSubject?.name || "새 과목",
    examDate: parsed.examDate || parsed.exam_date || currentSubject?.examDate || new Date().toISOString().slice(0, 10),
    type: parsed.subjectType || parsed.subject_type || currentSubject?.type || "mixed",
    dailyMinutes: currentSubject?.dailyMinutes || 120,
    curriculum: normalizeAITree(parsed.curriculumTree || parsed.curriculum_tree || [], subjectId),
    versions: normalizeAIVersions(parsed.versionRules || parsed.version_rules || currentSubject?.versions || [])
  };
}

function countLeaves(items) {
  if (!Array.isArray(items)) return 0;
  let count = 0;
  for (const item of items) {
    const children = item.children || item.items || [];
    if (!children.length) count += 1;
    else count += countLeaves(children);
  }
  return count;
}
