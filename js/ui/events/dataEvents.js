import { $, toast } from "../../ui.js";
import { todayISO } from "../../state.js";
import { exportState, importStateFromFile, clearState } from "../../data/storage.js";
import { createRebuildPreview, applyRebuildPlan } from "../../planner/rescheduleEngine.js";
import { scheduleAllPending, attachFollowups } from "../../planner/planner.js";

export function bindDataEvents(context) {
  const { getState, setState, render, getLatestRebuildPreview, setLatestRebuildPreview } = context;

  $("#buildDate")?.addEventListener("change", render);
  $("#calendarMonth")?.addEventListener("change", render);
  $("#exportBtn")?.addEventListener("click", () => exportState(getState()));

  $("#importFile")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importStateFromFile(file);
      setState(scheduleAllPending(imported));
      render();
      toast("백업을 가져오고 재배치했습니다.");
    } catch (error) {
      toast(`가져오기 실패: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  });

  $("#generateReviewPatchBtn")?.addEventListener("click", () => {
    const state = getState();
    const created = attachFollowups(state);
    setState(scheduleAllPending(state));
    render();
    toast(`복습 ${created.reviews.length}개, 패치 ${created.patches.length}개를 생성했습니다.`);
  });

  $("#previewRebuildBtn")?.addEventListener("click", () => {
    const plan = createRebuildPreview(getState(), todayISO());
    setLatestRebuildPreview?.(plan);
    render();
    toast(`재빌드 미리보기: 변경 ${plan.actions.length}건`);
  });

  $("#applyRebuildBtn")?.addEventListener("click", () => {
    let plan = getLatestRebuildPreview?.();
    if (!plan) plan = createRebuildPreview(getState(), todayISO());
    const state = applyRebuildPlan(getState(), plan);
    setState(state);
    setLatestRebuildPreview?.(null);
    render();
    toast("재빌드를 적용했습니다.");
  });

  $("#resetBtn")?.addEventListener("click", () => {
    if (!confirm("모든 데이터를 초기화할까요?")) return;
    clearState();
    location.reload();
  });
}
