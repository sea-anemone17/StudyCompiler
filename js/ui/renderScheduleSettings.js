import { WEEKDAY_LABELS } from "../core/dateUtils.js";
import { normalizeWeeklyAvailability } from "../core/capacityModel.js";
import { escapeHTML } from "../ui.js";

export function renderScheduleSettings(container, state) {
  if (!container) return;
  const weekly = normalizeWeeklyAvailability(state.weeklyAvailability);
  const subjects = state.subjects || [];
  container.innerHTML = `
    <section class="card schedule-settings">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">Constraint Scheduler</p>
          <h2>요일별 공부 가능 시간</h2>
        </div>
        <button id="saveScheduleSettingsBtn" type="button" class="accent">시간표 저장 후 전체 재배치</button>
      </div>
      <p class="hint">각 시간 블록마다 가능한 과목과 우선 과목을 고를 수 있습니다. 가능한 과목을 비워 두면 전 과목 가능으로 처리합니다.</p>
      ${subjects.length ? `<div class="subject-id-guide">${subjects.map(s => `<span class="badge" title="${escapeHTML(s.id)}">${escapeHTML(s.name)}</span>`).join("")}</div>` : `<div class="notice warn">과목을 먼저 만들면 요일별 과목 선택이 더 쉬워집니다.</div>`}
      <div class="weekly-availability-editor">
        ${weekly.map(entry => renderDay(entry, subjects)).join("")}
      </div>
    </section>
  `;
}

function renderDay(entry, subjects) {
  return `
    <details class="day-editor" open>
      <summary>${WEEKDAY_LABELS[entry.weekday]}요일 <small>${(entry.blocks || []).length}개 블록</small></summary>
      <div class="day-blocks" data-weekday="${entry.weekday}">
        ${(entry.blocks || []).map((block, index) => renderBlock(entry.weekday, block, index, subjects)).join("")}
      </div>
      <button type="button" class="add-schedule-block mini" data-weekday="${entry.weekday}">+ 블록 추가</button>
    </details>
  `;
}

export function renderEmptyScheduleBlock(weekday, index, subjects = []) {
  return renderBlock(Number(weekday), {
    start: "19:00",
    end: "20:30",
    allowedSubjectIds: [],
    requiredSubjectIds: []
  }, index, subjects);
}

function renderBlock(weekday, block, index, subjects) {
  const id = `schedule-${weekday}-${index}`;
  return `
    <div class="schedule-block" data-block-index="${index}">
      <div class="schedule-time-row">
        <label for="${id}-start">시작</label>
        <input id="${id}-start" name="${id}-start" data-field="start" type="time" value="${escapeHTML(block.start || "19:00")}">
        <label for="${id}-end">끝</label>
        <input id="${id}-end" name="${id}-end" data-field="end" type="time" value="${escapeHTML(block.end || "20:30")}">
        <button type="button" class="remove-schedule-block danger mini">삭제</button>
      </div>
      <div class="schedule-subject-row">
        <label for="${id}-allowed">가능 과목</label>
        ${renderSubjectMultiSelect(`${id}-allowed`, "allowedSubjectIds", subjects, block.allowedSubjectIds || [])}
        <label for="${id}-required">우선 과목</label>
        ${renderSubjectMultiSelect(`${id}-required`, "requiredSubjectIds", subjects, block.requiredSubjectIds || [])}
      </div>
      <small class="muted">가능 과목을 비우면 모든 과목이 들어갈 수 있습니다. 우선 과목은 같은 조건에서 먼저 배치됩니다.</small>
    </div>
  `;
}

function renderSubjectMultiSelect(id, field, subjects, selectedIds) {
  const selected = new Set(selectedIds || []);
  if (!subjects.length) {
    return `<input id="${id}" name="${id}" data-field="${field}" type="text" value="${escapeHTML((selectedIds || []).join(","))}" placeholder="과목 생성 후 선택 가능">`;
  }
  return `
    <select id="${id}" name="${id}" data-field="${field}" multiple size="${Math.min(5, Math.max(2, subjects.length))}">
      ${subjects.map(subject => `<option value="${escapeHTML(subject.id)}" ${selected.has(subject.id) ? "selected" : ""}>${escapeHTML(subject.name)}</option>`).join("")}
    </select>
  `;
}

export function readScheduleSettings(container) {
  const weekly = [];
  container.querySelectorAll(".day-blocks").forEach(dayNode => {
    const weekday = Number(dayNode.dataset.weekday);
    const blocks = [...dayNode.querySelectorAll(".schedule-block")].map(blockNode => {
      const read = field => blockNode.querySelector(`[data-field="${field}"]`);
      return {
        start: read("start")?.value || "19:00",
        end: read("end")?.value || "20:30",
        allowedSubjectIds: readIds(read("allowedSubjectIds")),
        requiredSubjectIds: readIds(read("requiredSubjectIds"))
      };
    });
    weekly.push({ weekday, blocks });
  });
  return weekly;
}

function readIds(node) {
  if (!node) return [];
  if (node.tagName === "SELECT") {
    return [...node.selectedOptions].map(option => option.value).filter(Boolean);
  }
  return String(node.value || "").split(/[,\s]+/).map(item => item.trim()).filter(Boolean);
}
