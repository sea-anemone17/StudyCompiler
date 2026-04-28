import { SCHEDULER_POLICY } from "./config.js";
import { addDaysISO, daysBetween, todayISO } from "./state.js";

export function buildDateRange(startISO, endISO) {
  const dates = [];
  const current = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO || startISO}T00:00:00`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) return [startISO];
  const safeEnd = end < current ? current : end;
  while (current <= safeEnd) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates.length ? dates : [startISO];
}

export function scheduleByVersionWindows(tasks, subject) {
  const start = todayISO();
  const dates = buildDateRange(start, subject.examDate || start);
  const versions = getRegularVersionIds(subject, tasks);
  const versionWindows = assignVersionWindows(dates, versions);
  const scheduled = [];
  for (const versionId of versions) {
    const group = tasks.filter(task => task.versionId === versionId);
    const window = versionWindows.get(versionId) || { dates };
    scheduled.push(...distributeWithinWindow(group, window.dates, subject));
  }
  const leftovers = tasks.filter(task => !versions.includes(task.versionId));
  if (leftovers.length) scheduled.push(...distributeWithinWindow(leftovers, dates, subject));
  return scheduled.map(task => ({ ...task, schedulerVersion: "v2.5", scheduledBy: "d-day-version-window" }));
}

export function assignVersionWindows(dates, versions) {
  const result = new Map();
  if (!versions.length) return result;
  const totalDays = Math.max(1, dates.length);
  const base = Math.max(1, Math.floor(totalDays / versions.length));
  let cursor = 0;
  versions.forEach((versionId, index) => {
    const remainingVersions = versions.length - index;
    const remainingDays = totalDays - cursor;
    const size = index === versions.length - 1
      ? Math.max(1, remainingDays)
      : Math.max(1, Math.min(base, remainingDays - remainingVersions + 1));
    const windowDates = dates.slice(cursor, cursor + size);
    result.set(versionId, {
      versionId,
      startDate: windowDates[0] || dates[0],
      endDate: windowDates[windowDates.length - 1] || dates[dates.length - 1],
      dates: windowDates.length ? windowDates : [dates[dates.length - 1]]
    });
    cursor += size;
  });
  return result;
}

export function getWeekDates(anchorISO = todayISO()) {
  const anchor = new Date(`${anchorISO}T00:00:00`);
  if (Number.isNaN(anchor.getTime())) return buildDateRange(todayISO(), addDaysISO(todayISO(), 6));
  const day = anchor.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diffToMonday);
  const mondayISO = monday.toISOString().slice(0, 10);
  return Array.from({ length: 7 }, (_, index) => addDaysISO(mondayISO, index));
}

export function formatKoreanDate(dateISO) {
  const date = new Date(`${dateISO}T00:00:00`);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  if (Number.isNaN(date.getTime())) return dateISO;
  return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`;
}

export function getDday(dateISO) {
  if (!dateISO) return null;
  return daysBetween(todayISO(), dateISO);
}

function getRegularVersionIds(subject, tasks) {
  const fromSubject = (subject.versions || [])
    .filter(version => !String(version.id).includes(".5") && !String(version.id).startsWith("R"))
    .map(version => version.id);
  if (fromSubject.length) return fromSubject;
  return [...new Set(tasks.map(task => task.versionId).filter(Boolean))];
}

function distributeWithinWindow(tasks, dates, subject) {
  const safeDates = dates.length ? dates : [todayISO()];
  const dailyMinutes = Math.max(10, Number(subject.dailyMinutes || 120));
  const effectiveDailyMinutes = Math.max(
    SCHEDULER_POLICY.minTaskMinutes,
    Math.floor(dailyMinutes * SCHEDULER_POLICY.regularStudyRatio)
  );
  const used = new Map(safeDates.map(date => [date, 0]));
  let dateIndex = 0;
  return tasks.map((task, index) => {
    const minutes = Math.max(SCHEDULER_POLICY.minTaskMinutes, Number(task.estimatedMinutes || 30));
    let attempts = 0;
    while (attempts < safeDates.length) {
      const date = safeDates[dateIndex % safeDates.length];
      const current = used.get(date) || 0;
      if (current === 0 || current + minutes <= effectiveDailyMinutes) break;
      dateIndex += 1;
      attempts += 1;
    }
    const date = safeDates[dateIndex % safeDates.length];
    used.set(date, (used.get(date) || 0) + minutes);
    if ((used.get(date) || 0) >= effectiveDailyMinutes) dateIndex += 1;
    return {
      ...task,
      scheduledDate: date,
      scheduleOrder: index + 1,
      dailyCapacityMinutes: effectiveDailyMinutes
    };
  });
}
