import { createSupabaseClient } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";

const APP_STORAGE_KEY = "study_compiler_v09";
const APP_KEY = "study_compiler_v09";
const TABLE = "study_compiler_snapshots";

function readLocalAppData() {
  try {
    return JSON.parse(localStorage.getItem(APP_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeLocalAppData(data) {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
}

export async function saveToCloud() {
  const supabase = createSupabaseClient();
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const data = readLocalAppData();

  const payload = {
    user_id: user.id,
    app_key: APP_KEY,
    data,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from(TABLE)
    .upsert(payload, {
      onConflict: "user_id,app_key"
    });

  if (error) throw error;

  localStorage.setItem(
    "study_compiler_last_sync",
    new Date().toISOString()
  );

  return payload;
}

export async function loadFromCloud() {
  const supabase = createSupabaseClient();
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("data, updated_at")
    .eq("user_id", user.id)
    .eq("app_key", APP_KEY)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("클라우드에 저장된 Study Compiler 데이터가 없습니다.");
  }

  writeLocalAppData(data.data);

  localStorage.setItem(
    "study_compiler_last_sync",
    data.updated_at || new Date().toISOString()
  );

  return data;
}

export function getLastSyncTime() {
  return localStorage.getItem("study_compiler_last_sync");
}
