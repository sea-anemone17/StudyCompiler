import { $, toast } from "../../ui.js";
import { replanAll } from "../../planner/planner.js";
import { renderScheduleSettings, readScheduleSettings, renderEmptyScheduleBlock } from "../renderScheduleSettings.js";

export function bindScheduleEvents(context) {
  const { getState, setState, render } = context;
  const scheduleContainer = $("#scheduleSettingsView");
  if (!scheduleContainer) return;

  renderScheduleSettings(scheduleContainer, getState());
  scheduleContainer.addEventListener("click", event => {
    const add = event.target.closest(".add-schedule-block");
    if (add) {
      const dayBlocks = scheduleContainer.querySelector(`.day-blocks[data-weekday="${add.dataset.weekday}"]`);
      const index = dayBlocks.querySelectorAll(".schedule-block").length;
      dayBlocks.insertAdjacentHTML("beforeend", renderEmptyScheduleBlock(add.dataset.weekday, index, getState().subjects || []));
    }

    if (event.target.closest(".remove-schedule-block")) {
      event.target.closest(".schedule-block")?.remove();
    }

    if (event.target.id === "saveScheduleSettingsBtn") {
      const state = getState();
      state.weeklyAvailability = readScheduleSettings(scheduleContainer);
      setState(replanAll(state));
      render();
      toast("요일별 시간표를 저장하고 전체 재배치했습니다.");
    }
  });
}
