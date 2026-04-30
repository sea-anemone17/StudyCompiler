import { DEFAULT_VERSIONS_TEXT } from "./config.js";

const DEFAULT_MINUTES = {
  v0: 35,
  v1: 40,
  v2: 50,
  v3: 60
};

export function parseVersionsText(text) {
  const source = String(text || DEFAULT_VERSIONS_TEXT);
  return source.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [rawId, ...labelParts] = line.split(":");
      const id = rawId.trim();
      const label = labelParts.join(":").trim() || id;
      const estimatedMinutes = DEFAULT_MINUTES[id] || Math.max(25, 30 + index * 10);
      return {
        id,
        label,
        order: index + 1,
        estimatedMinutes,
        stage: inferStage(id, label)
      };
    });
}

export function versionsToText(versions) {
  if (!versions?.length) return DEFAULT_VERSIONS_TEXT;
  return versions.map(version => `${version.id}: ${version.label}`).join("\n");
}

export function normalizeAIVersions(versionRules) {
  if (!Array.isArray(versionRules) || !versionRules.length) return parseVersionsText(DEFAULT_VERSIONS_TEXT);
  return versionRules.map((rule, index) => ({
    id: rule.version || rule.id || `v${index}`,
    label: rule.label || rule.name || rule.goal || `버전 ${index}`,
    goal: rule.goal || "",
    completionCriteria: rule.completionCriteria || rule.completion_criteria || [],
    order: index + 1,
    estimatedMinutes: Number(rule.estimatedMinutes || rule.estimated_minutes || 30 + index * 10),
    stage: rule.stage || inferStage(rule.version || rule.id || `v${index}`, rule.label || "")
  }));
}

function inferStage(id, label) {
  if (id.includes(".5") || label.includes("오답") || label.includes("패치")) return "patch";
  if (id.startsWith("R")) return "review";
  if (id === "v0") return "concept";
  if (id === "v1") return "basic";
  if (id === "v2") return "intermediate";
  if (id === "v3") return "advanced";
  return "study";
}
