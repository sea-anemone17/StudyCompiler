import { $, escapeHTML } from "../../ui.js";
import { todayISO } from "../../state.js";
import { renderTreeHTML, curriculumToText } from "../../curriculumParser.js";
import { versionsToText } from "../../versionEngine.js";

export function fillSubjectForm(subject) {
  if (!subject) return;
  if ($("#subjectId")) $("#subjectId").value = subject.id || "";
  if ($("#subjectName")) $("#subjectName").value = subject.name || "";
  if ($("#examDate")) $("#examDate").value = subject.examDate || todayISO();
  if ($("#examDateStatus")) $("#examDateStatus").value = subject.examDateStatus || "estimated";
  if ($("#provisionalExamDate")) $("#provisionalExamDate").value = subject.provisionalExamDate || "";
  if ($("#examWindowStart")) $("#examWindowStart").value = subject.examWindowStart || "";
  if ($("#examWindowEnd")) $("#examWindowEnd").value = subject.examWindowEnd || "";
  if ($("#studyFinishBufferDays")) $("#studyFinishBufferDays").value = subject.studyFinishBufferDays ?? 7;
  if ($("#allowRegularStudyOnExamDay")) $("#allowRegularStudyOnExamDay").checked = Boolean(subject.allowRegularStudyOnExamDay);
  if ($("#subjectType")) $("#subjectType").value = subject.type || "problem";
  if ($("#planningMode")) $("#planningMode").value = subject.planningMode || "examRange";
  if ($("#dailyMinutes")) $("#dailyMinutes").value = subject.dailyMinutes || 120;
  if ($("#versionsInput")) $("#versionsInput").value = versionsToText(subject.versions || []);
  if ($("#curriculumInput")) $("#curriculumInput").value = curriculumToText(subject.curriculum || []);
  if ($("#curriculumPreview")) $("#curriculumPreview").innerHTML = renderTreeHTML(subject.curriculum || []);
}

export function renderJsonReview(review) {
  return `
    <dl>
      <dt>과목</dt><dd>${escapeHTML(review.subject || "")}</dd>
      <dt>시험일</dt><dd>${escapeHTML(review.examDate || "")}</dd>
      <dt>유형</dt><dd>${escapeHTML(review.type || "")}</dd>
      <dt>개념 수</dt><dd>${escapeHTML(String(review.conceptCount ?? ""))}</dd>
      <dt>버전 규칙</dt><dd>${escapeHTML(String(review.versionCount ?? ""))}</dd>
    </dl>
    ${review.warnings?.length ? `<ul>${review.warnings.map(w => `<li>${escapeHTML(w)}</li>`).join("")}</ul>` : "큰 문제는 없어 보입니다."}
  `;
}
