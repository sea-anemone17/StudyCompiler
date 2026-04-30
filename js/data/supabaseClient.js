import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../config.js";

let client = null;

export function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    key: SUPABASE_PUBLISHABLE_KEY,
    source: "config.js"
  };
}

export function saveSupabaseConfig() {
  throw new Error("이 버전은 사이트에서 Supabase key를 입력하지 않습니다. js/config.js에서 SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY를 설정하세요.");
}

export function clearSupabaseConfig() {
  throw new Error("Supabase 설정은 localStorage가 아니라 js/config.js에서 관리합니다.");
}

export function createSupabaseClient() {
  if (client) return client;
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error("js/config.js에 Supabase URL과 publishable key를 설정해 주세요.");
  }
  if (!window.supabase?.createClient) {
    throw new Error("Supabase CDN이 로드되지 않았습니다. index.html을 확인해 주세요.");
  }
  client = window.supabase.createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return client;
}
