import { $, $all, toast } from "../ui.js";
import { uid, getActiveSubject, upsertSubject, todayISO } from "../state.js";
import { DEFAULT_VERSIONS_TEXT } from "../config.js";
import { parseCurriculumText, renderTreeHTML, curriculumToText } from "../curriculumParser.js";
import { parseVersionsText, versionsToText } from "../versionEngine.js";
import { buildAIPrompt } from "../aiPromptBuilder.js";
import { parseAIJson, reviewAIJson, applyAIJsonToSubject } from "../aiImporter.js";
import { createPerformanceItem, togglePerformanceStage } from "../performanceScheduler.js";
import { exportState, importStateFromFile, clearState } from "../data/storage.js";
import { createRebuildPreview, applyRebuildPlan, recordTaskCompletionAndReplan } from "../planner/rescheduleEngine.js";
import { replanSubject, replanAll, scheduleAllPending, attachFollowups } from "../planner/planner.js";
import { applyOutcomeToTask } from "../core/scoreModel.js";
import { renderScheduleSettings, readScheduleSettings, renderEmptyScheduleBlock } from "./renderScheduleSettings.js";
import { upsertClassProgress, removeClassProgress, toggleClassProgressExamRange } from "../planner/classProgressPlanner.js";

export function bindEvents(context) {
  const { getState, setState, render, getLatestRebuildPreview, setLatestRebuildPreview } = context;

  $all(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $all(".tab").forEach(item => item.classList.remove("active"));
      $all(".tab-panel").forEach(item => item.classList.remove("active"));
      tab.classList.add("active");
      $(`#${tab.dataset.tab}Tab`)?.classList.add("active");
    });
  });

  $("#newSubjectBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = {
      id: uid("subject"),
      name: "새 과목",
      examDate: todayISO(),
      examDateStatus: "estimated",
      type: "problem",
      planningMode: "examRange",
      dailyMinutes: 120,
      studyFinishBufferDays: 7,
      curriculum: [],
      versions: parseVersionsText(DEFAULT_VERSIONS_TEXT)
    };
    upsertSubject(state, subject);
    setState(scheduleAllPending(state));
    fillSubjectForm(subject);
    render();
    toast("새 과목을 만들었습니다.");
  });

  $("#subjectForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const state = getState();
    const active = getActiveSubject(state);
    const subject = {
      ...(active || {}),
      id: $("#subjectId")?.value || active?.id || uid("subject"),
      name: $("#subjectName")?.value.trim() || "이름 없는 과목",
      examDate: $("#examDate")?.value || todayISO(),
      examDateStatus: $("#examDateStatus")?.value || active?.examDateStatus || "estimated",
      provisionalExamDate: $("#provisionalExamDate")?.value || active?.provisionalExamDate || "",
      examWindowStart: $("#examWindowStart")?.value || active?.examWindowStart || "",
      examWindowEnd: $("#examWindowEnd")?.value || active?.examWindowEnd || "",
      studyFinishBufferDays: Number($("#studyFinishBufferDays")?.value || active?.studyFinishBufferDays || 7),
      allowRegularStudyOnExamDay: Boolean($("#allowRegularStudyOnExamDay")?.checked),
      type: $("#subjectType")?.value || "problem",
      planningMode: $("#planningMode")?.value || active?.planningMode || "examRange",
      dailyMinutes: Number($("#dailyMinutes")?.value || 120),
      curriculum: active?.curriculum || [],
      versions: active?.versions || parseVersionsText(DEFAULT_VERSIONS_TEXT)
    };
    upsertSubject(state, subject);
    setState(replanSubject(state, subject.id));
    render();
    toast("과목을 저장하고 계획을 다시 배치했습니다.");
  });

  $("#saveVersionsBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");
    subject.versions = parseVersionsText($("#versionsInput")?.value || DEFAULT_VERSIONS_TEXT);
    upsertSubject(state, subject);
    setState(replanSubject(state, subject.id));
    render();
    toast("버전을 저장하고 태스크를 재계획했습니다.");
  });

  $("#parseCurriculumBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");
    subject.curriculum = parseCurriculumText($("#curriculumInput")?.value || "", subject.id);
    upsertSubject(state, subject);
    setState(replanSubject(state, subject.id));
    render();
    toast("시험범위 트리를 저장하고 태스크를 재계획했습니다.");
  });

  $("#generateTasksBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");
    if (!subject.curriculum?.length) return toast("시험범위 트리를 먼저 저장해 주세요.");
    if (!subject.versions?.length) subject.versions = parseVersionsText(DEFAULT_VERSIONS_TEXT);
    setState(replanSubject(state, subject.id));
    render();
    toast("태스크를 생성하고 시간 블록 기준으로 재배치했습니다.");
  });

  $("#buildPromptBtn")?.addEventListener("click", () => {
    const subject = getActiveSubject(getState());
    if ($("#aiPromptOutput")) $("#aiPromptOutput").value = buildAIPrompt(subject);
    toast("AI 프롬프트를 생성했습니다.");
  });

  $("#copyPromptBtn")?.addEventListener("click", async () => {
    const value = $("#aiPromptOutput")?.value;
    if (!value) return toast("복사할 프롬프트가 없습니다.");
    await navigator.clipboard.writeText(value);
    toast("프롬프트를 복사했습니다.");
  });

  $("#validateJsonBtn")?.addEventListener("click", () => {
    try {
      const parsed = parseAIJson($("#aiJsonInput")?.value || "");
      const review = reviewAIJson(parsed);
      if ($("#jsonReview")) $("#jsonReview").innerHTML = renderJsonReview(review);
      toast("JSON 검토를 완료했습니다.");
    } catch (error) {
      if ($("#jsonReview")) $("#jsonReview").textContent = `오류: ${error.message}`;
      toast("JSON을 읽지 못했습니다.");
    }
  });

  $("#applyJsonBtn")?.addEventListener("click", () => {
    try {
      const state = getState();
      const parsed = parseAIJson($("#aiJsonInput")?.value || "");
      const subject = applyAIJsonToSubject(parsed, getActiveSubject(state));
      upsertSubject(state, subject);
      setState(replanSubject(state, subject.id));
      fillSubjectForm(subject);
      render();
      toast("AI JSON을 적용하고 재계획했습니다.");
    } catch (error) {
      toast(`적용 실패: ${error.message}`);
    }
  });

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

  const scheduleContainer = $("#scheduleSettingsView");
  if (scheduleContainer) {
    renderScheduleSettings(scheduleContainer, getState());
    scheduleContainer.addEventListener("click", event => {
      const add = event.target.closest(".add-schedule-block");
      if (add) {
        const dayBlocks = scheduleContainer.querySelector(`.day-blocks[data-weekday="${add.dataset.weekday}"]`);
        const index = dayBlocks.querySelectorAll(".schedule-block").length;
        dayBlocks.insertAdjacentHTML("beforeend", renderEmptyScheduleBlock(add.dataset.weekday, index, getState().subjects || []));
      }
      if (event.target.closest(".remove-schedule-block")) {
        event.target.closest(".schedule-block")?.remove();
      }
      if (event.target.id === "saveScheduleSettingsBtn") {
        const state = getState();
        state.weeklyAvailability = readScheduleSettings(scheduleContainer);
        setState(replanAll(state));
        render();
        toast("요일별 시간표를 저장하고 전체 재배치했습니다.");
      }
    });
  }

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
    const subjectCard = event.target.closest(".subject-card");
    if (subjectCard) {
      const state = getState();
      state.activeSubjectId = subjectCard.dataset.subjectId;
      setState(state);
      render();
      return;
    }
    const deleteClassProgress = event.target.closest(".delete-class-progress");
    if (deleteClassProgress) {
      const state = getState();
      removeClassProgress(state, deleteClassProgress.dataset.progressId);
      setState(scheduleAllPending(state));
      render();
      toast("학교 진도 기록을 삭제했습니다.");
      return;
    }
    const deletePerformance = event.target.closest(".delete-performance");
    if (deletePerformance) {
      const state = getState();
      state.performanceItems = state.performanceItems.filter(item => item.id !== deletePerformance.dataset.performanceId);
      setState(scheduleAllPending(state));
      render();
      toast("수행평가를 삭제했습니다.");
      return;
    }
    const saveProgressBtn = event.target.closest(".save-progress-btn");
      if (saveProgressBtn) {
        const state = getState();
        const task = state.tasks.find(item => item.id === saveProgressBtn.dataset.taskId);
        if (!task) return;

        const progressInput = document.querySelector(
          `.task-metric[data-task-id="${task.id}"][data-field="progressAmount"]`
        );

        const nextDateInput = document.querySelector(
          `.task-metric[data-task-id="${task.id}"][data-field="nextDate"]`
        );

        const actualInput = document.querySelector(
          `.task-metric[data-task-id="${task.id}"][data-field="actualMinutes"]`
        );

        const progressAmount = Number(progressInput?.value || 0);
        const actualMinutes = Number(actualInput?.value || 0);

        task.completedAmount = Number(task.completedAmount || 0) + progressAmount;
        task.actualMinutes = actualMinutes;
        task.nextDate = nextDateInput?.value || task.nextDate;

        task.sessionLogs = Array.isArray(task.sessionLogs) ? task.sessionLogs : [];
        task.sessionLogs.push({
          date: todayISO(),
          amount: progressAmount,
          minutes: actualMinutes
        });

        if (task.targetAmount && task.completedAmount >= task.targetAmount) {
          task.status = "done";
          task.completedAt = new Date().toISOString();
        } else {
          task.status = "inProgress";
        }

        const next = task.status === "done"
          ? recordTaskCompletionAndReplan(state, task)
          : scheduleAllPending(state);

        setState(next);
        render();
        toast("진행률을 저장하고 다음 일정에 반영했습니다.");
        return;
      }
    const delayBtn = event.target.closest(".delay-task");
    if (delayBtn) {
      const state = getState();
      const task = state.tasks.find(item => item.id === delayBtn.dataset.taskId);
      if (task) {
        task.status = "pending";
        task.scheduledDate = null;
        task.manualDelayCount = Number(task.manualDelayCount || 0) + 1;
        setState(scheduleAllPending(state, { anchorDate: todayISO() }));
        render();
        toast("태스크를 다음 가능한 블록으로 재배치했습니다.");
      }
    }
  });

  document.addEventListener("change", event => {
    const includeClassProgress = event.target.closest(".class-progress-include");
    if (includeClassProgress) {
      const state = getState();
      toggleClassProgressExamRange(state, includeClassProgress.dataset.progressId, includeClassProgress.checked);
      setState(scheduleAllPending(state));
      render();
      toast(includeClassProgress.checked ? "확정 시험범위로 표시했습니다." : "시험범위 포함 표시를 해제했습니다.");
      return;
    }
    const metricInput = event.target.closest(".task-metric");
    if (metricInput) {
      const state = getState();
      const task = state.tasks.find(item => item.id === metricInput.dataset.taskId);

      if (task) {
        const field = metricInput.dataset.field;

        if (field === "nextDate") {
          task.nextDate = metricInput.value;
        } else if (field === "progressAmount") {
          // 진행량은 '진행 저장' 버튼에서 누적 처리합니다.
        } else {
          applyOutcomeToTask(task, field, metricInput.value);
        }

        const next = task.status === "done"
          ? recordTaskCompletionAndReplan(state, task)
          : scheduleAllPending(state);

        setState(next);
        render();
        toast("학습 기록을 저장하고 시간을 보정했습니다.");
      }

      return;
    }
    const taskToggle = event.target.closest(".task-toggle");
    if (taskToggle) {
      const state = getState();
      const { taskId, taskType } = taskToggle.dataset;

      if (taskType !== "performance") {
        const task = state.tasks.find(item => item.id === taskId);

        if (task?.progressMode !== "once") {
          taskToggle.checked = task.status === "done";
          toast("진행형 태스크는 진행 저장으로 관리합니다.");
          return;
        }
      }
      if (taskType === "performance") {
        const [performanceId, stageId] = taskId.split("::");
        const item = state.performanceItems.find(perf => perf.id === performanceId);
        if (item) togglePerformanceStage(item, stageId, taskToggle.checked);
      } else {
        const task = state.tasks.find(item => item.id === taskId);
        if (task) {
          task.status = taskToggle.checked ? "done" : "pending";
          task.completedAt = taskToggle.checked ? new Date().toISOString() : null;
          if (taskToggle.checked) attachFollowups(state);
        }
      }
      setState(scheduleAllPending(state));
      render();
      return;
    }
    const stageToggle = event.target.closest(".performance-stage-toggle");
    if (stageToggle) {
      const state = getState();
      const item = state.performanceItems.find(perf => perf.id === stageToggle.dataset.performanceId);
      if (item) togglePerformanceStage(item, stageToggle.dataset.stageId, stageToggle.checked);
      setState(scheduleAllPending(state));
      render();
    }
  });
}

