import { $, $all, toast } from "./ui.js";
import { uid, getActiveSubject, upsertSubject, removeSubjectTasks, todayISO } from "./state.js";
import { DEFAULT_VERSIONS_TEXT } from "./config.js";
import { parseCurriculumText, renderTreeHTML, curriculumToText } from "./curriculumParser.js";
import { parseVersionsText, versionsToText } from "./versionEngine.js";
import { generateStudyTasksForSubject, preserveTaskProgress } from "./taskGenerator.js";
import { buildAIPrompt } from "./aiPromptBuilder.js";
import { parseAIJson, reviewAIJson, applyAIJsonToSubject } from "./aiImporter.js";
import { createPerformanceItem, togglePerformanceStage } from "./performanceScheduler.js";
import { createReviewTasks, createMissingReviewTasksForAll } from "./reviewEngine.js";
import { createPatchTask, createMissingPatchTasksForAll } from "./patchEngine.js";
import { exportState, importStateFromFile, clearState } from "./storage.js";
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

  $("#newSubjectBtn").addEventListener("click", () => {
    const state = getState();
    const subject = {
      id: uid("subject"),
      name: "새 과목",
      examDate: todayISO(),
      type: "problem",
      dailyMinutes: 120,
      curriculum: [],
      versions: parseVersionsText(DEFAULT_VERSIONS_TEXT)
    };
    upsertSubject(state, subject);
    setState(state);
    fillSubjectForm(subject);
    render();
    toast("새 과목을 만들었습니다.");
  });

  $("#subjectForm").addEventListener("submit", event => {
    event.preventDefault();
    const state = getState();
    const active = getActiveSubject(state);
    const subject = {
      ...(active || {}),
      id: $("#subjectId").value || active?.id || uid("subject"),
      name: $("#subjectName").value.trim() || "이름 없는 과목",
      examDate: $("#examDate").value || todayISO(),
      type: $("#subjectType").value,
      dailyMinutes: Number($("#dailyMinutes").value || 120),
      curriculum: active?.curriculum || [],
      versions: active?.versions || parseVersionsText(DEFAULT_VERSIONS_TEXT)
    };
    upsertSubject(state, subject);
    setState(state);
    render();
    toast("과목을 저장했습니다.");
  });

  $("#saveVersionsBtn").addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");
    subject.versions = parseVersionsText($("#versionsInput").value);
    upsertSubject(state, subject);
    setState(state);
    render();
    toast("버전을 저장했습니다.");
  });

  $("#parseCurriculumBtn").addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");
    subject.curriculum = parseCurriculumText($("#curriculumInput").value, subject.id);
    upsertSubject(state, subject);
    setState(state);
    render();
    toast("시험범위 트리를 저장했습니다.");
  });

  $("#generateTasksBtn").addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");
    if (!subject.curriculum?.length) return toast("시험범위 트리를 먼저 저장해 주세요.");
    if (!subject.versions?.length) subject.versions = parseVersionsText(DEFAULT_VERSIONS_TEXT);
    const oldSubjectTasks = state.tasks.filter(task => task.subjectId === subject.id && task.type === "study");
    const generated = preserveTaskProgress(generateStudyTasksForSubject(subject), oldSubjectTasks);
    removeSubjectTasks(state, subject.id);
    state.tasks.push(...generated);
    const extras = [...createMissingReviewTasksForAll(state), ...createMissingPatchTasksForAll(state)];
    state.tasks.push(...extras);
    setState(state);
    render();
    toast(`${generated.length}개 태스크를 생성했습니다.${extras.length ? ` 복습/패치 ${extras.length}개도 추가했습니다.` : ""}`);
  });

  $("#buildPromptBtn").addEventListener("click", () => {
    const subject = getActiveSubject(getState());
    $("#aiPromptOutput").value = buildAIPrompt(subject);
    toast("AI 프롬프트를 생성했습니다.");
  });

  $("#copyPromptBtn").addEventListener("click", async () => {
    const value = $("#aiPromptOutput").value;
    if (!value) return toast("복사할 프롬프트가 없습니다.");
    await navigator.clipboard.writeText(value);
    toast("프롬프트를 복사했습니다.");
  });

  $("#validateJsonBtn").addEventListener("click", () => {
    try {
      const parsed = parseAIJson($("#aiJsonInput").value);
      const review = reviewAIJson(parsed);
      $("#jsonReview").innerHTML = renderJsonReview(review);
      toast("JSON 검토를 완료했습니다.");
    } catch (error) {
      $("#jsonReview").innerHTML = `<strong>오류:</strong> ${error.message}`;
      toast("JSON을 읽지 못했습니다.");
    }
  });

  $("#applyJsonBtn").addEventListener("click", () => {
    try {
      const state = getState();
      const parsed = parseAIJson($("#aiJsonInput").value);
      const subject = applyAIJsonToSubject(parsed, getActiveSubject(state));
      upsertSubject(state, subject);
      setState(state);
      fillSubjectForm(subject);
      render();
      toast("AI JSON을 적용했습니다.");
    } catch (error) {
      toast(`적용 실패: ${error.message}`);
    }
  });

  $("#performanceForm").addEventListener("submit", event => {
    event.preventDefault();
    const state = getState();
    const subjectId = $("#performanceSubject").value || state.subjects[0]?.id;
    if (!subjectId) return toast("과목을 먼저 추가해 주세요.");
    state.performanceItems.push(createPerformanceItem({
      subjectId,
      title: $("#performanceTitle").value.trim(),
      dueDate: $("#performanceDue").value,
      memo: $("#performanceMemo").value.trim()
    }));
    event.target.reset();
    setState(state);
    render();
    toast("수행평가를 추가했습니다.");
  });

  $("#buildDate").addEventListener("change", render);
  $("#calendarMonth")?.addEventListener("change", render);

  $("#exportBtn").addEventListener("click", () => exportState(getState()));
  $("#importFile").addEventListener("change", async event => {
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

  $("#seedDemoBtn").addEventListener("click", () => {
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
    const state = applyRebuildPlan(getState(), plan);
    setState(state);
    setLatestRebuildPreview?.(null);
    render();
    toast("재빌드를 적용했습니다.");
  });

  $("#resetBtn").addEventListener("click", () => {
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
        const date = new Date(`${task.scheduledDate}T00:00:00`);
        date.setDate(date.getDate() + 1);
        task.scheduledDate = date.toISOString().slice(0, 10);
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
    $("#subjectId").value = subject.id || "";
    $("#subjectName").value = subject.name || "";
    $("#examDate").value = subject.examDate || todayISO();
    $("#subjectType").value = subject.type || "problem";
    $("#dailyMinutes").value = subject.dailyMinutes || 120;
    $("#versionsInput").value = versionsToText(subject.versions || []);
    $("#curriculumInput").value = curriculumToText(subject.curriculum || []);
    $("#curriculumPreview").innerHTML = renderTreeHTML(subject.curriculum || []);
  }

  function renderJsonReview(review) {
    return `
      <div><strong>과목:</strong> ${review.subject}</div>
      <div><strong>시험일:</strong> ${review.examDate}</div>
      <div><strong>유형:</strong> ${review.type}</div>
      <div><strong>개념 수:</strong> ${review.conceptCount}</div>
      <div><strong>버전 규칙:</strong> ${review.versionCount}</div>
      ${review.warnings.length ? `<ul>${review.warnings.map(w => `<li>${w}</li>`).join("")}</ul>` : "<p>큰 문제는 없어 보입니다.</p>"}
    `;
  }

  function createDemoState() {
    const subjectId = uid("subject");
    const subject = {
      id: subjectId,
      name: "수학",
      examDate: todayISO(),
      type: "mixed",
      dailyMinutes: 120,
      versions: parseVersionsText(DEFAULT_VERSIONS_TEXT),
      curriculum: parseCurriculumText("지수와 로그\nㄴ 지수\nㄴㄴ 거듭제곱근\nㄴㄴ 지수의 성질\nㄴ 로그\nㄴㄴ 로그의 뜻\nㄴㄴ 로그의 성질", subjectId)
    };
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
      performanceItems: [createPerformanceItem({ subjectId, title: "수학 오답 정리 수행", dueDate: todayISO(), memo: "p0~p4 단계 예시" })]
    };
    demoState.tasks.push(...createMissingReviewTasksForAll(demoState));
    demoState.tasks.push(...createMissingPatchTasksForAll(demoState));
    return demoState;
  }
}
