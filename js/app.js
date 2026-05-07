import { loadState, saveState } from "./data/storage.js";
import { getActiveSubject, todayISO } from "./state.js";
import { $, toast } from "./ui.js";
import { bindEvents } from "./ui/events/index.js";
import {
  renderSubjectList,
  renderQuickStats,
  renderTodayBuild,
  renderWeekBuild,
  renderCalendarMonth,
  renderCapacityWarnings,
  renderRebuildPreview,
  renderVersionBoard,
  renderPerformanceList,
  renderPerformanceSubjectOptions
} from "./dashboardRenderer.js";
import { renderTreeHTML, curriculumToText } from "./curriculumParser.js";
import { versionsToText } from "./versionEngine.js";
import { renderSync } from "./ui/renderSync.js";
import { renderScheduleSettings } from "./ui/renderScheduleSettings.js";
import { renderClassProgress } from "./ui/renderClassProgress.js";
import { scheduleAllPending } from "./planner/planner.js";
import { normalizePastUnresolvedTasks } from "./planner/taskRecovery.js";
import { renderRecoveryPanel } from "./ui/renderTaskRecovery.js";

let loadedState = loadState();
loadedState = normalizePastUnresolvedTasks(loadedState, todayISO());
let state = scheduleAllPending(loadedState, { anchorDate: todayISO() });
saveState(state);

let latestRebuildPreview = null;

function getState() { return state; }
function getLatestRebuildPreview() { return latestRebuildPreview; }
function setLatestRebuildPreview(plan) { latestRebuildPreview = plan; }
function setState(nextState) {
  state = nextState;
  saveState(state);
}

function render() {
  const selectedDate = $("#buildDate")?.value || todayISO();
  const activeSubject = getActiveSubject(state);
  if ($("#buildDate") && !$("#buildDate").value) $("#buildDate").value = todayISO();
  if ($("#calendarMonth") && !$("#calendarMonth").value) $("#calendarMonth").value = selectedDate.slice(0, 7);
  if ($("#syncView")) renderSync($("#syncView"));
  if ($("#scheduleSettingsView")) renderScheduleSettings($("#scheduleSettingsView"), state);
  if ($("#classProgressView")) renderClassProgress($("#classProgressView"), state);
  if ($("#subjectList")) $("#subjectList").innerHTML = renderSubjectList(state);
  if ($("#quickStats")) $("#quickStats").innerHTML = renderQuickStats(state, selectedDate);
  if ($("#todayBuild")) $("#todayBuild").innerHTML = renderTodayBuild(state, selectedDate);
  if ($("#weekBuild")) $("#weekBuild").innerHTML = renderWeekBuild(state, selectedDate);
  if ($("#calendarView")) $("#calendarView").innerHTML = renderCalendarMonth(state, $("#calendarMonth")?.value || selectedDate.slice(0, 7));
  if ($("#capacityWarnings")) $("#capacityWarnings").innerHTML = renderCapacityWarnings(state);
  if ($("#rebuildPreview")) $("#rebuildPreview").innerHTML = renderRebuildPreview(latestRebuildPreview);
  if ($("#versionBoard")) $("#versionBoard").innerHTML = renderVersionBoard(activeSubject, state.tasks);
  if ($("#performanceSubject")) $("#performanceSubject").innerHTML = renderPerformanceSubjectOptions(state.subjects);
  if ($("#performanceList")) $("#performanceList").innerHTML = renderPerformanceList(state);
  if ($("#debugState")) $("#debugState").textContent = JSON.stringify(state, null, 2);
  if ($("#recoveryPanel")) {
    $("#recoveryPanel").innerHTML = renderRecoveryPanel(state);
  }
  fillActiveSubjectForm(activeSubject);
}

function fillActiveSubjectForm(subject) {
  if (!subject) {
    if ($("#subjectId")) $("#subjectId").value = "";
    if ($("#subjectName")) $("#subjectName").value = "";
    if ($("#examDate")) $("#examDate").value = todayISO();
    if ($("#subjectType")) $("#subjectType").value = "problem";
    if ($("#planningMode")) $("#planningMode").value = "examRange";
    if ($("#dailyMinutes")) $("#dailyMinutes").value = 120;
    if ($("#studyFinishBufferDays")) $("#studyFinishBufferDays").value = 7;
    if ($("#versionsInput")) $("#versionsInput").value = "v0: 개념서\nv1: 기본 유형서\nv2: 중난도 유형서\nv3: 심화서";
    if ($("#curriculumInput")) $("#curriculumInput").value = "";
    if ($("#curriculumPreview")) $("#curriculumPreview").innerHTML = "";
    return;
  }
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

bindEvents({ getState, setState, render, getLatestRebuildPreview, setLatestRebuildPreview });
render();
toast("Study Compiler v4.0 Planner 준비 완료");
