import { $, $all } from "../../ui.js";

export function bindTabEvents() {
  $all(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $all(".tab").forEach(item => item.classList.remove("active"));
      $all(".tab-panel").forEach(item => item.classList.remove("active"));
      tab.classList.add("active");
      $(`#${tab.dataset.tab}Tab`)?.classList.add("active");
    });
  });
}
