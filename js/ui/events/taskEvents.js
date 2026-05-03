import { toast } from "../../ui.js";
import { todayISO } from "../../state.js";
import { scheduleAllPending, attachFollowups } from "../../planner/planner.js";
import { recordTaskCompletionAndReplan } from "../../planner/rescheduleEngine.js";
import { applyOutcomeToTask } from "../../core/scoreModel.js";
import { recordDurationResult } from "../../core/durationModel.js";
import { togglePerformanceStage } from "../../performanceScheduler.js";

export function bindTaskEvents(context) {
  const { getState, setState, render } = context;

  document.addEventListener("click", event => {
    const saveProgressBtn = event.target.closest(".save-progress-btn");
    if (saveProgressBtn) {
      handleSaveProgress({ button: saveProgressBtn, getState, setState, render });
      return;
    }

    const delayBtn = event.target.closest(".delay-task");
    if (delayBtn) {
      const state = getState();
      const task = state.tasks.find(item => item.id === delayBtn.dataset.taskId);
      if (task) {
        task.status = "pending";
        task.scheduledDate = null;
        task.manualDelayCount = Number(task.manualDelayCount || 0) + 1;
        setState(scheduleAllPending(state, { anchorDate: todayISO() }));
        render();
        toast("태스크를 다음 가능한 블록으로 재배치했습니다.");
      }
    }
  });

  document.addEventListener("change", event => {
    const metricInput = event.target.closest(".task-metric");
    if (metricInput) {
      handleMetricChange({ input: metricInput, getState, setState, render });
      return;
    }

    const taskToggle = event.target.closest(".task-toggle");
    if (taskToggle) {
      handleTaskToggle({ toggle: taskToggle, getState, setState, render });
    }
  });
}

function handleSaveProgress({ button, getState, setState, render }) {
  const state = getState();
  const task = state.tasks.find(item => item.id === button.dataset.taskId);
  if (!task) return;

  const progressInput = document.querySelector(`.task-metric[data-task-id="${task.id}"][data-field="progressAmount"]`);
  const nextDateInput = document.querySelector(`.task-metric[data-task-id="${task.id}"][data-field="nextDate"]`);
  const actualInput = document.querySelector(`.task-metric[data-task-id="${task.id}"][data-field="actualMinutes"]`);

  const progressAmount = Number(progressInput?.value || 0);
  const actualMinutes = Number(actualInput?.value || 0);

  task.completedAmount = Number(task.completedAmount || 0) + progressAmount;
  task.actualMinutes = actualMinutes;
  task.nextDate = nextDateInput?.value || task.nextDate;

  task.sessionLogs = Array.isArray(task.sessionLogs) ? task.sessionLogs : [];
  task.sessionLogs.push({
    date: todayISO(),
    amount: progressAmount,
    minutes: actualMinutes
  });

  if (actualMinutes > 0) {
    recordDurationResult(state, {
      ...task,
      actualMinutes,
      estimatedMinutes: task.estimatedMinutes,
      plannedMinutes: task.plannedMinutes
    });
  }

  if (task.targetAmount && task.completedAmount >= task.targetAmount) {
    task.status = "done";
    task.completedAt = new Date().toISOString();
  } else {
    task.status = "inProgress";
  }

  const next = task.status === "done"
    ? recordTaskCompletionAndReplan(state, task)
    : scheduleAllPending(state);

  setState(next);
  render();
  toast("진행률을 저장하고 다음 일정에 반영했습니다.");
}

function handleMetricChange({ input, getState, setState, render }) {
  const state = getState();
  const task = state.tasks.find(item => item.id === input.dataset.taskId);
  if (!task) return;

  const field = input.dataset.field;

  if (field === "nextDate") {
    task.nextDate = input.value;
  } else if (field === "progressAmount") {
    // 진행량은 '진행 저장' 버튼에서 누적 처리합니다.
  } else {
    applyOutcomeToTask(task, field, input.value);
  }

  const next = task.status === "done"
    ? recordTaskCompletionAndReplan(state, task)
    : scheduleAllPending(state);

  setState(next);
  render();
  toast("학습 기록을 저장하고 시간을 보정했습니다.");
}

function handleTaskToggle({ toggle, getState, setState, render }) {
  const state = getState();
  const { taskId, taskType } = toggle.dataset;

  if (taskType !== "performance") {
    const task = state.tasks.find(item => item.id === taskId);
    if (task?.progressMode !== "once") {
      toggle.checked = task.status === "done";
      toast("진행형 태스크는 진행 저장으로 관리합니다.");
      return;
    }
  }

  if (taskType === "performance") {
    const [performanceId, stageId] = taskId.split("::");
    const item = state.performanceItems.find(perf => perf.id === performanceId);
    if (item) togglePerformanceStage(item, stageId, toggle.checked);
  } else {
    const task = state.tasks.find(item => item.id === taskId);
    if (task) {
      task.status = toggle.checked ? "done" : "pending";
      task.completedAt = toggle.checked ? new Date().toISOString() : null;
      if (toggle.checked) attachFollowups(state);
    }
  }

  setState(scheduleAllPending(state));
  render();
}
