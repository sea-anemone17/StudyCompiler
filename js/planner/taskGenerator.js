import { uid } from "../state.js";
import { getLeafNodes, getNodePath } from "../curriculumParser.js";
import { scheduleTasksForState } from "./scheduleEngine.js";
import { stableTaskSignature } from "./planner.js";

export function generateStudyTasksForSubject(subject, options = {}) {
  const leaves = getLeafNodes(subject.curriculum || []);
  const leafOrder = new Map(leaves.map((leaf, index) => [leaf.id, index]));
  const versions = (subject.versions || []).filter(version => isRegularVersion(version.id));
  const versionOrder = new Map(versions.map((version, index) => [version.id, index]));
  const rawTasks = [];

  // 공부 순서 안정화: v0 전체 → v1 전체 → v2 전체, 각 버전 안에서는 시험범위 트리 입력 순서.
  for (const version of versions) {
    for (const leaf of leaves) {
      if (!shouldGenerateVersionForConcept(leaf, version)) continue;
      const path = getNodePath(subject.curriculum, leaf.id);
      const conceptOrder = leafOrder.get(leaf.id) ?? rawTasks.length;
      const vOrder = versionOrder.get(version.id) ?? getVersionPriority(version.id);
      rawTasks.push({
        id: uid("task"),
        subjectId: subject.id,
        conceptId: leaf.id,
        conceptStableKey: stableConceptKey(path),
        conceptTitle: leaf.title,
        conceptPath: path,
        importance: leaf.importance || "B",
        conceptImportance: leaf.importance || "B",
        conceptOrder,
        versionOrder: vOrder,
        sequenceOrder: vOrder * 100000 + conceptOrder,
        prerequisiteTaskIds: [],
        versionId: version.id,
        versionLabel: version.label,
        type: "study",
        title: `${leaf.title} ${version.id} ${version.label}`,
        estimatedMinutes: Number(version.estimatedMinutes || 30),
        plannedMinutes: Number(version.estimatedMinutes || 30),
        status: "pending",
        priority: getVersionPriority(version.id),
        createdAt: new Date().toISOString(),
        schedulerVersion: "v4-ordered-unscheduled"
      });
    }
  }

  attachLinearPrerequisites(rawTasks);

  if (options.schedule === false) return rawTasks;
  return scheduleTasksForState({ subjects: [subject], tasks: rawTasks, weeklyAvailability: options.weeklyAvailability, dateOverrides: options.dateOverrides, durationProfiles: options.durationProfiles }).tasks;
}

export function preserveTaskProgress(newTasks, oldTasks) {
  const oldBySignature = new Map(oldTasks.map(task => [taskSignature(task), task]));
  const newIdToPreservedId = new Map();

  for (const task of newTasks) {
    const old = oldBySignature.get(taskSignature(task));
    if (old) newIdToPreservedId.set(task.id, old.id);
  }

  return newTasks.map(task => {
    const old = oldBySignature.get(taskSignature(task));
    const prerequisiteTaskIds = (task.prerequisiteTaskIds || []).map(id => newIdToPreservedId.get(id) || id);
    if (!old) return { ...task, prerequisiteTaskIds };
    return {
      ...task,
      id: old.id,
      prerequisiteTaskIds,
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

function attachLinearPrerequisites(tasks) {
  const bySubject = new Map();
  for (const task of tasks) {
    const list = bySubject.get(task.subjectId) || [];
    list.push(task);
    bySubject.set(task.subjectId, list);
  }
  for (const list of bySubject.values()) {
    list.sort((a, b) => Number(a.sequenceOrder || 0) - Number(b.sequenceOrder || 0));
    for (let index = 1; index < list.length; index += 1) {
      list[index].prerequisiteTaskIds = [list[index - 1].id];
    }
  }
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
