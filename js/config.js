export const STORAGE_KEY = "study_compiler_v09"; // 기존 데이터 유지용: 의도적으로 변경하지 않음
export const CURRENT_SCHEMA_VERSION = 5;
export const APP_VERSION = "v4.0-planner";

// GitHub Pages 같은 정적 사이트에서는 publishable/anon key가 브라우저에 보입니다.
// 데이터 보호는 Supabase RLS 정책으로 해야 하며, service_role/secret key는 절대 넣지 마세요.
export const SUPABASE_URL = "https://lkhsvubyqchiiekjutyo.supabase.co"; // Supabase project URL
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxraHN2dWJ5cWNoaWlla2p1dHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTg5MDksImV4cCI6MjA5MjkzNDkwOX0.A0BYUf7iShHV0lbaiil3eA7iAQheiIzQ_ANuCvxy_tM"; // anon/publishable key

export const DEFAULT_VERSIONS_TEXT = `v0: 개념서
v1: 기본 유형서
v2: 중난도 유형서
v3: 심화서`;

export const DEFAULT_PERFORMANCE_STAGES = [
  { id: "p0", label: "요구사항 확인", description: "조건, 분량, 제출 형식, 평가 기준 확인" },
  { id: "p1", label: "자료조사", description: "근거 자료, 예시, 참고 내용 수집" },
  { id: "p2", label: "초안", description: "초안 작성 또는 기본 산출물 제작" },
  { id: "p2.5", label: "수정/피드백 반영", description: "피드백, 오류, 빠진 조건 보완" },
  { id: "p3", label: "최종본", description: "제출 가능한 형태로 정리" },
  { id: "p4", label: "제출", description: "제출 완료 확인" }
];

export const SUBJECT_TYPES = {
  problem: "문제풀이형",
  memory: "암기형",
  code: "정보/코드형",
  mixed: "혼합형"
};

export const STUDY_FINISH_BUFFER_DAYS = 7;

export const SCHEDULER_POLICY = {
  studyFinishBufferDays: STUDY_FINISH_BUFFER_DAYS,
  minTaskMinutes: 10,
  defaultBlockMinutes: 90,
  splitLongTasks: true,
  overflowToleranceMinutes: 5,
  durationLearningRate: 0.35,
  fallbackDailyMinutes: 120,
  maxScheduleHorizonDays: 180
};

export const DEFAULT_WEEKLY_AVAILABILITY = [
  { weekday: 1, blocks: [{ start: "19:00", end: "20:30", allowedSubjectIds: [], requiredSubjectIds: [], intensity: "medium" }] },
  { weekday: 2, blocks: [{ start: "19:00", end: "20:30", allowedSubjectIds: [], requiredSubjectIds: [], intensity: "medium" }] },
  { weekday: 3, blocks: [{ start: "19:00", end: "20:30", allowedSubjectIds: [], requiredSubjectIds: [], intensity: "medium" }] },
  { weekday: 4, blocks: [{ start: "19:00", end: "20:30", allowedSubjectIds: [], requiredSubjectIds: [], intensity: "medium" }] },
  { weekday: 5, blocks: [{ start: "19:00", end: "20:30", allowedSubjectIds: [], requiredSubjectIds: [], intensity: "medium" }] },
  { weekday: 6, blocks: [{ start: "10:00", end: "12:00", allowedSubjectIds: [], requiredSubjectIds: [], intensity: "high" }] },
  { weekday: 0, blocks: [{ start: "15:00", end: "17:00", allowedSubjectIds: [], requiredSubjectIds: [], intensity: "medium" }] }
];

export const REVIEW_RULES = [
  { id: "R1", label: "1차 복습", offsetDays: 1, estimatedMinutes: 10 },
  { id: "R2", label: "2차 복습", offsetDays: 3, estimatedMinutes: 10 },
  { id: "R3", label: "3차 복습", offsetDays: 7, estimatedMinutes: 12 }
];

export const PATCH_POLICY = {
  defaultEstimatedMinutes: 25,
  riskThreshold: 0.45,
  heavyRiskThreshold: 0.72
};

export const RESULT_GRADE_OPTIONS = [
  { value: "", label: "결과 선택" },
  { value: "excellent", label: "거의 다 맞음" },
  { value: "good", label: "조금 틀림" },
  { value: "mixed", label: "절반 정도" },
  { value: "poor", label: "거의 못 품" },
  { value: "stuck", label: "손도 못 댐" }
];

export const UNDERSTANDING_STAGE_OPTIONS = [
  { value: "", label: "설명 단계" },
  { value: "foggy", label: "봐도 흐림" },
  { value: "withSolution", label: "풀이 보면 이해" },
  { value: "sameType", label: "같은 유형 혼자 가능" },
  { value: "variant", label: "변형 문제도 가능" },
  { value: "teach", label: "남에게 설명 가능" }
];
