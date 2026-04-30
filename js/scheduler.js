export { buildDateRange, getWeekDates, formatKoreanDate, getDday } from "./core/dateUtils.js";
export { scheduleTasksForState } from "./planner/scheduleEngine.js";

export function scheduleByVersionWindows(tasks, subject) {
  // v3 호환용: 새 엔진은 planner/scheduleEngine.js를 사용합니다.
  // 이 함수는 기존 호출부가 깨지지 않도록 최소 배치만 수행합니다.
  return tasks.map((task, index) => ({
    ...task,
    scheduledDate: task.scheduledDate || subject?.examDate || null,
    scheduleOrder: index + 1,
    schedulerVersion: "v4-compat"
  }));
}
