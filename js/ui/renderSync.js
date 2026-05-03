import { getSupabaseConfig } from "../data/supabaseClient.js";
import { getCurrentUser, signUp, signIn, signOut } from "../auth.js";
import { saveToCloud, loadFromCloud, getLastSyncTime } from "../data/cloudSync.js";
import { escapeHTML } from "../ui.js";

function formatDateTime(value) {
  if (!value) return "아직 없음";
  return new Date(value).toLocaleString("ko-KR");
}

export function renderSync(container) {
  renderSyncInner(container);
}

async function renderSyncInner(container) {
  const config = getSupabaseConfig();
  const user = await getCurrentUser().catch(() => null);
  const lastSync = getLastSyncTime();
  container.innerHTML = `
    <section class="card">
      <h2>Supabase 백업</h2>
      <p class="muted">Supabase URL/key는 사이트에서 입력하지 않고 <code>js/config.js</code>에서 관리합니다.</p>
      <p>설정 상태: ${config.url && config.key ? "설정됨" : "미설정"}</p>
      <h3>계정</h3>
      <p>현재 상태: ${user ? `로그인됨 — ${escapeHTML(user.email || user.id)}` : "로그아웃"}</p>
      <label for="syncEmail">이메일</label>
      <input id="syncEmail" name="syncEmail" type="email" autocomplete="email">
      <label for="syncPassword">비밀번호</label>
      <input id="syncPassword" name="syncPassword" type="password" autocomplete="current-password">
      <div class="button-row">
        <button id="syncSignUpBtn" type="button">회원가입</button>
        <button id="syncSignInBtn" type="button">로그인</button>
        <button id="syncSignOutBtn" type="button">로그아웃</button>
      </div>
      <h3>클라우드 백업</h3>
      <p>마지막 동기화: ${escapeHTML(formatDateTime(lastSync))}</p>
      <div class="button-row">
        <button id="saveToCloudBtn" type="button">클라우드에 저장</button>
        <button id="loadFromCloudBtn" type="button">클라우드에서 불러오기</button>
        <button id="forceLoadFromCloudBtn" type="button">강제 불러오기</button>
      </div>
      <p class="muted">⚠️ 불러오기는 현재 브라우저 데이터를 덮어씁니다. 강제 불러오기 전에는 자동 안전 백업을 만듭니다.</p>
    </section>
  `;
  bindSyncEvents(container);
}

function bindSyncEvents(container) {
  container.querySelector("#syncSignUpBtn")?.addEventListener("click", async () => {
    try {
      await signUp(container.querySelector("#syncEmail").value.trim(), container.querySelector("#syncPassword").value);
      alert("회원가입 요청이 완료되었습니다. 이메일 확인 설정이 켜져 있다면 메일을 확인해 주세요.");
      location.reload();
    } catch (error) { alert(`회원가입 실패: ${error.message}`); }
  });
  container.querySelector("#syncSignInBtn")?.addEventListener("click", async () => {
    try {
      await signIn(container.querySelector("#syncEmail").value.trim(), container.querySelector("#syncPassword").value);
      alert("로그인했습니다.");
      location.reload();
    } catch (error) { alert(`로그인 실패: ${error.message}`); }
  });
  container.querySelector("#syncSignOutBtn")?.addEventListener("click", async () => {
    try { await signOut(); alert("로그아웃했습니다."); location.reload(); }
    catch (error) { alert(`로그아웃 실패: ${error.message}`); }
  });
  container.querySelector("#saveToCloudBtn")?.addEventListener("click", async () => {
    try { await saveToCloud(); alert("클라우드에 저장했습니다."); location.reload(); }
    catch (error) { alert(`저장 실패: ${error.message}`); }
  });
  container.querySelector("#loadFromCloudBtn")?.addEventListener("click", async () => {
    try {
      if (!confirm("현재 브라우저 데이터를 클라우드 데이터로 덮어쓸까요?")) return;
      await loadFromCloud({ force: false });
      alert("클라우드 데이터를 불러왔습니다.");
      location.reload();
    } catch (error) { alert(`불러오기 실패: ${error.message}`); }
  });
  container.querySelector("#forceLoadFromCloudBtn")?.addEventListener("click", async () => {
    try {
      if (!confirm("충돌 여부와 관계없이 강제로 불러올까요? 현재 데이터는 안전 백업됩니다.")) return;
      await loadFromCloud({ force: true });
      alert("클라우드 데이터를 강제로 불러왔습니다.");
      location.reload();
    } catch (error) { alert(`강제 불러오기 실패: ${error.message}`); }
  });
}
