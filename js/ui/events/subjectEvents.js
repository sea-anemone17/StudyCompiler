import { $, toast } from "../../ui.js";
import { uid, getActiveSubject, upsertSubject, todayISO } from "../../state.js";
import { DEFAULT_VERSIONS_TEXT } from "../../config.js";
import { parseCurriculumText } from "../../curriculumParser.js";
import { parseVersionsText } from "../../versionEngine.js";
import { replanSubject, scheduleAllPending } from "../../planner/planner.js";
import { fillSubjectForm } from "./formUtils.js";

export function bindSubjectEvents(context) {
  const { getState, setState, render } = context;

  $("#newSubjectBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = {
      id: uid("subject"),
      name: "새 과목",
      examDate: todayISO(),
      examDateStatus: "estimated",
      type: "problem",
      planningMode: "examRange",
      dailyMinutes: 120,
      studyFinishBufferDays: 7,
      curriculum: [],
      versions: parseVersionsText(DEFAULT_VERSIONS_TEXT)
    };
    upsertSubject(state, subject);
    setState(scheduleAllPending(state));
    fillSubjectForm(subject);
    render();
    toast("새 과목을 만들었습니다.");
  });

  $("#subjectForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const state = getState();
    const active = getActiveSubject(state);
    const subject = {
      ...(active || {}),
      id: $("#subjectId")?.value || active?.id || uid("subject"),
      name: $("#subjectName")?.value.trim() || "이름 없는 과목",
      examDate: $("#examDate")?.value || todayISO(),
      examDateStatus: $("#examDateStatus")?.value || active?.examDateStatus || "estimated",
      provisionalExamDate: $("#provisionalExamDate")?.value || active?.provisionalExamDate || "",
      examWindowStart: $("#examWindowStart")?.value || active?.examWindowStart || "",
      examWindowEnd: $("#examWindowEnd")?.value || active?.examWindowEnd || "",
      studyFinishBufferDays: Number($("#studyFinishBufferDays")?.value || active?.studyFinishBufferDays || 7),
      allowRegularStudyOnExamDay: Boolean($("#allowRegularStudyOnExamDay")?.checked),
      type: $("#subjectType")?.value || "problem",
      planningMode: $("#planningMode")?.value || active?.planningMode || "examRange",
      dailyMinutes: Number($("#dailyMinutes")?.value || 120),
      curriculum: active?.curriculum || [],
      versions: active?.versions || parseVersionsText(DEFAULT_VERSIONS_TEXT)
    };
    upsertSubject(state, subject);
    setState(replanSubject(state, subject.id));
    render();
    toast("과목을 저장하고 계획을 다시 배치했습니다.");
  });

  $("#saveVersionsBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");
    subject.versions = parseVersionsText($("#versionsInput")?.value || DEFAULT_VERSIONS_TEXT);
    upsertSubject(state, subject);
    setState(replanSubject(state, subject.id));
    render();
    toast("버전을 저장하고 태스크를 재계획했습니다.");
  });

  $("#parseCurriculumBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");
    subject.curriculum = parseCurriculumText($("#curriculumInput")?.value || "", subject.id);
    upsertSubject(state, subject);
    setState(replanSubject(state, subject.id));
    render();
    toast("시험범위 트리를 저장하고 태스크를 재계획했습니다.");
  });

  $("#generateTasksBtn")?.addEventListener("click", () => {
    const state = getState();
    const subject = getActiveSubject(state);
    if (!subject) return toast("과목을 먼저 추가해 주세요.");
    if (!subject.curriculum?.length) return toast("시험범위 트리를 먼저 저장해 주세요.");
    if (!subject.versions?.length) subject.versions = parseVersionsText(DEFAULT_VERSIONS_TEXT);
    setState(replanSubject(state, subject.id));
    render();
    toast("태스크를 생성하고 시간 블록 기준으로 재배치했습니다.");
  });

  document.addEventListener("click", event => {
    const subjectCard = event.target.closest(".subject-card");
    if (!subjectCard) return;
    const state = getState();
    state.activeSubjectId = subjectCard.dataset.subjectId;
    setState(state);
    render();
  });
}
