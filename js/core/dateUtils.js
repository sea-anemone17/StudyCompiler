export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDateOnly(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateOnly(dateISO) {
  const [y, m, d] = String(dateISO || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function todayISO() {
  return formatDateOnly(new Date());
}

export function isISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function addDaysISO(dateISO, amount) {
  const date = parseDateOnly(dateISO) || parseDateOnly(todayISO());
  date.setDate(date.getDate() + Number(amount || 0));
  return formatDateOnly(date);
}

export function daysBetween(fromISO, toISO) {
  const from = parseDateOnly(fromISO);
  const to = parseDateOnly(toISO);
  if (!from || !to) return 0;
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

export function clampISO(dateISO, minISO, maxISO) {
  if (!isISODate(dateISO)) return minISO || maxISO || todayISO();
  if (minISO && dateISO < minISO) return minISO;
  if (maxISO && dateISO > maxISO) return maxISO;
  return dateISO;
}

export function buildDateRange(startISO, endISO, { includeEnd = true } = {}) {
  const start = parseDateOnly(startISO) || parseDateOnly(todayISO());
  const end = parseDateOnly(endISO || startISO) || start;
  const safeEnd = end < start ? start : end;
  const dates = [];
  const cursor = new Date(start);
  while (cursor < safeEnd || (includeEnd && cursor <= safeEnd)) {
    dates.push(formatDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (dates.length > 400) break;
  }
  return dates.length ? dates : [formatDateOnly(start)];
}

export function getWeekday(dateISO) {
  const date = parseDateOnly(dateISO);
  return date ? date.getDay() : new Date().getDay();
}

export function getWeekDates(anchorISO = todayISO()) {
  const anchor = parseDateOnly(anchorISO) || new Date();
  const day = anchor.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diffToMonday);
  const mondayISO = formatDateOnly(monday);
  return Array.from({ length: 7 }, (_, index) => addDaysISO(mondayISO, index));
}

export function formatKoreanDate(dateISO) {
  const date = parseDateOnly(dateISO);
  if (!date) return dateISO || "";
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`;
}

export function getDday(dateISO, anchorISO = todayISO()) {
  if (!isISODate(dateISO)) return null;
  return daysBetween(anchorISO, dateISO);
}

export function parseTimeToMinutes(time) {
  const [h, m] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function formatMinutesAsTime(totalMinutes) {
  const safe = Math.max(0, Math.round(Number(totalMinutes || 0)));
  const h = Math.floor(safe / 60) % 24;
  const m = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function minutesBetweenTimes(start, end) {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === null || e === null) return 0;
  return Math.max(0, e - s);
}

export function addMinutesToTime(start, amount) {
  const s = parseTimeToMinutes(start);
  if (s === null) return start || "";
  return formatMinutesAsTime(s + Number(amount || 0));
}
