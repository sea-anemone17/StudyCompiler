import { createSupabaseClient } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";
import { STORAGE_KEY } from "./config.js";

const APP_STORAGE_KEY = STORAGE_KEY;
const APP_KEY = STORAGE_KEY;
const TABLE = "study_compiler_snapshots";
const LAST_SYNC_KEY = "study_compiler_last_sync";
const LAST_CLOUD_UPDATED_KEY = "study_compiler_last_cloud_updated";
const CLOUD_PULL_BACKUP_KEY = "study_compiler_before_cloud_pull";

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
  if (!user) throw new Error("로그인이 필요합니다.");

  const data = readLocalAppData();
  const now = new Date().toISOString();
  const payload = {
    user_id: user.id,
    app_key: APP_KEY,
    data: {
      ...data,
      syncMeta: {
        ...(data.syncMeta || {}),
        lastPushedAt: now,
        cloudBackupVersion: "v4.0-json-snapshot"
      }
    },
    updated_at: now
  };

  const { error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "user_id,app_key" });

  if (error) throw error;
  localStorage.setItem(LAST_SYNC_KEY, now);
  localStorage.setItem(LAST_CLOUD_UPDATED_KEY, now);
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

  const localData = readLocalAppData();
  const conflict = detectCloudConflict(localData, data);
  if (conflict.hasConflict && !force) {
    const message = [
      "로컬과 클라우드 양쪽에 수정 기록이 있습니다.",
      "덮어쓰기 전에 백업을 만들고 다시 시도하세요.",
      `로컬 수정: ${conflict.localUpdatedAt || "알 수 없음"}`,
      `클라우드 수정: ${conflict.cloudUpdatedAt || "알 수 없음"}`
    ].join("\n");
    const error = new Error(message);
    error.code = "SYNC_CONFLICT";
    error.conflict = conflict;
    throw error;
  }

  backupBeforeCloudPull(localData, data.updated_at);
  writeLocalAppData({
    ...(data.data || {}),
    syncMeta: {
      ...((data.data || {}).syncMeta || {}),
      lastPulledAt: new Date().toISOString(),
      cloudUpdatedAt: data.updated_at || null
    }
  });
  localStorage.setItem(LAST_SYNC_KEY, data.updated_at || new Date().toISOString());
  localStorage.setItem(LAST_CLOUD_UPDATED_KEY, data.updated_at || "");
  return data;
}

export async function getCloudSnapshotMeta() {
  const supabase = createSupabaseClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("updated_at")
    .eq("user_id", user.id)
    .eq("app_key", APP_KEY)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function detectCloudConflict(localData = readLocalAppData(), cloudRow = null) {
  const localUpdatedAt = localData?.syncMeta?.localUpdatedAt || null;
  const lastPulledAt = localData?.syncMeta?.lastPulledAt || localStorage.getItem(LAST_SYNC_KEY) || null;
  const cloudUpdatedAt = cloudRow?.updated_at || localStorage.getItem(LAST_CLOUD_UPDATED_KEY) || null;

  const localChangedAfterPull = Boolean(localUpdatedAt && lastPulledAt && localUpdatedAt > lastPulledAt);
  const cloudChangedAfterPull = Boolean(cloudUpdatedAt && lastPulledAt && cloudUpdatedAt > lastPulledAt);

  return {
    hasConflict: localChangedAfterPull && cloudChangedAfterPull,
    localUpdatedAt,
    lastPulledAt,
    cloudUpdatedAt,
    localChangedAfterPull,
    cloudChangedAfterPull
  };
}

export function getLastSyncTime() {
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function getLastCloudPullBackup() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_PULL_BACKUP_KEY));
  } catch {
    return null;
  }
}

function backupBeforeCloudPull(localData, cloudUpdatedAt) {
  try {
    localStorage.setItem(CLOUD_PULL_BACKUP_KEY, JSON.stringify({
      createdAt: new Date().toISOString(),
      cloudUpdatedAt: cloudUpdatedAt || null,
      data: localData
    }));
  } catch (error) {
    console.warn("Failed to backup local data before cloud pull", error);
  }
}
