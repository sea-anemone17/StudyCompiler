import { escapeHTML, emptyState, ddayLabel, subjectTypeLabel } from "./ui.js";
import { todayISO, addDaysISO } from "./state.js";
import { formatKoreanDate, getWeekDates } from "./scheduler.js";
import { getPerformanceDueItemsForDates, getPerformanceProgress, getPerformanceTasksForDate } from "./performanceScheduler.js";
import { getLeafNodes, getNodePath } from "./curriculumParser.js";
import { sortTasksForDisplay, getCapacityWarnings } from "./planner/rescheduleEngine.js";
import { renderTaskItem } from "./ui/renderTaskList.js";

export function renderSubjectList(state) {
  if (!state.subjects.length) return emptyState("과목을 추가해 주세요.");
  return state.subjects.map(subject => `
    <article class="subject-card ${state.activeSubjectId === subject.id ? "active" : ""}" data-subject-id="${escapeHTML(subject.id)}">
      <strong>${escapeHTML(subject.name)}</strong>
      <span>${subjectTypeLabel(subject.type)} · ${ddayLabel(subject.examDate)}</span>
      <small>진도 마감: 시험 ${Number(subject.studyFinishBufferDays ?? 7)}일 전</small>
    </article>
  `).join("");
}

export function renderQuickStats(state, selectedDate = todayISO()) {
  const todayTasks = getTasksForDate(state, selectedDate);
  const weekDates = getWeekDates(selectedDate);
  const weekStudyCount = state.tasks.filter(task => task.status !== "deferred" && weekDates.includes(task.scheduledDate)).length;
  const done = todayTasks.filter(task => task.status === "done").length;
  const pending = todayTasks.length - done;
  const subjects = state.subjects.length;
  const performances = state.performanceItems.filter(item => item.stages?.some(stage => stage.status !== "done")).length;
  const reviewCount = state.tasks.filter(task => (task.type === "review" || task.type === "classReview") && task.status !== "done").length;
  const patchCount = state.tasks.filter(task => task.type === "patch" && task.status !== "done").length;
  const unscheduledCount = state.tasks.filter(task => task.status === "unscheduled").length;
  return `
    <div class="stat-card"><span>과목</span><strong>${subjects}</strong></div>
    <div class="stat-card"><span>오늘 태스크</span><strong>${todayTasks.length}</strong></div>
    <div class="stat-card"><span>완료</span><strong>${done}</strong></div>
    <div class="stat-card"><span>남음</span><strong>${pending}</strong></div>
    <div class="stat-card"><span>이번 주 학습</span><strong>${weekStudyCount}</strong></div>
    <div class="stat-card"><span>복습 대기</span><strong>${reviewCount}</strong></div>
    <div class="stat-card"><span>패치 대기</span><strong>${patchCount}</strong></div>
    <div class="stat-card"><span>미배치</span><strong>${unscheduledCount}</strong></div>
    <div class="stat-card"><span>수행평가</span><strong>${performances}</strong></div>
  `;
}

export function renderTodayBuild(state, selectedDate = todayISO()) {
  const tasks = getTasksForDate(state, selectedDate);
  if (!tasks.length) return emptyState("오늘 배정된 태스크가 없습니다. 요일별 시간표와 과목 범위를 확인하세요.");
  return sortTasksForDisplay(tasks).map(task => renderTaskItem(task)).join("");
}

export function renderWeekBuild(state, selectedDate = todayISO()) {
  const dates = getWeekDates(selectedDate);
  const dueItems = getPerformanceDueItemsForDates(state.performanceItems, dates);
  return `
    <div class="week-grid">
      ${dates.map(date => {
        const dayStudyTasks = sortTasksForDisplay(state.tasks.filter(task => task.scheduledDate === date));
        const dayDueItems = dueItems.filter(item => item.dueDate === date);
        const isToday = date === todayISO();
        const used = dayStudyTasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0);
        return `
          <section class="day-card ${isToday ? "today" : ""}">
            <h3>${formatKoreanDate(date)} ${isToday ? "오늘" : `<span>${used}분</span>`}</h3>
            ${dayStudyTasks.length ? dayStudyTasks.map(task => renderTaskItem(task, { compact: true })).join("") : `<p class="muted">학습 태스크 없음</p>`}
            ${dayDueItems.map(renderPerformanceDue).join("")}
          </section>
        `;
      }).join("")}
    </div>
  `;
}

export function renderCalendarMonth(state, monthValue) {
  const base = monthValue || todayISO().slice(0, 7);
  const [year, month] = base.split("-").map(Number);
  if (!year || !month) return emptyState("월 정보를 읽을 수 없습니다.");
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startOffset = first.getDay();
  const totalCells = Math.ceil((startOffset + last.getDate()) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i += 1) {
    const dayNum = i - startOffset + 1;
    const date = new Date(year, month - 1, dayNum);
    const dateISO = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const inMonth = date.getMonth() === month - 1;
    const tasks = sortTasksForDisplay((state.tasks || []).filter(task => task.scheduledDate === dateISO));
    const dueItems = (state.performanceItems || []).filter(item => item.dueDate === dateISO);
    const used = tasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0);
    cells.push(`
      <div class="calendar-cell ${inMonth ? "" : "muted"}">
        <strong>${date.getDate()}</strong>${used ? `<small>${used}분</small>` : ""}
        ${tasks.slice(0, 5).map(renderCalendarTask).join("")}
        ${dueItems.slice(0, 3).map(item => `<div class="calendar-task performance">마감 · ${escapeHTML(item.title)}</div>`).join("")}
        ${tasks.length + dueItems.length > 8 ? `<small>+${tasks.length + dueItems.length - 8}개 더</small>` : ""}
      </div>
    `);
  }
  return `<div class="calendar-grid">${["일", "월", "화", "수", "목", "금", "토"].map(day => `<b>${day}</b>`).join("")}${cells.join("")}</div>`;
}

