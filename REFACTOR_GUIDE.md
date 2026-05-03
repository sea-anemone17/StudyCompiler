# StudyCompiler v4.2 Event Refactor Guide

## 적용 방법

이 ZIP은 전체 프로젝트 구조를 정리한 버전입니다. 가장 안전한 적용 방식은 기존 저장소를 백업한 뒤, 이 ZIP의 내용으로 프로젝트 전체를 교체하는 것입니다.

```txt
1. 기존 저장소 백업 또는 새 브랜치 생성
2. ZIP 압축 해제
3. 기존 파일 전체 교체
4. GitHub에 commit/push
5. GitHub Pages에서 Ctrl + Shift + R 강력 새로고침
```

## 가장 큰 변경

기존 `js/ui/events.js`에 몰려 있던 이벤트 코드를 아래 구조로 분리했습니다.

```txt
js/ui/events/
  index.js
  tabEvents.js
  subjectEvents.js
  aiEvents.js
  performanceEvents.js
  dataEvents.js
  scheduleEvents.js
  classProgressEvents.js
  taskEvents.js
  formUtils.js
```

`js/ui/events.js`는 호환용 barrel로 남겨 두었습니다.

```js
export * from "./events/index.js";
```

하지만 `js/app.js`는 이제 실제 진입점인 `./ui/events/index.js`를 직접 import합니다.

## 정리한 root stub 파일

아래 루트 re-export 파일들은 새 ZIP에서는 제거했습니다.

```txt
js/events.js
js/storage.js
js/renderSync.js
js/rescheduler.js
js/patchEngine.js
js/reviewEngine.js
js/taskGenerator.js
js/cloudSync.js
js/supabaseClient.js
js/planner.js
```

대신 import 경로를 실제 구현 위치로 바꿨습니다.

```txt
js/data/storage.js
js/data/cloudSync.js
js/data/supabaseClient.js
js/planner/rescheduleEngine.js
js/ui/renderSync.js
js/ui/events/index.js
```

## 확인한 것

- 전체 JS 파일 `node --check` 문법 검사 통과
- 상대 import 경로 존재 검사 통과

## 적용 후 테스트 체크리스트

```txt
1. 앱이 켜지는가?
2. 탭 전환이 되는가?
3. 과목 저장이 되는가?
4. 시험범위 트리 저장/태스크 생성이 되는가?
5. 학교 진도 기록이 되는가?
6. 요일 시간표 저장 후 재배치가 되는가?
7. 태스크 완료/진행 저장이 되는가?
8. 백업 내보내기/가져오기가 되는가?
9. Supabase 로그인/저장이 되는가?
```

## 주의

GitHub Pages에 기존 root stub 파일이 남아 있어도 새 코드가 직접 사용하지는 않습니다. 다만 저장소를 깔끔하게 유지하려면 위 목록의 파일들은 삭제하는 것을 권장합니다.
