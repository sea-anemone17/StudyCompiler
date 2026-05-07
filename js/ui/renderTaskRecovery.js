import { escapeHTML, emptyState } from "../ui.js";
import { getRecoveryTasks } from "../planner/taskRecovery.js";

export function renderRecoveryPanel(state) {
  const tasks = getRecoveryTasks(state);

  if (!tasks.length) {
    return "";
  }

  return `
    <section class="recovery-panel">
      <h2>기록 확인 필요 🥝</h2>
      <p class="muted small">
        이전 날짜에 배정됐지만 완료 기록이 없는 태스크입니다.
        실제로 했는지만 가볍게 복구해 주세요.
      </p>

      ${tasks.map(task => `
        <article class="recovery-card">
          <strong>${escapeHTML(task.title || task.conceptTitle || "태스크")}</strong>
          <div class="task-meta">
            <span>${escapeHTML(task.recoveryOriginalDate || "")}</span>
            <span>${Number(task.estimatedMinutes || 0)}분</span>
          </div>

          <div class="task-actions">
            <button
              type="button"
              class="recover-task mini"
              data-task-id="${escapeHTML(task.id)}"
              data-result="done"
            >
              완료했어요
            </button>

            <button
              type="button"
              class="recover-task mini"
              data-task-id="${escapeHTML(task.id)}"
              data-result="partial"
            >
              조금 했어요
            </button>

            <button
              type="button"
              class="recover-task mini secondary"
              data-task-id="${escapeHTML(task.id)}"
              data-result="notDone"
            >
              안 했어요
            </button>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}
