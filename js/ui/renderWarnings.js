import { escapeHTML } from "../ui.js";

export function renderWarnings(state) {
  const warnings = state.plannerWarnings || [];
  if (!warnings.length) {
    return `<div class="notice ok">용량 경고 없음<br><small>현재 시간 블록 기준으로 강제 과밀 배치가 없습니다.</small></div>`;
  }
  return `
    <div class="notice warn">
      <strong>계획 경고 ${warnings.length}건</strong>
      <ul>
        ${warnings.slice(0, 20).map(w => `<li>${escapeHTML(w.message || w.type || "경고")}</li>`).join("")}
      </ul>
      ${warnings.length > 20 ? `<small>외 ${warnings.length - 20}건이 더 있습니다.</small>` : ""}
    </div>
  `;
}
