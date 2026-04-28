import { escapeHTML, emptyState, ddayLabel, subjectTypeLabel } from "./ui.js";
import { todayISO } from "./state.js";
import { formatKoreanDate, getWeekDates } from "./scheduler.js";
import { getPerformanceDueItemsForDates, getPerformanceProgress, getPerformanceTasksForDate } from "./performanceScheduler.js";
import { getLeafNodes, getNodePath } from "./curriculumParser.js";
import { sortTasksForDisplay } from "./rescheduler.js";

export function renderSubjectList(state) {
  if (!state.subjects.length) return emptyState("과목을 추가해 주세요.");
  return state.subjects.map(subject => `
    <article class="subject-card ${subject.id === state.activeSubjectId ? "active" : ""}" data-subject-id="${subject.id}">
      <strong>${escapeHTML(subject.name)}</strong>
      <div class="subject-meta">
        <span>${subjectTypeLabel(subject.type)}</span>
        <span>${ddayLabel(subject.examDate)}</span>
      </div>
    </article>
  `).join("");
}

export function renderQuickStats(state, selectedDate = todayISO()) {
  const todayTasks = getTasksForDate(state, selectedDate);
  const weekDates = getWeekDates(selectedDate);
  const weekStudyCount = state.tasks.filter(task => weekDates.includes(task.scheduledDate)).length;
  const done = todayTasks.filter(task => task.status === "done").length;
  const pending = todayTasks.length - done;
  const subjects = state.subjects.length;
  const performances = state.performanceItems.filter(item => item.stages?.some(stage => stage.status !== "done")).length;
  const reviewCount = state.tasks.filter(task => task.type === "review" && task.status !== "done").length;
  const patchCount = state.tasks.filter(task => task.type === "patch" && task.status !== "done").length;
  return `
    <div class="stat"><span>과목</span><strong>${subjects}</strong></div>
    <div class="stat"><span>오늘 태스크</span><strong>${todayTasks.length}</strong></div>
    <div class="stat"><span>완료</span><strong>${done}</strong></div>
    <div class="stat"><span>남음</span><strong>${pending}</strong></div>
    <div class="stat"><span>이번 주 학습</span><strong>${weekStudyCount}</strong></div>
    <div class="stat"><span>복습 대기</span><strong>${reviewCount}</strong></div>
    <div class="stat"><span>패치 대기</span><strong>${patchCount}</strong></div>
    <div class="stat"><span>수행평가</span><strong>${performances}</strong></div>
  `;
}

