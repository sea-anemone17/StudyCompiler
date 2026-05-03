import { STORAGE_KEY } from "../config.js";
import { createSupabaseClient } from "./supabaseClient.js";
import { getCurrentUser } from "../auth.js";
import { createLocalSafetyBackup } from "./storage.js";

const APP_KEY = STORAGE_KEY;
const TABLE = "study_compiler_snapshots";
const LAST_SYNC_KEY = "study_compiler_last_sync";

function readLocalAppData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeLocalAppData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function saveToCloud() {
  const supabase = createSupabaseClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const now = new Date().toISOString();
  const data = {
    ...readLocalAppData(),
    syncMeta: {
      ...(readLocalAppData().syncMeta || {}),
      cloudUpdatedAt: now,
      lastPushedAt: now
    }
  };
  const payload = { user_id: user.id, app_key: APP_KEY, data, updated_at: now };
  const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: "user_id,app_key" });
  if (error) throw error;
  writeLocalAppData(data);
  localStorage.setItem(LAST_SYNC_KEY, now);
  return payload;
}

export async function loadFromCloud({ force = false } = {}) {
  const supabase = createSupabaseClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const { data, error } = await supabase
    .from(TABLE)
    .select("data, updated_at")
    .eq("user_id", user.id)
    .eq("app_key", APP_KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("클라우드에 저장된 Study Compiler 데이터가 없습니다.");

  const local = readLocalAppData();
  const conflict = detectCloudConflict(local, data.data, data.updated_at);
  if (conflict.hasConflict && !force) {
    const err = new Error(conflict.message);
    err.code = "SYNC_CONFLICT";
    err.conflict = conflict;
    throw err;
  }

  const backup = createLocalSafetyBackup("before-cloud-load");
  const now = new Date().toISOString();
  writeLocalAppData({
    ...data.data,
    syncMeta: {
      ...(data.data?.syncMeta || {}),
      cloudUpdatedAt: data.updated_at || now,
      lastPulledAt: now,
      previousLocalBackupKey: backup?.key || null
    }
  });
  localStorage.setItem(LAST_SYNC_KEY, data.updated_at || now);
  return data;
}

export function detectCloudConflict(local, cloud, cloudUpdatedAt) {
  const localUpdatedAt = local?.syncMeta?.localUpdatedAt || null;
  const lastPulledAt = local?.syncMeta?.lastPulledAt || local?.syncMeta?.cloudUpdatedAt || null;
  const cloudTime = cloudUpdatedAt || cloud?.syncMeta?.cloudUpdatedAt || null;
  const localChanged = localUpdatedAt && lastPulledAt && localUpdatedAt > lastPulledAt;
  const cloudChanged = cloudTime && lastPulledAt && cloudTime > lastPulledAt;
  const hasConflict = Boolean(localChanged && cloudChanged);
  return {
    hasConflict,
    localUpdatedAt,
    cloudUpdatedAt: cloudTime,
    lastPulledAt,
    message: "로컬과 클라우드가 모두 마지막 불러오기 이후 수정되었습니다. 백업 후 강제 불러오기를 선택해 주세요."
  };
}

export function getLastSyncTime() {
  return localStorage.getItem(LAST_SYNC_KEY);
}
