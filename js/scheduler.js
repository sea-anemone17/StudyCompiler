import { daysBetween, todayISO } from "./state.js";

export function buildDateRange(startISO, endISO) {
  const dates = [];
  const current = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates.length ? dates : [startISO];
}

export function scheduleByVersionWindows(tasks, subject) {
  const start = todayISO();
  const end = subject.examDate || start;
  const dates = buildDateRange(start, end);
  const versions = [...new Set(tasks.map(task => task.versionId))];
  const daysPerVersion = Math.max(1, Math.floor(dates.length / Math.max(1, versions.length)));
  const scheduled = [];

  versions.forEach((versionId, versionIndex) => {
    const group = tasks.filter(task => task.versionId === versionId);
    const startIndex = Math.min(dates.length - 1, versionIndex * daysPerVersion);
    const endIndex = versionIndex === versions.length - 1
      ? dates.length - 1
      : Math.min(dates.length - 1, (versionIndex + 1) * daysPerVersion - 1);
    const windowDates = dates.slice(startIndex, endIndex + 1);

    group.forEach((task, taskIndex) => {
      scheduled.push({
        ...task,
        scheduledDate: windowDates[taskIndex % windowDates.length]
      });
    });
  });

  return scheduled;
}

export function getDday(dateISO) {
  if (!dateISO) return null;
  return daysBetween(todayISO(), dateISO);
}
