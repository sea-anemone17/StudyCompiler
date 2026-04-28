import { SUBJECT_TYPES } from "./config.js";
import { getDday } from "./scheduler.js";

export function $(selector) {
  return document.querySelector(selector);
}

export function $all(selector) {
  return [...document.querySelectorAll(selector)];
}

export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

export function toast(message) {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2400);
}

export function emptyState(message = "아직 데이터가 없습니다.") {
  return `<div class="empty-state">${escapeHTML(message)}</div>`;
}

export function ddayLabel(dateISO) {
  const dday = getDday(dateISO);
  if (dday === null || Number.isNaN(dday)) return "D-?";
  if (dday === 0) return "D-Day";
  if (dday > 0) return `D-${dday}`;
  return `D+${Math.abs(dday)}`;
}

export function subjectTypeLabel(type) {
  return SUBJECT_TYPES[type] || type || "기타";
}