function fillSubjectForm(subject) {
  if (!subject) return;
  if ($("#subjectId")) $("#subjectId").value = subject.id || "";
  if ($("#subjectName")) $("#subjectName").value = subject.name || "";
  if ($("#examDate")) $("#examDate").value = subject.examDate || todayISO();
  if ($("#examDateStatus")) $("#examDateStatus").value = subject.examDateStatus || "estimated";
  if ($("#provisionalExamDate")) $("#provisionalExamDate").value = subject.provisionalExamDate || "";
  if ($("#examWindowStart")) $("#examWindowStart").value = subject.examWindowStart || "";
  if ($("#examWindowEnd")) $("#examWindowEnd").value = subject.examWindowEnd || "";
  if ($("#studyFinishBufferDays")) $("#studyFinishBufferDays").value = subject.studyFinishBufferDays ?? 7;
  if ($("#allowRegularStudyOnExamDay")) $("#allowRegularStudyOnExamDay").checked = Boolean(subject.allowRegularStudyOnExamDay);
  if ($("#subjectType")) $("#subjectType").value = subject.type || "problem";
  if ($("#planningMode")) $("#planningMode").value = subject.planningMode || "examRange";
  if ($("#dailyMinutes")) $("#dailyMinutes").value = subject.dailyMinutes || 120;
  if ($("#versionsInput")) $("#versionsInput").value = versionsToText(subject.versions || []);
  if ($("#curriculumInput")) $("#curriculumInput").value = curriculumToText(subject.curriculum || []);
  if ($("#curriculumPreview")) $("#curriculumPreview").innerHTML = renderTreeHTML(subject.curriculum || []);
}

function renderJsonReview(review) {
  return `
    <dl>
      <dt>과목</dt><dd>${review.subject}</dd>
      <dt>시험일</dt><dd>${review.examDate}</dd>
      <dt>유형</dt><dd>${review.type}</dd>
      <dt>개념 수</dt><dd>${review.conceptCount}</dd>
      <dt>버전 규칙</dt><dd>${review.versionCount}</dd>
    </dl>
    ${review.warnings.length ? `<ul>${review.warnings.map(w => `<li>${w}</li>`).join("")}</ul>` : "큰 문제는 없어 보입니다."}
  `;
}
