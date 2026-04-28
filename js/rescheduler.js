// v2.5에서는 자동 재편성 전체 기능은 v3 확장 슬롯으로 유지합니다.
// 다만 패치 태스크가 같은 날짜 안에서 먼저 보이도록 우선순위 정렬만 제공합니다.
export function sortTasksForDisplay(tasks = []) {
  return [...tasks].sort((a, b) => {
    const priorityA = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 99;
    const priorityB = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 99;
    return priorityA - priorityB || String(a.versionId || "").localeCompare(String(b.versionId || ""));
  });
}

export function rebuildSchedule(tasks) {
  return sortTasksForDisplay(tasks);
}
