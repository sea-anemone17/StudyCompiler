import { uid } from "./state.js";
import { getLeafNodes, getNodePath } from "./curriculumParser.js";
import { scheduleByVersionWindows } from "./scheduler.js";

export function generateStudyTasksForSubject(subject) {
  const leaves = getLeafNodes(subject.curriculum || []);
  const versions = (subject.versions || []).filter(version => !String(version.id).includes(".5") && !String(version.id).startsWith("R"));
  const rawTasks = [];

  for (const version of versions) {
    for (const leaf of leaves) {
      if (!shouldGenerateVersionForConcept(leaf, version)) continue;
      const path = getNodePath(subject.curriculum, leaf.id);
      rawTasks.push({
        id: uid("task"),
        subjectId: subject.id,
        conceptId: leaf.id,
        conceptTitle: leaf.title,
        conceptPath: path,
        importance: leaf.importance || "B",
        conceptImportance: leaf.importance || "B",
        versionId: version.id,
        versionLabel: version.label,
        type: "study",
        title: `${leaf.title} ${version.id} ${version.label}`,
        estimatedMinutes: version.estimatedMinutes || 30,
        status: "pending",
        priority: getVersionPriority(version.id),
        createdAt: new Date().toISOString()
      });
    }
  }

  return scheduleByVersionWindows(rawTasks, subject);
}

export function preserveTaskProgress(newTasks, oldTasks) {
  const oldBySignature = new Map(oldTasks.map(task => [taskSignature(task), task]));
  return newTasks.map(task => {
    const old = oldBySignature.get(taskSignature(task));
    if (!old) return task;
    return {
      ...task,
      id: old.id,
      status: old.status,
      completedAt: old.completedAt || null,
      actualMinutes: old.actualMinutes ?? null,
      accuracy: old.accuracy ?? null,
      understanding: old.understanding ?? null,
      notes: old.notes || "",
      scheduledDate: old.status === "done" ? old.scheduledDate : task.scheduledDate
    };
  });
}

export function taskSignature(task) {
  return [task.subjectId, task.conceptPath?.join(" > ") || task.conceptTitle, task.versionId, task.type].join("|");
}

function shouldGenerateVersionForConcept(concept, version) {
  if (Array.isArray(concept.targetVersions) && concept.targetVersions.length) {
    return concept.targetVersions.includes(version.id);
  }
  if (concept.importance === "C") return ["v0", "v1"].includes(version.id) || version.order <= 2;
  if (concept.importance === "B") return !["v3", "v4"].includes(version.id);
  return true;
}

function getVersionPriority(versionId) {
  if (versionId === "v0") return 1;
  if (versionId === "v1") return 2;
  if (versionId === "v2") return 3;
  if (versionId === "v3") return 4;
  return 10;
}
