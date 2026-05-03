import { $, toast } from "../../ui.js";
import { getActiveSubject, upsertSubject } from "../../state.js";
import { buildAIPrompt } from "../../aiPromptBuilder.js";
import { parseAIJson, reviewAIJson, applyAIJsonToSubject } from "../../aiImporter.js";
import { replanSubject } from "../../planner/planner.js";
import { fillSubjectForm, renderJsonReview } from "./formUtils.js";

export function bindAIEvents(context) {
  const { getState, setState, render } = context;

  $("#buildPromptBtn")?.addEventListener("click", () => {
    const subject = getActiveSubject(getState());
    if ($("#aiPromptOutput")) $("#aiPromptOutput").value = buildAIPrompt(subject);
    toast("AI 프롬프트를 생성했습니다.");
  });

  $("#copyPromptBtn")?.addEventListener("click", async () => {
    const value = $("#aiPromptOutput")?.value;
    if (!value) return toast("복사할 프롬프트가 없습니다.");
    await navigator.clipboard.writeText(value);
    toast("프롬프트를 복사했습니다.");
  });

  $("#validateJsonBtn")?.addEventListener("click", () => {
    try {
      const parsed = parseAIJson($("#aiJsonInput")?.value || "");
      const review = reviewAIJson(parsed);
      if ($("#jsonReview")) $("#jsonReview").innerHTML = renderJsonReview(review);
      toast("JSON 검토를 완료했습니다.");
    } catch (error) {
      if ($("#jsonReview")) $("#jsonReview").textContent = `오류: ${error.message}`;
      toast("JSON을 읽지 못했습니다.");
    }
  });

  $("#applyJsonBtn")?.addEventListener("click", () => {
    try {
      const state = getState();
      const parsed = parseAIJson($("#aiJsonInput")?.value || "");
      const subject = applyAIJsonToSubject(parsed, getActiveSubject(state));
      upsertSubject(state, subject);
      setState(replanSubject(state, subject.id));
      fillSubjectForm(subject);
      render();
      toast("AI JSON을 적용하고 재계획했습니다.");
    } catch (error) {
      toast(`적용 실패: ${error.message}`);
    }
  });
}
