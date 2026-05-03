import { $, toast } from "../../ui.js";
import { createPerformanceItem, togglePerformanceStage } from "../../performanceScheduler.js";
import { scheduleAllPending } from "../../planner/planner.js";

export function bindPerformanceEvents(context) {
  const { getState, setState, render } = context;

  $("#performanceForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const state = getState();
    const subjectId = $("#performanceSubject")?.value || state.subjects[0]?.id;
    if (!subjectId) return toast("과목을 먼저 추가해 주세요.");
    state.performanceItems.push(createPerformanceItem({
      subjectId,
      title: $("#performanceTitle")?.value.trim(),
      dueDate: $("#performanceDue")?.value,
      memo: $("#performanceMemo")?.value.trim()
    }));
    event.target.reset();
    setState(scheduleAllPending(state));
    render();
    toast("수행평가를 추가했습니다.");
  });

  document.addEventListener("click", event => {
    const deletePerformance = event.target.closest(".delete-performance");
    if (!deletePerformance) return;
    const state = getState();
    state.performanceItems = state.performanceItems.filter(item => item.id !== deletePerformance.dataset.performanceId);
    setState(scheduleAllPending(state));
    render();
    toast("수행평가를 삭제했습니다.");
  });

  document.addEventListener("change", event => {
    const stageToggle = event.target.closest(".performance-stage-toggle");
    if (!stageToggle) return;
    const state = getState();
    const item = state.performanceItems.find(perf => perf.id === stageToggle.dataset.performanceId);
    if (item) togglePerformanceStage(item, stageToggle.dataset.stageId, stageToggle.checked);
    setState(scheduleAllPending(state));
    render();
  });
}
