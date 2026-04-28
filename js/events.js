import { $, $all, toast } from "./ui.js";
import { uid, getActiveSubject, upsertSubject, removeSubjectTasks, todayISO } from "./state.js";
import { DEFAULT_VERSIONS_TEXT } from "./config.js";
import { parseCurriculumText, renderTreeHTML, curriculumToText } from "./curriculumParser.js";
import { parseVersionsText, versionsToText } from "./versionEngine.js";
import { generateStudyTasksForSubject, preserveTaskProgress } from "./taskGenerator.js";
import { buildAIPrompt } from "./aiPromptBuilder.js";
import { parseAIJson, reviewAIJson, applyAIJsonToSubject } from "./aiImporter.js";
import { createPerformanceItem, togglePerformanceStage } from "./performanceScheduler.js";
import { exportState, importStateFromFile, clearState } from "./storage.js";

export function bindEvents(context) {
  const { getState, setState, render } = context;

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
    setState(state);
    render();
    toast(`${generated.length}개 태스크를 생성했습니다.`);
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
      type: "problem",
      dailyMinutes: 120,
      versions: parseVersionsText(DEFAULT_VERSIONS_TEXT),
      curriculum: parseCurriculumText("지수와 로그\nㄴ 지수\nㄴㄴ 거듭제곱근\nㄴㄴ 지수의 성질\nㄴ 로그\nㄴㄴ 로그의 뜻\nㄴㄴ 로그의 성질", subjectId)
    };
    const tasks = generateStudyTasksForSubject(subject);
    return {
      schemaVersion: 2,
      activeSubjectId: subjectId,
      subjects: [subject],
      tasks,
      performanceItems: [createPerformanceItem({ subjectId, title: "수학 오답 정리 수행", dueDate: todayISO(), memo: "p0~p4 단계 예시" })]
    };
  }
}