export function renderCapacityWarnings(state) {
  const warnings = getCapacityWarnings(state);
  if (!warnings.length) return `<div class="notice ok">용량 경고 없음<br><small>현재 시간 블록 기준으로 강제 과밀 배치가 없습니다.</small></div>`;
  return `<div class="notice warn"><strong>계획 경고 ${warnings.length}건</strong><ul>${warnings.slice(0, 12).map(w => `<li>${escapeHTML(w.message)}</li>`).join("")}</ul>${warnings.length > 12 ? `<small>외 ${warnings.length - 12}건이 더 있습니다.</small>` : ""}</div>`;
}

export function renderRebuildPreview(plan) {
  if (!plan) return `<div class="empty">재빌드 미리보기 없음<br><small>먼저 “재빌드 미리보기”를 눌러 변경될 내용을 확인하세요.</small></div>`;
  const actions = plan.actions || [];
  return `<div class="notice"><strong>재빌드 미리보기</strong><p>기준일 ${escapeHTML(plan.anchorDate)} · 이동 ${actions.length}개 · 경고 ${plan.capacityWarnings?.length || 0}개</p>${actions.length ? `<ul>${actions.slice(0, 40).map(action => `<li>${escapeHTML(action.reason)} ${escapeHTML(action.title)}: ${escapeHTML(action.from)} → ${escapeHTML(action.to)}</li>`).join("")}</ul>` : "변경할 항목이 없습니다."}</div>`;
}

export function renderVersionBoard(subject, tasks) {
  if (!subject?.curriculum?.length || !subject?.versions?.length) return emptyState("과목 범위와 버전을 입력하면 보드가 표시됩니다.");
  const leaves = getLeafNodes(subject.curriculum);
  if (!leaves.length) return emptyState("가장 아래 개념 노드가 필요합니다.");
  const versions = subject.versions.filter(version => !String(version.id).includes(".5") && !String(version.id).startsWith("R"));
  const subjectTasks = tasks.filter(task => task.subjectId === subject.id && task.type === "study");
  return `<table class="version-board"><thead><tr><th>개념</th>${versions.map(v => `<th>${escapeHTML(v.id)}</th>`).join("")}</tr></thead><tbody>${leaves.map(leaf => {
    const path = getNodePath(subject.curriculum, leaf.id);
    return `<tr><th>${escapeHTML(path.join(" > "))}</th>${versions.map(version => {
      const task = subjectTasks.find(item => item.conceptId === leaf.id && item.versionId === version.id);
      const mark = task?.status === "done" ? "✓" : task?.status === "unscheduled" ? "!" : task ? "·" : "-";
      return `<td title="${escapeHTML(task?.scheduledDate || "")}">${mark}</td>`;
    }).join("")}</tr>`;
  }).join("")}</tbody></table>`;
}

export function renderPerformanceList(state) {
  if (!state.performanceItems.length) return emptyState("수행평가를 추가해 주세요.");
  return state.performanceItems.map(item => {
    const subject = state.subjects.find(s => s.id === item.subjectId);
    const progress = getPerformanceProgress(item);
    return `<article class="performance-card"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(subject?.name || "미지정")} · ${ddayLabel(item.dueDate)} · ${escapeHTML(item.dueDate)} · ${progress.done}/${progress.total}</p><button class="delete-performance" data-performance-id="${escapeHTML(item.id)}">삭제</button>${item.memo ? `<p>${escapeHTML(item.memo)}</p>` : ""}${(item.stages || []).map(stage => `<label><input class="performance-stage-toggle" type="checkbox" data-performance-id="${escapeHTML(item.id)}" data-stage-id="${escapeHTML(stage.id)}" ${stage.status === "done" ? "checked" : ""}> ${escapeHTML(stage.id)} ${escapeHTML(stage.label)}</label>`).join("")}</article>`;
  }).join("");
}

export function renderPerformanceSubjectOptions(subjects) {
  if (!subjects.length) return `<option value="">과목 없음</option>`;
  return subjects.map(subject => `<option value="${escapeHTML(subject.id)}">${escapeHTML(subject.name)}</option>`).join("");
}

function renderCalendarTask(task) {
  const typeClass = task.type === "patch" ? "patch" : (task.type === "review" || task.type === "classReview") ? "review" : task.status === "unscheduled" ? "danger" : "";
  return `<div class="calendar-task ${typeClass}">${escapeHTML(task.versionId || task.type)} · ${escapeHTML(task.conceptTitle || task.title)}</div>`;
}

function renderPerformanceDue(item) {
  const progress = getPerformanceProgress(item);
  return `<div class="performance-due">마감 ${escapeHTML(item.title)} (${progress.done}/${progress.total})</div>`;
}

function getTasksForDate(state, selectedDate) {
  const study = state.tasks.filter(task => task.status !== "deferred" && task.scheduledDate === selectedDate);
  const perf = getPerformanceTasksForDate(state.performanceItems, selectedDate);
  return [...study, ...perf];
}
