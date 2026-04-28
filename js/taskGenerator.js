import { uid } from "./state.js";
import { getLeafNodes, getNodePath } from "./curriculumParser.js";
import { scheduleByVersionWindows } from "./scheduler.js";

export function generateStudyTasksForSubject(subject) {
  const leaves = getLeafNodes(subject.curriculum || []);
  const versions = (subject.versions || []).filter(version => !version.id.includes(".5") && !version.id.startsWith("R"));
  const rawTasks = [];

  for (const version of versions) {
    for (const leaf of leaves) {
      const path = getNodePath(subject.curriculum, leaf.id);
      rawTasks.push({
        id: uid("task"),
        subjectId: subject.id,
        conceptId: leaf.id,
        conceptTitle: leaf.title,
        conceptPath: path,
        versionId: version.id,
        versionLabel: version.label,
        type: "study",
        title: `${leaf.title} ${version.id} ${version.label}`,
        estimatedMinutes: version.estimatedMinutes || 30,
        status: "pending",
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
      actualMinutes: old.actualMinutes || null,
      accuracy: old.accuracy || null
    };
  });
}

export function taskSignature(task) {
  return [task.subjectId, task.conceptPath?.join(" > ") || task.conceptTitle, task.versionId, task.type].join("|");
}
