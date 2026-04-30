import { DEFAULT_WEEKLY_AVAILABILITY, SCHEDULER_POLICY } from "../config.js";
import { buildDateRange, getWeekday, minutesBetweenTimes, todayISO } from "./dateUtils.js";

export function createDefaultWeeklyAvailability() {
  return JSON.parse(JSON.stringify(DEFAULT_WEEKLY_AVAILABILITY));
}

export function normalizeWeeklyAvailability(value) {
  const source = Array.isArray(value) && value.length ? value : createDefaultWeeklyAvailability();
  const byWeekday = new Map();
  for (const entry of source) {
    const weekday = Number(entry.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
    const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];
    byWeekday.set(weekday, {
      weekday,
      blocks: blocks
        .map((block, index) => normalizeBlock(block, weekday, index))
        .filter(block => block.minutes > 0)
    });
  }
  for (const fallback of DEFAULT_WEEKLY_AVAILABILITY) {
    if (!byWeekday.has(fallback.weekday)) byWeekday.set(fallback.weekday, fallback);
  }
  return [...byWeekday.values()].sort((a, b) => a.weekday - b.weekday);
}

export function normalizeBlock(block = {}, weekday = 0, index = 0) {
  const start = block.start || "19:00";
  const end = block.end || "20:30";
  const minutes = Number(block.minutes || minutesBetweenTimes(start, end) || SCHEDULER_POLICY.defaultBlockMinutes);
  return {
    id: block.id || `weekday_${weekday}_block_${index}`,
    start,
    end,
    minutes: Math.max(0, minutes),
    allowedSubjectIds: Array.isArray(block.allowedSubjectIds) ? block.allowedSubjectIds.filter(Boolean) : [],
    requiredSubjectIds: Array.isArray(block.requiredSubjectIds) ? block.requiredSubjectIds.filter(Boolean) : [],
    intensity: block.intensity || "medium",
    memo: block.memo || ""
  };
}

export function expandStudyBlocks({ weeklyAvailability, dateOverrides, startDate = todayISO(), endDate }) {
  const weekly = normalizeWeeklyAvailability(weeklyAvailability);
  const overrides = normalizeDateOverrides(dateOverrides);
  const dates = buildDateRange(startDate, endDate || startDate);
  const blocks = [];
  for (const date of dates) {
    const override = overrides.get(date);
    if (override?.closed) continue;
    const dayEntry = weekly.find(entry => entry.weekday === getWeekday(date));
    let dayBlocks = override?.blocks ? override.blocks.map((b, i) => normalizeBlock(b, getWeekday(date), i)) : (dayEntry?.blocks || []);
    if (override?.extraBlocks?.length) {
      dayBlocks = dayBlocks.concat(override.extraBlocks.map((b, i) => normalizeBlock(b, getWeekday(date), 100 + i)));
    }
    dayBlocks.forEach((block, index) => {
      blocks.push({
        ...block,
        id: `${date}__${block.id || index}`,
        date,
        weekday: getWeekday(date),
        capacityMinutes: block.minutes,
        usedMinutes: 0,
        remainingMinutes: block.minutes,
        assignedTaskIds: []
      });
    });
  }
  return blocks;
}

export function normalizeDateOverrides(value) {
  const map = new Map();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item?.date) map.set(item.date, item);
    }
  } else if (value && typeof value === "object") {
    for (const [date, item] of Object.entries(value)) {
      map.set(date, { date, ...item });
    }
  }
  return map;
}

export function isBlockCompatibleWithTask(block, task) {
  if (!block || !task) return false;
  const allowed = Array.isArray(block.allowedSubjectIds) ? block.allowedSubjectIds : [];
  if (allowed.length && !allowed.includes(task.subjectId)) return false;
  return true;
}

export function getRequiredSubjectBoost(block, task) {
  const required = Array.isArray(block.requiredSubjectIds) ? block.requiredSubjectIds : [];
  return required.includes(task.subjectId) ? -100 : 0;
}

export function summarizeBlocksByDate(blocks = []) {
  const byDate = new Map();
  for (const block of blocks) {
    const item = byDate.get(block.date) || { date: block.date, capacityMinutes: 0, usedMinutes: 0, blockCount: 0 };
    item.capacityMinutes += Number(block.capacityMinutes || block.minutes || 0);
    item.usedMinutes += Number(block.usedMinutes || 0);
    item.blockCount += 1;
    byDate.set(block.date, item);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
