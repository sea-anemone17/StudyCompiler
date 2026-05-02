import { CLASS_PROGRESS_TYPES, TEACHER_SIGNAL_OPTIONS, EXAM_LIKELIHOOD_OPTIONS } from "../config.js";
import { todayISO } from "../state.js";
import { escapeHTML, emptyState } from "../ui.js";

export function renderClassProgress(container, state) {
  if (!container) return;
  const subjects = state.subjects || [];
  const items = [...(state.classProgress || [])].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  container.innerHTML = `
    <section class="card class-progress-card">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">Class Progress</p>
          <h2>학교 진도 기록</h2>
        </div>
      </div>
      <p class="hint">시험범위가 아직 애매한 영어/국어는 여기서 먼저 수업 진도를 기록하세요. 기록하면 당일·2일 뒤·7일 뒤 복습 태스크가 자동으로 생깁니다.</p>
      <form id="classProgressForm" class="form-stack class-progress-form">
        <label for="classProgressSubject">과목</label>
        <select id="classProgressSubject" name="classProgressSubject" required>
          ${subjects.length ? subjects.map(subject => `<option value="${escapeHTML(subject.id)}">${escapeHTML(subject.name)}</option>`).join("") : `<option value="">과목 없음</option>`}
        </select>
        <label for="classProgressDate">수업 날짜</label>
        <input id="classProgressDate" name="classProgressDate" type="date" value="${todayISO()}" required />
        <label for="classProgressTitle">오늘 배운 내용</label>
        <input id="classProgressTitle" name="classProgressTitle" type="text" placeholder="예: Lesson 4 관계대명사 what / 윤동주 시 해석" required />
        <label for="classProgressType">유형</label>
        <select id="classProgressType" name="classProgressType">
          ${Object.entries(CLASS_PROGRESS_TYPES).map(([value, label]) => `<option value="${value}">${escapeHTML(label)}</option>`).join("")}
        </select>
        <label for="teacherSignal">선생님 강조도</label>
        <select id="teacherSignal" name="teacherSignal">
          ${Object.entries(TEACHER_SIGNAL_OPTIONS).map(([value, label]) => `<option value="${value}">${escapeHTML(label)}</option>`).join("")}
        </select>
        <label for="examLikelihood">시험 가능성</label>
        <select id="examLikelihood" name="examLikelihood">
          ${Object.entries(EXAM_LIKELIHOOD_OPTIONS).map(([value, label]) => `<option value="${value}">${escapeHTML(label)}</option>`).join("")}
        </select>
        <label class="inline-check" for="includedInExamRange"><input id="includedInExamRange" name="includedInExamRange" type="checkbox" /> 확정 시험범위에 포함</label>
        <label for="classProgressMemo">메모</label>
        <textarea id="classProgressMemo" name="classProgressMemo" rows="3" placeholder="판서, 서술형 가능성, 선생님 코멘트"></textarea>
        <button type="submit" class="accent">진도 기록 + 복습 생성</button>
      </form>
    </section>
    <section class="card">
      <div class="section-title-row"><h2>진도 로그</h2><span class="badge">${items.length}개</span></div>
      <div id="classProgressList" class="class-progress-list">
        ${items.length ? items.map(item => renderClassProgressItem(item, subjects)).join("") : emptyState("아직 학교 진도 기록이 없습니다.")}
      </div>
    </section>
  `;
}

function renderClassProgressItem(item, subjects) {
  const subject = subjects.find(s => s.id === item.subjectId);
  const signal = TEACHER_SIGNAL_OPTIONS[item.teacherSignal] || item.teacherSignal || "보통";
  const likelihood = EXAM_LIKELIHOOD_OPTIONS[item.examLikelihood] || item.examLikelihood || "모름";
  return `
    <article class="class-progress-item ${item.includedInExamRange ? "included" : ""}">
      <div>
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(subject?.name || "과목 없음")} · ${escapeHTML(item.date)} · ${escapeHTML(CLASS_PROGRESS_TYPES[item.type] || item.type)}</p>
        <small>강조도 ${escapeHTML(signal)} · 시험 가능성 ${escapeHTML(likelihood)}</small>
        ${item.memo ? `<p class="muted">${escapeHTML(item.memo)}</p>` : ""}
      </div>
      <div class="button-row">
        <label class="inline-check"><input class="class-progress-include" data-progress-id="${escapeHTML(item.id)}" type="checkbox" ${item.includedInExamRange ? "checked" : ""}> 범위 포함</label>
        <button type="button" class="delete-class-progress danger mini" data-progress-id="${escapeHTML(item.id)}">삭제</button>
      </div>
    </article>
  `;
}
