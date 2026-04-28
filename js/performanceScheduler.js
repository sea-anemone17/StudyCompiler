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
        dueDate: item.dueDate,
        estimatedMinutes: 30
      };
    });
}

export function getPerformanceDueItemsForDates(items, dates) {
  const dateSet = new Set(dates);
  return items.filter(item => dateSet.has(item.dueDate)).map(item => ({
    ...item,
    type: "performance-due"
  }));
}

export function togglePerformanceStage(item, stageId, done) {
  item.stages = item.stages.map(stage => stage.id === stageId
    ? { ...stage, status: done ? "done" : "pending", completedAt: done ? new Date().toISOString() : null }
    : stage
  );
}

export function getPerformanceProgress(item) {
  const stages = item.stages || [];
  if (!stages.length) return { done: 0, total: 0, percent: 0 };
  const done = stages.filter(stage => stage.status === "done").length;
  return { done, total: stages.length, percent: Math.round((done / stages.length) * 100) };
}
