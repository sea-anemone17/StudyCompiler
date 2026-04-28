const SUPABASE_CONFIG_KEY = "study_compiler_supabase_config";

export function saveSupabaseConfig({ url, key }) {
  localStorage.setItem(
    SUPABASE_CONFIG_KEY,
    JSON.stringify({
      url: String(url || "").trim(),
      key: String(key || "").trim()
    })
  );
}

export function getSupabaseConfig() {
  try {
    return JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY)) || {};
  } catch {
    return {};
  }
}

export function clearSupabaseConfig() {
  localStorage.removeItem(SUPABASE_CONFIG_KEY);
}

export function createSupabaseClient() {
  const { url, key } = getSupabaseConfig();

  if (!url || !key) {
    throw new Error("Supabase URL과 publishable/anon key를 먼저 저장해 주세요.");
  }

  if (!window.supabase?.createClient) {
    throw new Error("Supabase CDN이 로드되지 않았습니다. index.html을 확인해 주세요.");
  }

  return window.supabase.createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}