export function renderTodayBuild(state, selectedDate = todayISO()) {
  const tasks = getTasksForDate(state, selectedDate);
  if (!tasks.length) return emptyState("오늘 배정된 태스크가 없습니다. 과목/범위를 입력하고 태스크를 생성하세요.");
  return sortTasksForDisplay(tasks).map(renderTaskItem).join("");
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
        return `
          <section class="week-day ${isToday ? "today" : ""}">
            <div class="week-day-head">
              <strong>${formatKoreanDate(date)}</strong>
              <span>${isToday ? "오늘" : ""}</span>
            </div>
            ${dayStudyTasks.length ? dayStudyTasks.map(renderWeekTask).join("") : `<p class="week-empty">학습 태스크 없음</p>`}
            ${dayDueItems.map(renderPerformanceDue).join("")}
          </section>
        `;
      }).join("")}
    </div>
  `;
}

export function renderVersionBoard(subject, tasks) {
  if (!subject?.curriculum?.length || !subject?.versions?.length) return emptyState("과목 범위와 버전을 입력하면 보드가 표시됩니다.");
  const leaves = getLeafNodes(subject.curriculum);
  if (!leaves.length) return emptyState("가장 아래 개념 노드가 필요합니다.");
  const versions = subject.versions.filter(version => !String(version.id).includes(".5") && !String(version.id).startsWith("R"));
  const subjectTasks = tasks.filter(task => task.subjectId === subject.id && task.type === "study");

  return `
    <table class="version-table">
      <thead><tr><th>개념</th>${versions.map(v => `<th>${escapeHTML(v.id)}</th>`).join("")}</tr></thead>
      <tbody>
        ${leaves.map(leaf => {
          const path = getNodePath(subject.curriculum, leaf.id);
          return `<tr>
            <td title="${escapeHTML(path.join(" > "))}">${escapeHTML(leaf.title)}</td>
            ${versions.map(version => {
              const task = subjectTasks.find(item => item.conceptId === leaf.id && item.versionId === version.id);
              const done = task?.status === "done";
              const scheduled = task?.scheduledDate;
              return `<td title="${escapeHTML(scheduled || "미생성")}"><span class="status-dot ${done ? "done" : task ? "pending" : "missing"}">${done ? "✓" : task ? "·" : "-"}</span></td>`;
            }).join("")}
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

export function renderPerformanceList(state) {
  if (!state.performanceItems.length) return emptyState("수행평가를 추가해 주세요.");
  return state.performanceItems.map(item => {
    const subject = state.subjects.find(s => s.id === item.subjectId);
    const progress = getPerformanceProgress(item);
    return `
      <article class="performance-card" data-performance-id="${item.id}">
        <div class="performance-head">
          <div>
            <h3>${escapeHTML(item.title)}</h3>
            <div class="task-path">${escapeHTML(subject?.name || "미지정")} · ${ddayLabel(item.dueDate)} · ${escapeHTML(item.dueDate)} · ${progress.done}/${progress.total}</div>
          </div>
          <button class="mini danger delete-performance" data-performance-id="${item.id}">삭제</button>
        </div>
        <div class="progress-bar"><span style="width:${progress.percent}%"></span></div>
        ${item.memo ? `<p class="hint">${escapeHTML(item.memo)}</p>` : ""}
        ${(item.stages || []).map(stage => `
          <label class="stage-row">
            <input type="checkbox" class="performance-stage-toggle" data-performance-id="${item.id}" data-stage-id="${stage.id}" ${stage.status === "done" ? "checked" : ""} />
            <strong>${escapeHTML(stage.id)}</strong>
            <span>${escapeHTML(stage.label)}</span>
          </label>
        `).join("")}
      </article>
    `;
  }).join("");
}

export function renderPerformanceSubjectOptions(subjects) {
  if (!subjects.length) return `<option value="">과목 없음</option>`;
  return subjects.map(subject => `<option value="${subject.id}">${escapeHTML(subject.name)}</option>`).join("");
}

function renderTaskItem(task) {
  const badgeClass = task.type === "performance" ? "performance" : task.type === "review" ? "review" : task.type === "patch" ? "patch" : "";
  const isStudyLike = ["study", "review", "patch"].includes(task.type);
  return `
    <article class="task-item ${task.status === "done" ? "done" : ""}" data-task-id="${task.id}" data-task-type="${task.type}">
      <input type="checkbox" class="task-toggle" data-task-id="${task.id}" data-task-type="${task.type}" ${task.status === "done" ? "checked" : ""} />
      <div>
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-path">${escapeHTML((task.conceptPath || []).join(" > "))}</div>
        <div class="badges">
          <span class="badge ${badgeClass}">${escapeHTML(task.versionId || task.type)}</span>
          <span class="badge">${escapeHTML(task.versionLabel || task.type)}</span>
          <span class="badge">${Number(task.estimatedMinutes || 0)}분</span>
          ${task.patchReason ? `<span class="badge patch">${escapeHTML(task.patchReason)}</span>` : ""}
          ${task.dueDate ? `<span class="badge performance">마감 ${escapeHTML(task.dueDate)}</span>` : ""}
        </div>
        ${isStudyLike ? renderMetrics(task) : ""}
      </div>
      <div class="task-actions">
        ${isStudyLike ? `<button class="mini delay-task" data-task-id="${task.id}">내일</button>` : ""}
      </div>
    </article>
  `;
}

function renderMetrics(task) {
  return `
    <div class="metric-grid">
      <label>실제 시간<input class="task-metric" data-task-id="${task.id}" data-field="actualMinutes" type="number" min="0" step="5" value="${escapeHTML(task.actualMinutes ?? "")}" placeholder="분" /></label>
      <label>정답률<input class="task-metric" data-task-id="${task.id}" data-field="accuracy" type="number" min="0" max="100" step="5" value="${escapeHTML(task.accuracy ?? "")}" placeholder="%" /></label>
      <label>이해도<select class="task-metric" data-task-id="${task.id}" data-field="understanding">
        ${["", "1", "2", "3", "4", "5"].map(value => `<option value="${value}" ${String(task.understanding ?? "") === value ? "selected" : ""}>${value || "-"}</option>`).join("")}
      </select></label>
      <label>메모<input class="task-metric" data-task-id="${task.id}" data-field="notes" type="text" value="${escapeHTML(task.notes || "")}" placeholder="오답 원인/느낌" /></label>
    </div>
  `;
}

function renderWeekTask(task) {
  const typeClass = task.type === "patch" ? "patch" : task.type === "review" ? "review" : task.type === "performance" ? "performance" : "";
  return `
    <div class="week-task ${task.status === "done" ? "done" : ""} ${typeClass}">
      <span class="week-version">${escapeHTML(task.versionId)}</span>
      <span>${escapeHTML(task.conceptTitle || task.title)}</span>
    </div>
  `;
}

function renderPerformanceDue(item) {
  const progress = getPerformanceProgress(item);
  return `
    <div class="week-task due">
      <span class="week-version">마감</span>
      <span>${escapeHTML(item.title)} (${progress.done}/${progress.total})</span>
    </div>
  `;
}

function getTasksForDate(state, selectedDate) {
  const study = state.tasks.filter(task => task.scheduledDate === selectedDate);
  const perf = getPerformanceTasksForDate(state.performanceItems, selectedDate);
  return [...study, ...perf];
}
