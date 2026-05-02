import { WEEKDAY_LABELS } from "../core/dateUtils.js";
import { normalizeWeeklyAvailability } from "../core/capacityModel.js";
import { escapeHTML } from "../ui.js";

export function renderScheduleSettings(container, state) {
  if (!container) return;
  const weekly = normalizeWeeklyAvailability(state.weeklyAvailability);
  const subjectOptions = (state.subjects || []).map(subject => `<option value="${escapeHTML(subject.id)}">${escapeHTML(subject.name)}</option>`).join("");
  container.innerHTML = `
    <section class="card schedule-settings">
      <h2>요일별 공부 가능 시간</h2>
      <p class="muted">각 블록마다 가능한 과목을 지정할 수 있습니다. 비워 두면 전 과목 가능입니다.</p>
      <div class="weekly-availability-editor">
        ${weekly.map(entry => renderDay(entry, subjectOptions)).join("")}
      </div>
      <button id="saveScheduleSettingsBtn" type="button">시간표 저장 후 재배치</button>
    </section>
  `;
}

function renderDay(entry, subjectOptions) {
  return `
    <details class="day-editor" open>
      <summary>${WEEKDAY_LABELS[entry.weekday]}요일</summary>
      <div class="day-blocks" data-weekday="${entry.weekday}">
        ${(entry.blocks || []).map((block, index) => renderBlock(entry.weekday, block, index, subjectOptions)).join("")}
      </div>
      <button type="button" class="add-schedule-block" data-weekday="${entry.weekday}">+ 블록 추가</button>
    </details>
  `;
}

function renderBlock(weekday, block, index, subjectOptions) {
  const id = `schedule-${weekday}-${index}`;
  const allowed = (block.allowedSubjectIds || []).join(",");
  const required = (block.requiredSubjectIds || []).join(",");
  return `
    <div class="schedule-block" data-block-index="${index}">
      <label for="${id}-start">시작</label>
      <input id="${id}-start" name="${id}-start" data-field="start" type="time" value="${escapeHTML(block.start || "19:00")}">
      <label for="${id}-end">끝</label>
      <input id="${id}-end" name="${id}-end" data-field="end" type="time" value="${escapeHTML(block.end || "20:30")}">
      <label for="${id}-allowed">가능 과목 ID</label>
      <input id="${id}-allowed" name="${id}-allowed" data-field="allowedSubjectIds" type="text" value="${escapeHTML(allowed)}" placeholder="비우면 전 과목 가능">
      <label for="${id}-required">필수 과목 ID</label>
      <input id="${id}-required" name="${id}-required" data-field="requiredSubjectIds" type="text" value="${escapeHTML(required)}" placeholder="우선 배치 과목">
      <button type="button" class="remove-schedule-block">삭제</button>
      ${subjectOptions ? `<small class="muted">과목 ID는 디버그 JSON 또는 과목 카드 data에서 확인 가능합니다.</small>` : ""}
    </div>
  `;
}

export function readScheduleSettings(container) {
  const weekly = [];
  container.querySelectorAll(".day-blocks").forEach(dayNode => {
    const weekday = Number(dayNode.dataset.weekday);
    const blocks = [...dayNode.querySelectorAll(".schedule-block")].map(blockNode => {
      const read = field => blockNode.querySelector(`[data-field="${field}"]`)?.value || "";
      return {
        start: read("start") || "19:00",
        end: read("end") || "20:30",
        allowedSubjectIds: splitIds(read("allowedSubjectIds")),
        requiredSubjectIds: splitIds(read("requiredSubjectIds"))
      };
    });
    weekly.push({ weekday, blocks });
  });
  return weekly;
}

function splitIds(value) {
  return String(value || "").split(/[,\s]+/).map(item => item.trim()).filter(Boolean);
}
