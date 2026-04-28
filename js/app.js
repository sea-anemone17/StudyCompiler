import { loadState, saveState } from "./storage.js";
import { getActiveSubject, todayISO } from "./state.js";
import { $, toast } from "./ui.js";
import { bindEvents } from "./events.js";
import { renderSubjectList, renderQuickStats, renderTodayBuild, renderWeekBuild, renderCalendarMonth, renderCapacityWarnings, renderRebuildPreview, renderVersionBoard, renderPerformanceList, renderPerformanceSubjectOptions } from "./dashboardRenderer.js";
import { renderTreeHTML, curriculumToText } from "./curriculumParser.js";
import { versionsToText } from "./versionEngine.js";
import { renderSync } from "./renderSync.js";

let state = loadState();
let latestRebuildPreview = null;

function getState() {
  return state;
}

function getLatestRebuildPreview() {
  return latestRebuildPreview;
}

function setLatestRebuildPreview(plan) {
  latestRebuildPreview = plan;
}

function setState(nextState) {
  state = nextState;
  saveState(state);
}

function render() {
  const selectedDate = $("#buildDate")?.value || todayISO();
  const activeSubject = getActiveSubject(state);

  if ($("#buildDate") && !$("#buildDate").value) $("#buildDate").value = todayISO();
  if ($("#calendarMonth") && !$("#calendarMonth").value) $("#calendarMonth").value = selectedDate.slice(0, 7);

  if ($("#syncView")) {
    renderSync($("#syncView"));
  }

  $("#subjectList").innerHTML = renderSubjectList(state);
  $("#quickStats").innerHTML = renderQuickStats(state, selectedDate);
  $("#todayBuild").innerHTML = renderTodayBuild(state, selectedDate);
  $("#weekBuild").innerHTML = renderWeekBuild(state, selectedDate);
  if ($("#calendarView")) $("#calendarView").innerHTML = renderCalendarMonth(state, $("#calendarMonth")?.value || selectedDate.slice(0, 7));
  if ($("#capacityWarnings")) $("#capacityWarnings").innerHTML = renderCapacityWarnings(state);
  if ($("#rebuildPreview")) $("#rebuildPreview").innerHTML = renderRebuildPreview(latestRebuildPreview);
  $("#versionBoard").innerHTML = renderVersionBoard(activeSubject, state.tasks);
  $("#performanceSubject").innerHTML = renderPerformanceSubjectOptions(state.subjects);
  $("#performanceList").innerHTML = renderPerformanceList(state);
  $("#debugState").textContent = JSON.stringify(state, null, 2);

  fillActiveSubjectForm(activeSubject);
}

function fillActiveSubjectForm(subject) {
  if (!subject) {
    $("#subjectId").value = "";
    $("#subjectName").value = "";
    $("#examDate").value = todayISO();
    $("#subjectType").value = "problem";
    $("#dailyMinutes").value = 120;
    $("#versionsInput").value = "v0: 개념서\nv1: 기본 유형서\nv2: 중난도 유형서\nv3: 심화서";
    $("#curriculumInput").value = "";
    $("#curriculumPreview").innerHTML = "";
    return;
  }

  $("#subjectId").value = subject.id || "";
  $("#subjectName").value = subject.name || "";
  $("#examDate").value = subject.examDate || todayISO();
  $("#subjectType").value = subject.type || "problem";
  $("#dailyMinutes").value = subject.dailyMinutes || 120;
  $("#versionsInput").value = versionsToText(subject.versions || []);
  $("#curriculumInput").value = curriculumToText(subject.curriculum || []);
  $("#curriculumPreview").innerHTML = renderTreeHTML(subject.curriculum || []);
}

bindEvents({ getState, setState, render, getLatestRebuildPreview, setLatestRebuildPreview });
render();
toast("Study Compiler v3.5 준비 완료");
