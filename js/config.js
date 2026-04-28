export const STORAGE_KEY = "study_compiler_v09"; // v0.9/v1.5 데이터 유지용: 의도적으로 변경하지 않음
export const CURRENT_SCHEMA_VERSION = 4;
export const APP_VERSION = "v3.5";

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

export const SCHEDULER_POLICY = {
  regularStudyRatio: 0.7,
  reviewAndPatchRatio: 0.2,
  bufferRatio: 0.1,
  minTaskMinutes: 10
};

export const REVIEW_RULES = [
  { id: "R1", label: "1차 복습", offsetDays: 1, estimatedMinutes: 10 },
  { id: "R2", label: "2차 복습", offsetDays: 3, estimatedMinutes: 10 },
  { id: "R3", label: "3차 복습", offsetDays: 7, estimatedMinutes: 12 }
];

export const PATCH_POLICY = {
  accuracyThreshold: 80,
  understandingThreshold: 3,
  defaultEstimatedMinutes: 25
};
