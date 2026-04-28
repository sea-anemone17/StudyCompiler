import { DEFAULT_PERFORMANCE_STAGES } from "./config.js";
import { uid, todayISO } from "./state.js";

export function createPerformanceItem({ subjectId, title, dueDate, memo }) {
  return {
    id: uid("perf"),
    subjectId,
    title,
    dueDate,
    memo: memo || "",
    stages: DEFAULT_PERFORMANCE_STAGES.map(stage => ({
      ...stage,
      status: "pending",
      completedAt: null
    })),
    createdAt: new Date().toISOString()
  };
}

export function getPerformanceTasksForDate(items, selectedDate = todayISO()) {
  return items
    .filter(item => item.stages?.some(stage => stage.status !== "done"))
    .map(item => {
      const nextStage = item.stages.find(stage => stage.status !== "done");
      return {
        id: `${item.id}::${nextStage.id}`,
        performanceId: item.id,
        subjectId: item.subjectId,
        title: `${item.title} ${nextStage.id} ${nextStage.label}`,
        conceptPath: ["수행평가", item.title],
        versionId: nextStage.id,
        versionLabel: nextStage.label,
        type: "performance",
        status: nextStage.status,
        scheduledDate: selectedDate,
        estimatedMinutes: 30
      };
    });
}

export function togglePerformanceStage(item, stageId, done) {
  item.stages = item.stages.map(stage => stage.id === stageId
    ? { ...stage, status: done ? "done" : "pending", completedAt: done ? new Date().toISOString() : null }
    : stage
  );
}
