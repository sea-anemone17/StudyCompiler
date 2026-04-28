import {
  saveSupabaseConfig,
  getSupabaseConfig,
  clearSupabaseConfig
} from "./supabaseClient.js";

import {
  getCurrentUser,
  signUp,
  signIn,
  signOut
} from "./auth.js";

import {
  saveToCloud,
  loadFromCloud,
  getLastSyncTime
} from "./cloudSync.js";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value) {
  if (!value) return "아직 없음";
  return new Date(value).toLocaleString("ko-KR");
}

export async function renderSync(container) {
  const config = getSupabaseConfig();
  const user = await getCurrentUser().catch(() => null);
  const lastSync = getLastSyncTime();

  container.innerHTML = `
    <section class="card">
      <h2>Supabase 동기화</h2>
      <p class="muted">
        localStorage의 Study Compiler 데이터를 Supabase에 JSON 스냅샷으로 저장/복원합니다.
      </p>

      <div class="form-grid">
        <label>
          <span>Project URL</span>
          <input id="syncSupabaseUrl" value="${escapeHTML(config.url || "")}" placeholder="https://xxxx.supabase.co" />
        </label>

        <label>
          <span>Publishable / Anon Key</span>
          <input id="syncSupabaseKey" value="${escapeHTML(config.key || "")}" placeholder="sb_publishable_... 또는 anon key" />
        </label>

        <div class="button-row">
          <button id="saveSupabaseConfigBtn">설정 저장</button>
          <button id="clearSupabaseConfigBtn" class="secondary">설정 삭제</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>계정</h2>
      <p class="muted">
        현재 상태: ${user ? `로그인됨 — ${escapeHTML(user.email || user.id)}` : "로그아웃"}
      </p>

      <div class="form-grid">
        <label>
          <span>이메일</span>
          <input id="syncEmail" type="email" placeholder="email@example.com" />
        </label>

        <label>
          <span>비밀번호</span>
          <input id="syncPassword" type="password" placeholder="비밀번호" />
        </label>

        <div class="button-row">
          <button id="syncSignUpBtn">회원가입</button>
          <button id="syncSignInBtn">로그인</button>
          <button id="syncSignOutBtn" class="secondary">로그아웃</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>클라우드 백업</h2>
      <p class="muted">마지막 동기화: ${escapeHTML(formatDateTime(lastSync))}</p>

      <div class="button-row">
        <button id="saveToCloudBtn">클라우드에 저장</button>
        <button id="loadFromCloudBtn" class="danger">클라우드에서 불러오기</button>
      </div>

      <p class="muted">
        ⚠️ 불러오기는 현재 브라우저의 localStorage 데이터를 클라우드 데이터로 덮어씁니다.
      </p>
    </section>
  `;

  bindSyncEvents(container);
}

function bindSyncEvents(container) {
  container.querySelector("#saveSupabaseConfigBtn")?.addEventListener("click", () => {
    const url = container.querySelector("#syncSupabaseUrl").value;
    const key = container.querySelector("#syncSupabaseKey").value;

    saveSupabaseConfig({ url, key });
    alert("Supabase 설정을 저장했습니다.");
  });

  container.querySelector("#clearSupabaseConfigBtn")?.addEventListener("click", () => {
    if (!confirm("Supabase 설정을 삭제할까요?")) return;
    clearSupabaseConfig();
    alert("삭제했습니다.");
    location.reload();
  });

  container.querySelector("#syncSignUpBtn")?.addEventListener("click", async () => {
    try {
      const email = container.querySelector("#syncEmail").value.trim();
      const password = container.querySelector("#syncPassword").value;

      await signUp(email, password);
      alert("회원가입 요청이 완료되었습니다. 이메일 확인 설정이 켜져 있다면 메일을 확인해 주세요.");
      location.reload();
    } catch (error) {
      alert(`회원가입 실패: ${error.message}`);
    }
  });

  container.querySelector("#syncSignInBtn")?.addEventListener("click", async () => {
    try {
      const email = container.querySelector("#syncEmail").value.trim();
      const password = container.querySelector("#syncPassword").value;

      await signIn(email, password);
      alert("로그인했습니다.");
      location.reload();
    } catch (error) {
      alert(`로그인 실패: ${error.message}`);
    }
  });

  container.querySelector("#syncSignOutBtn")?.addEventListener("click", async () => {
    try {
      await signOut();
      alert("로그아웃했습니다.");
      location.reload();
    } catch (error) {
      alert(`로그아웃 실패: ${error.message}`);
    }
  });

  container.querySelector("#saveToCloudBtn")?.addEventListener("click", async () => {
    try {
      await saveToCloud();
      alert("클라우드에 저장했습니다.");
      location.reload();
    } catch (error) {
      alert(`저장 실패: ${error.message}`);
    }
  });

  container.querySelector("#loadFromCloudBtn")?.addEventListener("click", async () => {
    try {
      if (!confirm("현재 브라우저 데이터를 클라우드 데이터로 덮어쓸까요?")) return;

      await loadFromCloud();
      alert("클라우드 데이터를 불러왔습니다.");
      location.reload();
    } catch (error) {
      alert(`불러오기 실패: ${error.message}`);
    }
  });
}
