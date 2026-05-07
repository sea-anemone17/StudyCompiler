import { RESULT_GRADE_OPTIONS, UNDERSTANDING_STAGE_OPTIONS } from "../config.js";
import { escapeHTML } from "../ui.js";

export function renderTaskList(tasks = [], { compact = false } = {}) {
  if (!tasks.length) return `<div class="empty">배정된 태스크가 없습니다.</div>`;
  return tasks.map(task => renderTaskItem(task, { compact })).join("");
}

export function renderTaskItem(task, { compact = false } = {}) {
  const badgeClass = task.type === "patch" ? "patch" : task.type === "review" ? "review" : task.type === "classReview" ? "review" : task.status === "unscheduled" ? "danger" : "";
  return `
    <article class="task-item ${task.status === "done" ? "done" : ""} ${task.status === "unscheduled" ? "unscheduled" : ""}">
      <label class="task-check">
        <input class="task-toggle" type="checkbox" data-task-id="${escapeHTML(task.id)}" data-task-type="${escapeHTML(task.type || "study")}" ${task.status === "done" ? "checked" : ""}>
        <span>${escapeHTML(task.title || task.conceptTitle || "태스크")}</span>
      </label>
      <div class="task-meta">
        <span class="badge ${badgeClass}">${escapeHTML(task.versionId || task.type || "task")}</span>
        <span>${escapeHTML(task.versionLabel || task.type || "")}</span>
        <span>${Number(task.estimatedMinutes || 0)}분</span>
        ${task.scheduledStart ? `<span>${escapeHTML(task.scheduledStart)}~${escapeHTML(task.scheduledEnd || "")}</span>` : ""}
        ${task.patchReason ? `<span>${escapeHTML(task.patchReason)}</span>` : ""}
      </div>
      ${task.conceptPath?.length ? `<div class="muted small">${escapeHTML(task.conceptPath.join(" > "))}</div>` : ""}
      ${task.unscheduledReason ? `<div class="notice warn small">${escapeHTML(task.unscheduledReason)}</div>` : ""}
      ${compact ? "" : renderTaskActions(task)}
      ${compact ? "" : renderTaskMetrics(task)}
    </article>
  `;
}

export function renderTaskMetrics(task) {
  if (!["study", "review", "patch", "classReview", "classStudy", "classExamPrep"].includes(task.type)) return "";

  return `
    <div class="task-metrics">

      ${task.progressMode !== "once" ? `
        <label for="progress-${escapeHTML(task.id)}">
          오늘 진행량 (${escapeHTML(task.progressUnit || "단위")})
        </label>
        <input
          id="progress-${escapeHTML(task.id)}"
          name="progress-${escapeHTML(task.id)}"
          class="task-metric"
          data-task-id="${escapeHTML(task.id)}"
          data-field="progressAmount"
          type="number"
          min="0"
          value="0"
          placeholder="오늘 한 양"
        >

        <label for="next-${escapeHTML(task.id)}">다음 진행일</label>
        <input
          id="next-${escapeHTML(task.id)}"
          name="next-${escapeHTML(task.id)}"
          class="task-metric"
          data-task-id="${escapeHTML(task.id)}"
          data-field="nextDate"
          type="date"
          value="${escapeHTML(task.nextDate || "")}"
        >
      ` : ""}

      <label for="actual-${escapeHTML(task.id)}">실제 시간</label>
      <input
        id="actual-${escapeHTML(task.id)}"
        name="actual-${escapeHTML(task.id)}"
        class="task-metric"
        data-task-id="${escapeHTML(task.id)}"
        data-field="actualMinutes"
        type="number"
        min="0"
        step="5"
        value="${task.actualMinutes ?? ""}"
        placeholder="분"
      >

      <label for="result-${escapeHTML(task.id)}">결과</label>
      <select
        id="result-${escapeHTML(task.id)}"
        name="result-${escapeHTML(task.id)}"
        class="task-metric"
        data-task-id="${escapeHTML(task.id)}"
        data-field="resultGrade"
      >
        ${RESULT_GRADE_OPTIONS.map(option => `
          <option
            value="${escapeHTML(option.value)}"
            ${task.resultGrade === option.value ? "selected" : ""}
          >
            ${escapeHTML(option.label)}
          </option>
        `).join("")}
      </select>

      <label for="understanding-${escapeHTML(task.id)}">설명 단계</label>
      <select
        id="understanding-${escapeHTML(task.id)}"
        name="understanding-${escapeHTML(task.id)}"
        class="task-metric"
        data-task-id="${escapeHTML(task.id)}"
        data-field="understandingStage"
      >
        ${UNDERSTANDING_STAGE_OPTIONS.map(option => `
          <option
            value="${escapeHTML(option.value)}"
            ${task.understandingStage === option.value ? "selected" : ""}
          >
            ${escapeHTML(option.label)}
          </option>
        `).join("")}
      </select>

      <label for="notes-${escapeHTML(task.id)}">메모</label>
      <input
        id="notes-${escapeHTML(task.id)}"
        name="notes-${escapeHTML(task.id)}"
        class="task-metric"
        data-task-id="${escapeHTML(task.id)}"
        data-field="notes"
        type="text"
        value="${escapeHTML(task.notes || "")}"
        placeholder="막힌 지점 / 다음 행동"
      >

      ${task.progressMode !== "once" ? `
        <div class="progress-summary">
          진행률:
          ${Number(task.completedAmount || 0)}
          /
          ${Number(task.targetAmount || 0)}
          ${escapeHTML(task.progressUnit || "")}
        </div>

        <button
          type="button"
          class="save-progress-btn mini"
          data-task-id="${escapeHTML(task.id)}"
        >
          진행 저장
        </button>
      ` : ""}

    </div>
  `;
}

function renderTaskActions(task) {
  if (task.status === "done") {
    return `<div class="task-actions done-label">완료됨</div>`;
  }

  return `
    <div class="task-actions">
      <button
        type="button"
        class="task-start mini"
        data-task-id="${escapeHTML(task.id)}"
      >
        시작
      </button>

      <button
        type="button"
        class="task-finish mini"
        data-task-id="${escapeHTML(task.id)}"
        data-result="done"
      >
        완료
      </button>

      <button
        type="button"
        class="task-finish mini"
        data-task-id="${escapeHTML(task.id)}"
        data-result="partial"
      >
        조금 함
      </button>

      <button
        type="button"
        class="task-skip mini secondary"
        data-task-id="${escapeHTML(task.id)}"
      >
        오늘 넘김
      </button>
    </div>
  `;
}
