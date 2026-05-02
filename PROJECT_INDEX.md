# PROJECT_INDEX

Study Compiler v4.2의 주요 파일 역할입니다.

## 루트

- `index.html`
  - 앱의 탭/폼/패널 구조를 담당합니다.
  - `#scheduleSettingsView`, `#classProgressView`, `#subjectForm` 같은 렌더링 대상이 있어야 JS 기능이 연결됩니다.

- `README.md`
  - 현재 앱의 목적과 사용 흐름을 설명합니다.

## js/

- `js/app.js`
  - 앱 시작점입니다.
  - 상태 로드, 전체 렌더링, 이벤트 바인딩을 연결합니다.

- `js/state.js`
  - 기본 state 생성, active subject, uid, 날짜 래퍼 등을 담당합니다.

- `js/config.js`
  - 앱 버전, Supabase 설정, 기본 요일 시간표, 복습 규칙, 학교 진도 옵션을 담습니다.

## js/core/

- `dateUtils.js`
  - 로컬 날짜 계산, 날짜 범위, 요일 계산, 시간 계산을 담당합니다.

- `capacityModel.js`
  - 요일별 공부 가능 시간표를 실제 날짜별 study block으로 펼칩니다.
  - 가능 과목/우선 과목 조건도 여기서 해석합니다.

- `durationModel.js`
  - 실제 소요 시간을 기반으로 다음 예상 시간을 보정합니다.

- `scoreModel.js`
  - 결과 선택, 설명 가능 단계, 정답률/이해도 변환을 담당합니다.

## js/planner/

- `planner.js`
  - 계획 엔진의 총괄 진입점입니다.
  - 과목 재계획, 전체 재계획, 복습/패치/학교 진도 태스크 연결을 담당합니다.

- `taskGenerator.js`
  - 시험범위 트리와 교재 버전을 기반으로 정규 study 태스크를 생성합니다.
  - v0 → v1 → v2 순서와 sequenceOrder/prerequisite를 부여합니다.

- `scheduleEngine.js`
  - 태스크를 요일별 study block에 배치합니다.
  - 하루 목표량, 블록 조건, 선행 태스크, 미배치 처리를 담당합니다.

- `classProgressPlanner.js`
  - 학교 진도 기록을 classReview 태스크로 변환합니다.
  - 기본 규칙은 당일/2일 뒤/7일 뒤 복습입니다.

- `reviewPlanner.js`
  - 완료된 태스크 기반 R1/R2/R3 복습을 생성합니다.

- `patchPlanner.js`
  - 결과/설명 단계/시간 초과를 바탕으로 오답 패치 태스크를 생성합니다.

- `rescheduleEngine.js`
  - 재빌드 미리보기, 재빌드 적용, 완료 기록 반영을 담당합니다.

## js/data/

- `storage.js`
  - localStorage 저장/불러오기/내보내기/가져오기를 담당합니다.

- `migrations.js`
  - 예전 데이터 구조를 현재 schema로 보정합니다.

- `cloudSync.js`
  - Supabase 스냅샷 저장/불러오기를 담당합니다.

- `supabaseClient.js`
  - Supabase client 생성과 로그인 상태 확인을 담당합니다.

## js/ui/

- `events.js`
  - 버튼, 폼, 탭, 태스크 완료, 시간표 저장, 학교 진도 입력 이벤트를 연결합니다.
  - 기능이 많아졌으므로 추후 분리 후보입니다.

- `renderScheduleSettings.js`
  - 요일별 공부 가능 시간표 UI를 렌더링하고 읽어옵니다.

- `renderClassProgress.js`
  - 학교 진도 입력/목록 UI를 렌더링합니다.

- `renderSync.js`
  - Supabase 동기화 UI를 렌더링합니다.

- `renderTaskList.js`
  - 태스크 목록 UI를 렌더링합니다.

- `renderWarnings.js`
  - 미배치/용량 경고를 렌더링합니다.

## css/

- `style.css`
  - CSS import 진입점입니다.

- `base.css`
  - 색상 변수, 기본 타이포그래피, reset.

- `layout.css`
  - 헤더, 사이드바, 탭, 기본 레이아웃.

- `components.css`
  - 카드, 버튼, 입력창, 배지 등 공통 컴포넌트.

- `dashboard.css`
  - 오늘의 빌드, 이번 주 보기, 개념 버전 현황.

- `calendar.css`
  - 월간 캘린더.

- `schedule.css`
  - 요일 시간표.

- `mobile.css`
  - 모바일 반응형.
