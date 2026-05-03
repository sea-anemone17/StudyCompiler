import { SUBJECT_TYPES } from "./config.js";
import { curriculumToText } from "./curriculumParser.js";
import { versionsToText } from "./versionEngine.js";

export function buildAIPrompt(subject) {
  if (!subject) return "과목을 먼저 선택해 주세요.";
  const curriculumText = curriculumToText(subject.curriculum || []);
  const versionsText = versionsToText(subject.versions || []);
  return `아래 시험범위와 교재 버전을 바탕으로 Study Compiler용 JSON 설계안을 만들어 주세요.

[역할]
당신은 교육학 기반 학습 설계 보조자입니다. 사용자가 입력한 범위만 구조화하고, 범위 밖 내용을 추가하지 않습니다.

[조건]
1. 시험범위에 없는 내용은 절대 추가하지 마세요.
2. 대단원-중단원-소단원-개념 트리로 정리하세요.
3. 가장 아래 단위는 실제 학습 태스크가 될 "개념"으로 처리하세요.
4. 각 개념마다 중요도 A/B/C를 제안하되, 불확실하면 needs_user_review: true로 표시하세요.
5. 각 버전에는 goal과 completionCriteria를 포함하세요.
6. 수학/문제풀이형은 오답 패치 중심, 암기형은 회상 복습 중심, 정보형은 코드 흐름/출력 예측 중심으로 설계하세요.
7. 출력은 JSON만 제공하세요. 설명문은 JSON 밖에 쓰지 마세요.

[출력 JSON 스키마]
{
  "subject": "과목명",
  "examDate": "YYYY-MM-DD",
  "subjectType": "problem | memory | code | mixed",
  "curriculumTree": [
    {
      "title": "대단원명",
      "level": "대단원",
      "children": [
        {
          "title": "중단원명",
          "level": "중단원",
          "children": [
            {
              "title": "개념명",
              "level": "개념",
              "importance": "A",
              "targetVersions": ["v0", "v1", "v2"],
              "needs_user_review": false
            }
          ]
        }
      ]
    }
  ],
  "versionRules": [
    {
      "version": "v0",
      "label": "개념서",
      "goal": "개념 이해와 기본 확인",
      "completionCriteria": ["개념을 자기 말로 설명", "기본 확인 문제 풀이"]
    }
  ],
  "notes": []
}

[과목]
${subject.name}

[시험일]
${subject.examDate}

[과목 유형]
${subject.type} (${SUBJECT_TYPES[subject.type] || "기타"})

[시험범위]
${curriculumText || "아직 입력되지 않음"}

[교재 버전]
${versionsText}`;
}
