import { $, toast } from "../../ui.js";
import { todayISO } from "../../state.js";
import { scheduleAllPending } from "../../planner/planner.js";
import { upsertClassProgress, removeClassProgress, toggleClassProgressExamRange } from "../../planner/classProgressPlanner.js";

export function bindClassProgressEvents(context) {
  const { getState, setState, render } = context;

  document.addEventListener("submit", event => {
    const form = event.target.closest("#classProgressForm");
    if (!form) return;
    event.preventDefault();
    const state = getState();
    const subjectId = $("#classProgressSubject")?.value || state.activeSubjectId || state.subjects[0]?.id;
    if (!subjectId) return toast("과목을 먼저 추가해 주세요.");
    const title = $("#classProgressTitle")?.value.trim();
    if (!title) return toast("오늘 배운 내용을 입력해 주세요.");
    const included = Boolean($("#includedInExamRange")?.checked);
    const selectedLevel = $("#studyPlanLevel")?.value || "reviewOnly";
    upsertClassProgress(state, {
      subjectId,
      date: $("#classProgressDate")?.value || todayISO(),
      title,
      type: $("#classProgressType")?.value || "lesson",
      teacherSignal: $("#teacherSignal")?.value || "medium",
      examLikelihood: included ? "confirmed" : ($("#examLikelihood")?.value || "unknown"),
      includedInExamRange: included,
      studyPlanLevel: included ? "confirmedExam" : selectedLevel,
      memo: $("#classProgressMemo")?.value.trim() || ""
    });
    form.reset();
    if ($("#classProgressDate")) $("#classProgressDate").value = todayISO();
    if ($("#studyPlanLevel")) $("#studyPlanLevel").value = "reviewOnly";
    setState(scheduleAllPending(state));
    render();
    toast("학교 진도를 기록하고 태스크를 만들었습니다.");
  });

  document.addEventListener("click", event => {
    const deleteClassProgress = event.target.closest(".delete-class-progress");
    if (!deleteClassProgress) return;
    const state = getState();
    removeClassProgress(state, deleteClassProgress.dataset.progressId);
    setState(scheduleAllPending(state));
    render();
    toast("학교 진도 기록을 삭제했습니다.");
  });

  document.addEventListener("change", event => {
    const includeClassProgress = event.target.closest(".class-progress-include");
    if (!includeClassProgress) return;
    const state = getState();
    toggleClassProgressExamRange(state, includeClassProgress.dataset.progressId, includeClassProgress.checked);
    setState(scheduleAllPending(state));
    render();
    toast(includeClassProgress.checked ? "확정 시험범위로 표시했습니다." : "시험범위 포함 표시를 해제했습니다.");
  });
}
