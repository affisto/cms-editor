# Blockroom · CMS Editor

문서, 노션식 작업 노트, 폼을 같은 블록으로 만드는 재사용 가능한 웹 편집기입니다. 비개발자는 블록을 고르고 내용을 작성하며, 개발자는 저장·업로드·제출 함수를 연결합니다.

## 실행

Node.js 22.12 이상과 npm이 필요합니다. Node.js 22 LTS에서 검증했습니다.

```sh
npm ci
npm run build:packages
npm run dev --workspace=docs
```

폼 제작 스튜디오: **http://127.0.0.1:4310**

```sh
npm run dev --workspace=vanilla  # http://127.0.0.1:4173 — React 없는 예제
npm run dev --workspace=web     # http://localhost:8000 — Gatsby 예제
npm run dev                    # 패키지 빌드 후 세 앱 실행
```

스튜디오는 기본적으로 상단 편집 툴바와 양쪽 패널 없이 열립니다. `/`로 내용을 넣고, 질문 제목·도움말·입력 안내·선택지·필수 여부는 블록에서 바로 수정하세요. 블록 왼쪽의 6점 핸들을 드래그해 순서를 바꾸고, 데스크톱에서는 핸들에 마우스를 올리거나 모바일에서는 길게 눌러 핸들 위의 가로형 아이콘 메뉴를 여세요. 복제·삭제 아이콘에 마우스를 올리면 기능 이름이 표시됩니다. 제출 버튼은 문구를 직접 편집하고 블록 안의 정렬 아이콘으로 왼쪽·가운데·오른쪽 배치를 지정합니다. 이미지는 `설정`에서 수정할 수 있습니다. 새 문서와 문서 전환은 본문 위에서 사용할 수 있고, 상단 `패널` 버튼으로 기존 사이드 패널을 켜거나 끌 수 있습니다. 미리보기에서 폼에 응답할 수 있습니다. 문서 메뉴의 JSON 가져오기·내보내기와 응답 내보내기를 사용할 수 있습니다. 새 문서는 기존 문서를 `내 문서`에 보관합니다.

**데모의 문서·이미지·응답은 현재 브라우저에만 저장됩니다.** 서버에 게시하거나 외부 응답을 수집하려면 사용하는 서비스의 저장·업로드·제출 API를 연결하세요. 브라우저 저장 공간을 초과하면 오류가 표시되며 JSON으로 내보낼 수 있습니다. 실제 사용자 데이터는 서비스 서버에서 검증하고 저장해야 합니다.

## 제공 기능

- 문서: 본문, 제목 1–3, 목록, 중첩 목록, 체크리스트, 인용, 코드, 구분선, 이미지, 토글
- 서식: 굵게, 기울임, 취소선, 인라인 코드, 링크, HTML 붙여넣기
- 폼: 단문·장문·이메일·숫자·단일 선택·다중 선택·드롭다운·제출 버튼
- 질문 설정: 제목, 설명, 필수 여부, 입력 안내, 선택지, 숫자 범위
- 편집: `/` 검색, 블록 추가·복제·삭제·이동, 6점 핸들 및 문서 구조에서 드래그 정렬, 실행 취소·다시 실행
- 이미지: 업로드 어댑터, 진행·실패 상태, 재시도, 주소 입력, 대체 텍스트, 캡션, 너비
- 응답: 검증, 오류 메시지, 중복 제출 방지, 제출 중·성공·실패 상태, 취소 신호
- 문서 데이터와 응답 분리, 안정적인 블록/질문 ID, JSON 검증, 버전 확인
- DOM 없이 실행 가능한 HTML 렌더러, 기본 URL 검증과 HTML 이스케이프
- CSS 변수 테마, 블록 허용 목록, 커스텀 블록 스키마 및 NodeView 등록

## 패키지 구조

