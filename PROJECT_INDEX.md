# PROJECT_INDEX

Study Compiler v4.2 refactor 이후의 주요 파일 역할입니다.

## 루트

- `index.html`
  - 앱의 탭/폼/패널 구조입니다.
  - `#subjectForm`, `#classProgressView`, `#scheduleSettingsView`, `#syncView` 같은 렌더링 대상이 있어야 JS 기능이 연결됩니다.

- `README.md`
  - 앱의 목적, 실행 방법, 데이터 저장 방식을 설명합니다.

- `APPLY_GUIDE.md`
  - 이전 패치 적용용 안내 파일입니다.

## js/

- `js/app.js`
  - 앱 시작점입니다.
  - 상태 로드, 전체 렌더링, 이벤트 바인딩을 연결합니다.
  - 이제 storage/renderSync/events는 실제 위치에서 직접 import합니다.

- `js/state.js`
  - 기본 state 생성, active subject, uid, 날짜 래퍼 등을 담당합니다.

- `js/config.js`
  - 앱 버전, Supabase 설정, 기본 요일 시간표, 복습 규칙, 학교 진도 옵션, 스케줄러 정책을 담습니다.

- `js/scheduler.js`
  - 날짜/스케줄 관련 공개 유틸리티의 얇은 barrel 파일입니다.
  - `dashboardRenderer.js`, `ui.js`에서 사용합니다.

- `js/ui.js`
  - DOM helper, toast, 공통 라벨/표시 유틸리티입니다.

- `js/dashboardRenderer.js`
  - 오늘의 빌드, 주간 보기, 캘린더, 개념 버전 현황, 수행평가 목록을 렌더링합니다.

- `js/curriculumParser.js`
  - 시험범위 트리 텍스트를 파싱하고 표시합니다.

- `js/versionEngine.js`
  - 교재 버전 입력/출력을 처리합니다.

- `js/aiPromptBuilder.js`
  - 현재 과목 기준 AI 설계 프롬프트를 만듭니다.

- `js/aiImporter.js`
  - AI JSON을 검토하고 과목 데이터로 적용합니다.

- `js/performanceScheduler.js`
  - 수행평가 항목과 단계별 진행을 처리합니다.

- `js/auth.js`
  - Supabase Auth 래퍼입니다.

## js/core/

- `dateUtils.js`
  - 로컬 날짜 계산, 날짜 범위, 요일 계산, 시간 계산.

- `capacityModel.js`
  - 요일별 공부 가능 시간표를 실제 날짜별 study block으로 펼칩니다.
  - 가능 과목/우선 과목 조건도 여기서 해석합니다.

- `durationModel.js`
  - 실제 소요 시간을 기반으로 다음 예상 시간을 보정합니다.

- `scoreModel.js`
  - 결과 선택, 설명 가능 단계, 정답률/이해도 변환과 위험도 계산을 담당합니다.

## js/data/

- `storage.js`
  - localStorage 저장/불러오기/내보내기/가져오기.

- `migrations.js`
  - 예전 데이터 구조를 현재 schema로 보정합니다.
  - 진행형 태스크, 학교 진도 계획 단계의 기본값도 여기서 보정합니다.

- `cloudSync.js`
  - Supabase 스냅샷 저장/불러오기.

- `supabaseClient.js`
  - Supabase client 생성.

- `defaultVersions.json`, `defaultPerformanceVersions.json`
  - 기본 버전/수행평가 보조 데이터입니다.

## js/planner/

- `planner.js`
  - 계획 엔진의 총괄 진입점입니다.
  - 과목 재계획, 전체 재계획, 복습/패치/학교 진도 태스크 연결을 담당합니다.

- `taskGenerator.js`
  - 시험범위 트리와 교재 버전을 기반으로 정규 `study` 태스크를 생성합니다.
  - v0 → v1 → v2 순서와 `sequenceOrder`, `prerequisiteTaskIds`를 부여합니다.

- `classProgressPlanner.js`
  - 학교 진도 기록을 `classReview`, `classStudy`, `classExamPrep` 태스크로 변환합니다.
  - 학교 진도형 과목의 핵심 생성기입니다.

- `scheduleEngine.js`
  - 태스크를 요일별 study block에 배치합니다.
  - 하루 목표량, 주말/평일 용량, 선행 태스크, 진행형 태스크의 `nextDate`, 미배치 처리를 담당합니다.

- `reviewPlanner.js`
  - 완료된 태스크 기반 R1/R2/R3 복습을 생성합니다.

- `patchPlanner.js`
  - 결과/설명 단계/시간 초과를 바탕으로 오답 패치 태스크를 생성합니다.

- `rescheduleEngine.js`
  - 재빌드 미리보기, 재빌드 적용, 완료 기록 반영을 담당합니다.

## js/ui/

- `renderTaskList.js`
  - 태스크 카드, 실제 시간, 결과, 설명 단계, 진행형 태스크 UI를 렌더링합니다.

- `renderClassProgress.js`
  - 학교 진도 입력/목록 UI를 렌더링합니다.

- `renderScheduleSettings.js`
  - 요일별 공부 가능 시간표 UI를 렌더링하고 읽어옵니다.

- `renderSync.js`
  - Supabase 백업/로그인 UI를 렌더링합니다.

- `renderWarnings.js`
  - 미배치/용량 경고를 렌더링합니다.

- `events.js`
  - 호환용 barrel입니다.
  - 실제 이벤트 구현은 `js/ui/events/` 아래로 분리되었습니다.

## js/ui/events/

- `index.js`
  - 이벤트 바인딩 진입점입니다.
  - 아래 이벤트 모듈을 한 번에 연결합니다.

- `tabEvents.js`
  - 탭 전환 이벤트.

- `subjectEvents.js`
  - 과목 생성/저장, 버전 저장, 시험범위 저장, 과목 카드 선택.

- `aiEvents.js`
  - AI 프롬프트 생성/복사, AI JSON 검토/적용.

- `performanceEvents.js`
  - 수행평가 생성/삭제/단계 체크.

- `dataEvents.js`
  - 날짜 변경, 백업 내보내기/가져오기, 재빌드, 초기화.

- `scheduleEvents.js`
  - 요일별 시간표 렌더링, 블록 추가/삭제, 시간표 저장.

- `classProgressEvents.js`
  - 학교 진도 기록/삭제/시험범위 포함 토글.

- `taskEvents.js`
  - 태스크 완료, 진행형 태스크 저장, 실제 시간/결과/설명 단계 기록, 수동 지연.

- `formUtils.js`
  - 과목 폼 채우기, AI JSON 검토 결과 렌더링 같은 이벤트 공용 유틸리티.

## css/

- `style.css`
  - CSS import 진입점입니다.

- `base.css`
  - 색상 변수, 기본 타이포그래피, reset.

- `layout.css`
  - 헤더, 사이드바, 탭, 기본 레이아웃.

- `components.css`
  - 카드, 버튼, 입력창, 배지, 태스크 카드 등 공통 컴포넌트.

- `dashboard.css`
  - 오늘의 빌드, 이번 주 보기, 개념 버전 현황.

- `calendar.css`
  - 월간 캘린더.

- `schedule.css`
  - 요일 시간표.

- `school-progress.css`
  - 학교 진도/동적 시험범위 UI 보강.

- `mobile.css`
  - 모바일 반응형.
