import { bindTabEvents } from "./tabEvents.js";
import { bindSubjectEvents } from "./subjectEvents.js";
import { bindAIEvents } from "./aiEvents.js";
import { bindPerformanceEvents } from "./performanceEvents.js";
import { bindDataEvents } from "./dataEvents.js";
import { bindScheduleEvents } from "./scheduleEvents.js";
import { bindClassProgressEvents } from "./classProgressEvents.js";
import { bindTaskEvents } from "./taskEvents.js";

export function bindEvents(context) {
  bindTabEvents(context);
  bindSubjectEvents(context);
  bindAIEvents(context);
  bindPerformanceEvents(context);
  bindDataEvents(context);
  bindScheduleEvents(context);
  bindClassProgressEvents(context);
  bindTaskEvents(context);
}