| 경로                       | 책임                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `packages/editor-core`     | 문서 규격, 검증, ProseMirror 스키마, HTML 렌더러            |
| `cms-editor-core/browser` | 프레임워크 독립적인 DOM 에디터                 |
| `packages/editor-react`    | `CMSEditor`, `CMSRenderer`, React 블록 컴포넌트 연결            |
| `packages/editor-form` | 선택형 FormKit, 기본 폼 UI, 응답 검증과 `useCMSForm` |
| `apps/docs`                | 비개발자용 폼 제작 스튜디오, 브라우저 저장 어댑터           |
| `apps/vanilla`             | React 없이 사용, 소비자가 정의한 알림 블록 예제             |
| `apps/web`                 | Gatsby에서 같은 React 패키지 사용                           |
| `packages/ui/editor`       | 기존 경로 호환을 위한 새 패키지 재노출                      |
| `packages/prosemirror`     | 이전 예제 패키지, 새 에디터의 실행 의존성에는 포함되지 않음 |

## React에서 사용

필요한 패키지를 빌드·설치한 뒤 스타일을 한 번 가져옵니다. 아래 일반 패키지 이름으로 설치합니다: `npm install cms-editor-core cms-editor-react cms-editor-form`. 폼을 사용하지 않으면 `cms-editor-form`은 생략합니다.

```tsx
"use client";
import { useState } from "react";
import { CMSEditor } from "cms-editor-react";
import { createDocument, type CMSDocument } from "cms-editor-core";
import "cms-editor-core/style.css";

export function Composer({ initial }: { initial: CMSDocument }) {
  const [document, setDocument] = useState(initial);
  return <CMSEditor document={document} onChange={setDocument} />;
}

// createDocument()는 한 번 생성해 유지하거나 저장된 문서를 parseDocument()로 검증해 전달하세요.
// 서버 렌더링 시 서버와 클라이언트가 동일한 초기 문서를 사용해야 합니다.
```

React 외 환경에서는 `createEditor(element, options)`를 사용하고 화면이 사라질 때 `destroy()`를 호출합니다. 자세한 저장·업로드·제출 예제, 커스텀 블록, SSR, 문서 규격은 [통합 가이드](docs/integration.md)를 참고하세요.

폼은 `cms-editor-form/react`의 `FormKit`을 `extensions`에 등록하면 사용할 수 있습니다. 사용처의 React 블록, 질문 UI 교체, 직접 만드는 응답 폼은 [확장 제작 가이드](docs/extensions.md)를 참고하세요. 실행 예제: [커스텀 블록/폼](http://127.0.0.1:4310/examples/custom-blocks).

## 검증 및 빌드

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run test:packages # tarball을 별도 프로젝트에 설치해 검증 (네트워크 사용)
npm run build
```

브라우저 테스트는 스튜디오(4310)와 Vanilla 예제(4173)를 실행합니다. 해당 포트에 다른 앱이 실행 중이지 않아야 합니다. 반응형 스크린샷과 실패 trace는 `test-results/`에 생성됩니다.

로컬 배포용 패키지:

```sh
npm run build:packages
npm pack --workspace=cms-editor-core
npm pack --workspace=cms-editor-react
npm pack --workspace=cms-editor-form # 폼이 필요한 경우
# 다른 프로젝트에서 필요한 .tgz 파일을 함께 npm install
```

세 라이브러리는 조직 scope 없이 일반 npm 패키지 이름으로 배포합니다. 배포 대상은 라이브러리 tarball이며 스튜디오 앱과 로컬 설정은 포함하지 않습니다.

## 첫 버전의 범위

이번 버전은 브라우저용 에디터·렌더러·폼 런타임 및 통합 예제입니다. 기본 UI 언어는 한국어이며 툴바 라벨 일부를 재정의할 수 있습니다. CSS 변수로 프로젝트의 색상·글꼴을 적용할 수 있습니다.

표, 영상 임베드, 다단 레이아웃, 폼 첨부파일, 조건부 질문, 다단계 폼, 실시간 공동 편집, 완전한 다국어 UI는 후속 범위입니다. 네이티브 앱에서는 WebView로 사용할 수 있으며 네이티브 전용 렌더러는 제공하지 않습니다. 브라우저 검증 범위와 운영 전제는 [검증 기록](docs/verification.md)에 정리합니다.

새 라이브러리 `cms-editor-core`, `cms-editor-react`, `cms-editor-form`은 MIT 라이선스로 제공합니다. 각 패키지의 LICENSE를 확인하세요.
