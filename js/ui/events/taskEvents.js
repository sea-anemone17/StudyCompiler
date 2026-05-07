import { toast } from "../../ui.js";
import { todayISO } from "../../state.js";
import { scheduleAllPending, attachFollowups } from "../../planner/planner.js";
import { recordTaskCompletionAndReplan } from "../../planner/rescheduleEngine.js";
import { applyOutcomeToTask } from "../../core/scoreModel.js";
import { recordDurationResult } from "../../core/durationModel.js";
import { togglePerformanceStage } from "../../performanceScheduler.js";
import { addDaysISO } from "../../core/dateUtils.js";
import { resolveRecoveredTask } from "../../planner/taskRecovery.js";

export function bindTaskEvents(context) {
  const { getState, setState, render } = context;

  document.addEventListener("click", event => {
    const saveProgressBtn = event.target.closest(".save-progress-btn");
    if (saveProgressBtn) {
      handleSaveProgress({ button: saveProgressBtn, getState, setState, render });
      return;
    }

    const startBtn = event.target.closest(".task-start");
    if (startBtn) {
      handleTaskStart({ button: startBtn, getState, setState, render });
      return;
    }

    const finishBtn = event.target.closest(".task-finish");
    if (finishBtn) {
      handleTaskFinish({ button: finishBtn, getState, setState, render });
      return;
    }

    const skipBtn = event.target.closest(".task-skip");
    if (skipBtn) {
      handleTaskSkip({ button: skipBtn, getState, setState, render });
      return;
    }

    const recoverBtn = event.target.closest(".recover-task");
    if (recoverBtn) {
      handleRecoveryResolve({ button: recoverBtn, getState, setState, render });
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

function handleTaskStart({ button, getState, setState, render }) {
  const state = getState();
  const task = state.tasks.find(item => item.id === button.dataset.taskId);
  if (!task) return;

  const now = new Date().toISOString();

  task.status = "inProgress";
  task.startedAt = task.startedAt || now;
  task.lastTouchedAt = now;

  setState(scheduleAllPending(state, { anchorDate: todayISO() }));
  render();
  toast("태스크를 시작했습니다.");
}

function handleTaskFinish({ button, getState, setState, render }) {
  const state = getState();
  const task = state.tasks.find(item => item.id === button.dataset.taskId);
  if (!task) return;

  const result = button.dataset.result;
  const now = new Date().toISOString();

  task.endedAt = now;
  task.lastTouchedAt = now;

  if (result === "done") {
    task.status = "done";
    task.completedAt = now;
    attachFollowups(state);
    setState(recordTaskCompletionAndReplan(state, task));
    render();
    toast("완료 처리하고 복습/패치 일정을 반영했습니다.");
    return;
  }

  if (result === "partial") {
    task.status = "inProgress";
    task.nextDate = addDaysISO(todayISO(), 1);
    task.partialLogs = Array.isArray(task.partialLogs) ? task.partialLogs : [];
    task.partialLogs.push({
      date: todayISO(),
      recordedAt: now,
      note: "오늘 일부 완료"
    });

    setState(scheduleAllPending(state, { anchorDate: todayISO() }));
    render();
    toast("일부 완료로 저장하고 다음 일정에 반영했습니다.");
  }
}

function handleTaskSkip({ button, getState, setState, render }) {
  const state = getState();
  const task = state.tasks.find(item => item.id === button.dataset.taskId);
  if (!task) return;

  const today = todayISO();

  task.status = "pending";
  task.scheduledDate = null;
  task.scheduledBlockId = null;
  task.scheduledStart = null;
  task.scheduledEnd = null;

  task.earliestDate = addDaysISO(today, 1);
  task.skippedDates = Array.isArray(task.skippedDates) ? task.skippedDates : [];
  task.skippedDates.push(today);
  task.lastTouchedAt = new Date().toISOString();

  setState(scheduleAllPending(state, { anchorDate: today }));
  render();
  toast("오늘 태스크를 다음 가능한 날짜로 넘겼습니다.");
}

function handleRecoveryResolve({ button, getState, setState, render }) {
  const state = getState();
  const task = state.tasks.find(item => item.id === button.dataset.taskId);
  if (!task) return;

  resolveRecoveredTask(task, button.dataset.result);

  if (task.status === "done") {
    attachFollowups(state);
    setState(recordTaskCompletionAndReplan(state, task));
  } else {
    setState(scheduleAllPending(state, { anchorDate: todayISO() }));
  }

  render();
  toast("누락 기록을 복구했습니다.");
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
