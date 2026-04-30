import { uid } from "../state.js";
import { getLeafNodes, getNodePath } from "../curriculumParser.js";
import { scheduleTasksForState } from "./scheduleEngine.js";
import { stableTaskSignature } from "./planner.js";

export function generateStudyTasksForSubject(subject, options = {}) {
  const leaves = getLeafNodes(subject.curriculum || []);
  const versions = (subject.versions || []).filter(version => isRegularVersion(version.id));
  const rawTasks = [];

  for (const version of versions) {
    for (const leaf of leaves) {
      if (!shouldGenerateVersionForConcept(leaf, version)) continue;
      const path = getNodePath(subject.curriculum, leaf.id);
      rawTasks.push({
        id: uid("task"),
        subjectId: subject.id,
        conceptId: leaf.id,
        conceptStableKey: stableConceptKey(path),
        conceptTitle: leaf.title,
        conceptPath: path,
        importance: leaf.importance || "B",
        conceptImportance: leaf.importance || "B",
        versionId: version.id,
        versionLabel: version.label,
        type: "study",
        title: `${leaf.title} ${version.id} ${version.label}`,
        estimatedMinutes: Number(version.estimatedMinutes || 30),
        plannedMinutes: Number(version.estimatedMinutes || 30),
        status: "pending",
        priority: getVersionPriority(version.id),
        createdAt: new Date().toISOString(),
        schedulerVersion: "v4-unscheduled"
      });
    }
  }

  if (options.schedule === false) return rawTasks;
  return scheduleTasksForState({ subjects: [subject], tasks: rawTasks, weeklyAvailability: options.weeklyAvailability, dateOverrides: options.dateOverrides, durationProfiles: options.durationProfiles }).tasks;
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
      resultGrade: old.resultGrade || "",
      understandingStage: old.understandingStage || "",
      notes: old.notes || "",
      scheduledDate: old.status === "done" ? old.scheduledDate : task.scheduledDate,
      scheduledBlockId: old.status === "done" ? old.scheduledBlockId : task.scheduledBlockId,
      scheduledStart: old.status === "done" ? old.scheduledStart : task.scheduledStart,
      scheduledEnd: old.status === "done" ? old.scheduledEnd : task.scheduledEnd
    };
  });
}

export function taskSignature(task) {
  return stableTaskSignature(task);
}

export function stableConceptKey(path = []) {
  return (path || []).map(item => String(item).trim().replace(/\s+/g, " ")).join(" > ");
}

function isRegularVersion(versionId) {
  const raw = String(versionId || "");
  return !raw.includes(".5") && !raw.startsWith("R");
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
