import { $, $all, toast } from "./ui.js";
import {
  addDaysISO,
  getActiveSubject,
  normalizeSubjectPlan,
  todayISO,
  uid,
  upsertSubject
} from "./state.js";
import { DEFAULT_VERSIONS_TEXT } from "./config.js";
import { parseCurriculumText, renderTreeHTML, curriculumToText } from "./curriculumParser.js";
import { parseVersionsText, versionsToText } from "./versionEngine.js";
import { generateStudyTasksForSubject } from "./taskGenerator.js";
import { replanSubject } from "./planner.js";
import { buildAIPrompt } from "./aiPromptBuilder.js";
import { parseAIJson, reviewAIJson, applyAIJsonToSubject } from "./aiImporter.js";
import { createPerformanceItem, togglePerformanceStage } from "./performanceScheduler.js";
import { createReviewTasks, createMissingReviewTasksForAll } from "./reviewEngine.js";
import { createPatchTask, createMissingPatchTasksForAll } from "./patchEngine.js";
import { exportState, importStateFromFile, clearState, createSafetyBackup } from "./storage.js";
import { createRebuildPreview, applyRebuildPlan } from "./rescheduler.js";

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
    const subject = normalizeSubjectPlan({
      id: uid("subject"),
      name: "새 과목",
      examDate: addDaysISO(todayISO(), 21),
      provisionalExamDate: addDaysISO(todayISO(), 21),
      examDateStatus: "estimated",
      studyFinishBufferDays: 7,
      type: "problem",
      dailyMinutes: 120,
      curriculum: [],
      versions: parseVersionsText(DEFAULT_VERSIONS_TEXT)
    });

    upsertSubject(state, subject);
    setState(state);
    fillSubjectForm(subject);
    render();
    toast("새 과목을 만들었습니다. 기본값은 시험 7일 전 진도 완료 구조입니다.");
  });

  $("#subjectForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const state = getState();
    const active = getActiveSubject(state);
    const subject = buildSubjectFromForm(active);

    createSafetyBackup(state, "before-subject-save");
    upsertSubject(state, subject);
    const summary = replanSubject(state, subject.id, { reason: "subject-updated" });
    setState(state);
    render();
    toast(`과목을 저장하고 자동 재배치했습니다. 정규 태스크 ${summary.generated}개`);
  });

  $("#saveVersionsBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");

    createSafetyBackup(state, "before-version-save");
    subject.versions = parseVersionsText($("#versionsInput")?.value || "");
    upsertSubject(state, subject);
    const summary = replanSubject(state, subject.id, { reason: "versions-updated" });
    setState(state);
    render();
    toast(`버전을 저장하고 자동 재배치했습니다. 정규 태스크 ${summary.generated}개`);
  });

  $("#parseCurriculumBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");

    createSafetyBackup(state, "before-curriculum-save");
    subject.curriculum = parseCurriculumText($("#curriculumInput")?.value || "", subject.id);
    upsertSubject(state, subject);
    const summary = replanSubject(state, subject.id, { reason: "curriculum-updated" });
    setState(state);
    render();
    toast(`시험범위를 저장하고 자동 재배치했습니다. 정규 태스크 ${summary.generated}개`);
  });

  $("#generateTasksBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");
    if (!subject.curriculum?.length) return toast("시험범위 트리를 먼저 저장해 주세요.");
    if (!subject.versions?.length) subject.versions = parseVersionsText(DEFAULT_VERSIONS_TEXT);

    createSafetyBackup(state, "before-manual-replan");
    const summary = replanSubject(state, subject.id, { reason: "manual-replan" });
    setState(state);
    render();
    toast(`${summary.generated}개 태스크를 재배치했습니다.${summary.extras ? ` 복습/패치 ${summary.extras}개도 추가했습니다.` : ""}`);
  });

  $("#buildPromptBtn")?.addEventListener("click", () => {
    const subject = getActiveSubject(getState());
    const output = $("#aiPromptOutput");
    if (output) output.value = buildAIPrompt(subject);
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
      const reviewEl = $("#jsonReview");
      if (reviewEl) reviewEl.innerHTML = renderJsonReview(review);
      toast("JSON 검토를 완료했습니다.");
    } catch (error) {
      const reviewEl = $("#jsonReview");
      if (reviewEl) reviewEl.innerHTML = `오류: ${error.message}`;
      toast("JSON을 읽지 못했습니다.");
    }
  });

  $("#applyJsonBtn")?.addEventListener("click", () => {
    try {
      const state = getState();
      const parsed = parseAIJson($("#aiJsonInput")?.value || "");
      const subject = normalizeSubjectPlan(applyAIJsonToSubject(parsed, getActiveSubject(state)));
      createSafetyBackup(state, "before-ai-json-apply");
      upsertSubject(state, subject);
      const summary = replanSubject(state, subject.id, { reason: "ai-json-applied" });
      setState(state);
      fillSubjectForm(subject);
      render();
      toast(`AI JSON을 적용하고 자동 재배치했습니다. 정규 태스크 ${summary.generated}개`);
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
    setState(state);
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
      setState(imported);
      render();
      toast("백업을 가져왔습니다.");
    } catch (error) {
      toast(`가져오기 실패: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  });

  $("#seedDemoBtn")?.addEventListener("click", () => {
    setState(createDemoState());
    render();
    toast("샘플 데이터를 넣었습니다.");
  });

  $("#generateReviewPatchBtn")?.addEventListener("click", () => {
    const state = getState();
    const reviews = createMissingReviewTasksForAll(state);
    state.tasks.push(...reviews);
    const patches = createMissingPatchTasksForAll(state);
    state.tasks.push(...patches);
    setState(state);
    render();
    toast(`복습 ${reviews.length}개, 패치 ${patches.length}개를 생성했습니다.`);
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
    const state = getState();
    createSafetyBackup(state, "before-apply-rebuild");
    const nextState = applyRebuildPlan(state, plan);
    setState(nextState);
    setLatestRebuildPreview?.(null);
    render();
    toast("재빌드를 적용했습니다.");
  });

  $("#resetBtn")?.addEventListener("click", () => {
    if (!confirm("모든 데이터를 초기화할까요?")) return;
    clearState();
    location.reload();
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

    const deletePerformance = event.target.closest(".delete-performance");
    if (deletePerformance) {
      const state = getState();
      state.performanceItems = state.performanceItems.filter(item => item.id !== deletePerformance.dataset.performanceId);
      setState(state);
      render();
      toast("수행평가를 삭제했습니다.");
      return;
    }

    const delayBtn = event.target.closest(".delay-task");
    if (delayBtn) {
      const state = getState();
      const task = state.tasks.find(item => item.id === delayBtn.dataset.taskId);
      if (task) {
        task.scheduledDate = addDaysISO(task.scheduledDate || todayISO(), 1);
        setState(state);
        render();
        toast("태스크를 내일로 미뤘습니다.");
      }
    }
  });

  document.addEventListener("change", event => {
    const metricInput = event.target.closest(".task-metric");
    if (metricInput) {
      const state = getState();
      const task = state.tasks.find(item => item.id === metricInput.dataset.taskId);
      if (task) {
        applyMetricValue(task, metricInput.dataset.field, metricInput.value);
        if (task.status === "done") runFollowUpEnginesForTask(state, task);
        setState(state);
        render();
        toast("학습 기록을 저장했습니다.");
      }
      return;
    }

    const taskToggle = event.target.closest(".task-toggle");
    if (taskToggle) {
      const state = getState();
      const { taskId, taskType } = taskToggle.dataset;

      if (taskType === "performance") {
        const [performanceId, stageId] = taskId.split("::");
        const item = state.performanceItems.find(perf => perf.id === performanceId);
        if (item) togglePerformanceStage(item, stageId, taskToggle.checked);
      } else {
        const task = state.tasks.find(item => item.id === taskId);
        if (task) {
          task.status = taskToggle.checked ? "done" : "pending";
          task.completedAt = taskToggle.checked ? new Date().toISOString() : null;
          if (taskToggle.checked) runFollowUpEnginesForTask(state, task);
        }
      }
      setState(state);
      render();
      return;
    }

    const stageToggle = event.target.closest(".performance-stage-toggle");
    if (stageToggle) {
      const state = getState();
      const item = state.performanceItems.find(perf => perf.id === stageToggle.dataset.performanceId);
      if (item) togglePerformanceStage(item, stageToggle.dataset.stageId, stageToggle.checked);
      setState(state);
      render();
    }
  });
}

function buildSubjectFromForm(active) {
  const examDate = valueOf("#examDate") || active?.examDate || todayISO();
  const bufferValue = valueOf("#studyFinishBufferDays");
  const subject = {
    ...(active || {}),
    id: valueOf("#subjectId") || active?.id || uid("subject"),
    name: valueOf("#subjectName") || "이름 없는 과목",
    examDate,
    provisionalExamDate: valueOf("#provisionalExamDate") || active?.provisionalExamDate || examDate,
    examWindowStart: valueOf("#examWindowStart") || active?.examWindowStart || "",
    examWindowEnd: valueOf("#examWindowEnd") || active?.examWindowEnd || "",
    examDateStatus: valueOf("#examDateStatus") || active?.examDateStatus || "estimated",
    studyFinishBufferDays: bufferValue === "" ? (active?.studyFinishBufferDays ?? 7) : Number(bufferValue),
    allowRegularStudyOnExamDay: checkboxValue("#allowRegularStudyOnExamDay", active?.allowRegularStudyOnExamDay === true),
    type: valueOf("#subjectType") || "problem",
    dailyMinutes: Number(valueOf("#dailyMinutes") || 120),
    curriculum: active?.curriculum || [],
    versions: active?.versions || parseVersionsText(DEFAULT_VERSIONS_TEXT)
  };

  return normalizeSubjectPlan(subject);
}

function valueOf(selector) {
  const el = $(selector);
  return el ? String(el.value ?? "").trim() : "";
}

function checkboxValue(selector, fallback = false) {
  const el = $(selector);
  return el ? el.checked === true : fallback;
}

function applyMetricValue(task, field, value) {
  if (["actualMinutes", "accuracy", "understanding"].includes(field)) {
    task[field] = value === "" ? null : Number(value);
  } else {
    task[field] = value;
  }
}

function runFollowUpEnginesForTask(state, task) {
  const subject = state.subjects.find(item => item.id === task.subjectId);
  const reviews = createReviewTasks(task, subject, state.tasks);
  const patch = createPatchTask(task, state.tasks.concat(reviews));
  if (reviews.length) state.tasks.push(...reviews);
  if (patch) state.tasks.push(patch);
}

function fillSubjectForm(subject) {
  if (!subject) return;
  setValue("#subjectId", subject.id || "");
  setValue("#subjectName", subject.name || "");
  setValue("#examDate", subject.examDate || todayISO());
  setValue("#provisionalExamDate", subject.provisionalExamDate || subject.examDate || todayISO());
  setValue("#examWindowStart", subject.examWindowStart || "");
  setValue("#examWindowEnd", subject.examWindowEnd || "");
  setValue("#examDateStatus", subject.examDateStatus || "estimated");
  setValue("#studyFinishBufferDays", subject.studyFinishBufferDays ?? 7);
  setChecked("#allowRegularStudyOnExamDay", subject.allowRegularStudyOnExamDay === true);
  setValue("#subjectType", subject.type || "problem");
  setValue("#dailyMinutes", subject.dailyMinutes || 120);
  setValue("#versionsInput", versionsToText(subject.versions || []));
  setValue("#curriculumInput", curriculumToText(subject.curriculum || []));
  const preview = $("#curriculumPreview");
  if (preview) preview.innerHTML = renderTreeHTML(subject.curriculum || []);
}

function setValue(selector, value) {
  const el = $(selector);
  if (el) el.value = value ?? "";
}

function setChecked(selector, value) {
  const el = $(selector);
  if (el) el.checked = value === true;
}

function renderJsonReview(review) {
  return `
    <p><strong>과목:</strong> ${review.subject}</p>
    <p><strong>시험일:</strong> ${review.examDate}</p>
    <p><strong>유형:</strong> ${review.type}</p>
    <p><strong>개념 수:</strong> ${review.conceptCount}</p>
    <p><strong>버전 규칙:</strong> ${review.versionCount}</p>
    ${review.warnings.length ? `
      <ul>${review.warnings.map(w => `<li>${w}</li>`).join("")}</ul>
    ` : "<p>큰 문제는 없어 보입니다.</p>"}
  `;
}

function createDemoState() {
  const subjectId = uid("subject");
  const subject = normalizeSubjectPlan({
    id: subjectId,
    name: "수학",
    examDate: addDaysISO(todayISO(), 21),
    provisionalExamDate: addDaysISO(todayISO(), 21),
    examDateStatus: "estimated",
    studyFinishBufferDays: 7,
    type: "mixed",
    dailyMinutes: 120,
    versions: parseVersionsText(DEFAULT_VERSIONS_TEXT),
    curriculum: parseCurriculumText(
      "지수와 로그\nㄴ 지수\nㄴㄴ 거듭제곱근\nㄴㄴ 지수의 성질\nㄴ 로그\nㄴㄴ 로그의 뜻\nㄴㄴ 로그의 성질",
      subjectId
    )
  });

  const tasks = generateStudyTasksForSubject(subject);
  if (tasks[0]) {
    tasks[0].status = "done";
    tasks[0].completedAt = new Date().toISOString();
    tasks[0].accuracy = 65;
    tasks[0].understanding = 3;
  }

  const demoState = {
    schemaVersion: 4,
    activeSubjectId: subjectId,
    subjects: [subject],
    tasks,
    performanceItems: [createPerformanceItem({
      subjectId,
      title: "수학 오답 정리 수행",
      dueDate: addDaysISO(todayISO(), 7),
      memo: "p0~p4 단계 예시"
    })],
    syncMeta: { localUpdatedAt: new Date().toISOString() }
  };

  demoState.tasks.push(...createMissingReviewTasksForAll(demoState));
  demoState.tasks.push(...createMissingPatchTasksForAll(demoState));
  return demoState;
}
