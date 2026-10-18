# 통합 가이드

사용처에서 컴포넌트를 직접 만들거나 폼 플러그인을 교체하려면 [확장 제작 가이드](extensions.md)를 먼저 보세요. 폼 관련 API는 이제 `cms-editor-form` 패키지에 있습니다.

## 공통 코어와 브라우저 경계

`cms-editor-core`는 DOM 없이 문서 검증, 응답 검증, HTML 생성을 수행합니다. `cms-editor-core/browser`는 브라우저 DOM이 있어야 실행할 수 있습니다. React 연결 계층에는 서비스별 네트워크 호출이나 저장소가 없습니다.

```ts
import { createDocument, parseDocument, renderHTML } from "cms-editor-core";
import { createEditor } from "cms-editor-core/browser";
import { FormKit, mountForm } from "cms-editor-form/browser";
import "cms-editor-core/style.css";
import "cms-editor-form/style.css";

const editor = createEditor(document.querySelector("#editor")!, {
  document: createDocument("새 문서"),
  extensions: [FormKit],
  onChange: (value) => {
    /* 문서 상태 갱신 또는 debounce 저장 */
  },
  onError: (error) => {
    /* 서비스의 오류 UI */
  },
  uploadImage: async (file, signal) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/uploads", {
      method: "POST",
      body,
      signal,
    });
    if (!response.ok) throw new Error("이미지를 업로드하지 못했습니다.");
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== "object" ||
      !("src" in result) ||
      typeof result.src !== "string"
    ) {
      throw new Error("업로드 응답이 올바르지 않습니다.");
    }
    return { src: result.src };
  },
});

const value = editor.getDocument();
// 저장: JSON.stringify(value)
// 불러오기: editor.setDocument(parseDocument(savedJSON, [FormKit]))
// 화면 해제: editor.destroy()
```

Vue의 `onMounted`/`onBeforeUnmount`, Svelte의 `onMount` cleanup, Angular의 view 초기화/파괴 훅에서도 같은 DOM API를 사용할 수 있습니다. 별도 프레임워크 어댑터를 제공하거나 해당 프레임워크 런타임에서 검증한 것은 아닙니다. Vanilla 앱에서 프레임워크 없는 사용을 검증합니다.

### 에디터 API

| API                        | 동작                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `getDocument()`            | 저장 가능한 v1 문서 스냅샷                                  |
| `setDocument(document)`    | 검증 후 전체 교체, 실행 취소 기록 초기화, `onChange` 미발생 |
| `setTitle(title)`          | 메타 제목 변경, `onChange` 발생                             |
| `insert(type, attrs?)`     | 현재 최상위 블록 다음에 삽입; 빈 문단이면 대체              |
| `selectBlock(index)`       | 최상위 블록 선택                                            |
| `getSelected()`            | 현재 최상위 블록의 index, 위치, JSON                        |
| `moveBlock(from, to)`      | 최상위 블록 순서 변경                                       |
| `duplicate()` / `remove()` | 선택 블록 복제·삭제; 마지막 블록 삭제 시 빈 문단 유지       |
| `updateBlock(patch)`       | 선택 블록 속성 검증 후 변경                                 |
| `undo()` / `redo()`        | 문서 내용의 실행 취소·다시 실행                             |
| `openPalette()`            | 검색 가능한 블록 추가 창                                    |
| `importHTML(html)`         | 외부 HTML을 지원 스키마로 변환; 문서 교체                   |
| `uploadImage(file)`        | 현재 이미지 블록에 업로드; PNG/JPEG/GIF/WebP, 최대 5MB      |
| `focus()` / `destroy()`    | 포커스 / 이벤트·DOM·진행 중 작업 정리                       |
| `view`                     | 고급 통합용 ProseMirror EditorView                          |

`allowedBlocks`는 삽입 메뉴·삽입 명령·입력 규칙을 제한합니다. 기존 문서를 손실 없이 열기 위해 스키마 자체를 제거하지 않습니다. 허용하지 않는 종류의 문서를 저장하면 안 되는 서비스는 서버에서 별도로 검증해야 합니다. 외부 HTML 붙여넣기는 지원되는 서식만 유지합니다. 내부 질문 블록을 복사·붙여넣으면 설정을 유지하고 새 질문 ID를 부여합니다. `duplicate()`로도 복제할 수 있습니다.

블록 추가는 빈 문단에서 `/`를 입력하면 커서에 붙는 팝오버가 열립니다. 본문에서 `/검색어`를 입력하면 추천·기본 블록·폼 블록 메뉴가 즉시 필터링됩니다. 방향키와 Enter로 선택하는 동안 본문 포커스를 유지하고, 선택하면 `/검색어`를 해당 블록으로 바꿉니다. Esc·메뉴 닫기·바깥 클릭으로 취소하면 입력한 텍스트는 그대로 유지됩니다. 화면 아래에서는 위로 펼쳐지며 스크롤·화면 크기에 맞춰 위치를 보정합니다. 전체 메뉴는 Ctrl/⌘+Shift+K, 실행 취소는 Ctrl/⌘+Z, 다시 실행은 Ctrl/⌘+Shift+Z입니다. Alt+위/아래는 최상위 블록 이동이며 목록 안에서는 Tab/Shift+Tab으로 중첩을 변경합니다. 제목 입력 규칙은 `# `부터 `### `까지입니다.

`extensions`, `allowedBlocks`, `nodeViews`, `inspectorElement`는 생성 시 설정입니다. React에서는 이 설정을 변경할 때 `key`를 바꿔 새 인스턴스를 만드세요. 문서 메타 제목과 호스트의 외부 UI 상태는 본문 실행 취소 기록에 포함되지 않습니다.

## 폼 실행과 서비스 제출

```ts
import { mountForm } from "cms-editor-form/browser";

const form = mountForm(container, {
  document: savedDocument,
  onSubmit: async (submission, signal) => {
    const response = await fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
      signal,
    });
    if (!response.ok)
      throw new Error("응답을 저장하지 못했습니다. 다시 시도해주세요.");
  },
  successMessage: "응답을 받았습니다.",
});
// form.getAnswers()로 현재 답변을 읽습니다.
// form.destroy()는 진행 중 제출의 AbortSignal도 취소합니다.
```

React에서는 `cms-editor-form/react`에서 가져온 `<CMSForm document={savedDocument} onSubmit={submit} />`을 사용합니다. `document` 객체가 교체되면 폼도 재생성되므로 응답 중 불필요하게 새 객체를 만들지 마세요. 제출 중 입력과 제출 버튼을 잠그며 실패하면 답변을 유지하고 다시 제출할 수 있습니다. 성공 후 버튼은 잠금 상태를 유지합니다.

서버는 클라이언트가 보낸 문서 정의를 믿지 말고 `documentId`로 승인된 문서를 읽은 뒤 `parseDocument`, `validateAnswers`, `createSubmission`을 적용하세요. 인증·권한·업로드 저장소·전송 재시도에 대한 서버 측 중복 방지는 사용하는 서비스의 책임입니다. 폼 필드 ID가 같으면 순서 변경 후에도 동일한 질문으로 취급합니다. 질문의 의미가 바뀌면 새 필드를 만들고, 발행된 문서 버전을 보관해 과거 응답의 의미를 유지하세요.

## 데이터 형식과 버전 정책

```ts
interface CMSDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  content: JSONNode; // ProseMirror doc: 블록, 인라인 텍스트, marks
}
interface Submission {
  documentId: string;
  schemaVersion: 1;
  answers: Record<string, string | string[]>; // key = fieldId
}
```

각 블록에는 고유 `id`, 질문에는 별도 `fieldId`가 있습니다. 이동 시 유지하고 복제 시 새로 발급합니다. 체크리스트의 완료 표시는 문서 상태이며, 폼 질문 응답과 구분합니다. 숫자 응답은 사용자가 입력한 문자열로 전달하고 범위·숫자 여부를 검증합니다.

`parseDocument(unknown)`는 v1만 허용합니다. 지원하지 않는 버전·블록·속성, 중복 ID, 잘못된 중첩, 위험한 URL은 명시적으로 오류 처리하며 원본을 덮어쓰지 않습니다. 버전이 추가될 때마다 별도 마이그레이션 함수를 작성하고 기존 저장 문서 fixture로 검증해야 합니다. 현재 변환할 과거 형식은 없으므로 암묵적인 마이그레이션은 하지 않습니다.

## 출력과 SSR

```ts
import { parseDocument, renderHTML } from "cms-editor-core";
import { FormKit } from "cms-editor-form";
const extensions = [FormKit];
const html = renderHTML(parseDocument(savedJSON, extensions), { extensions, showTitle: true });
```

이 함수는 Node.js에서도 동작하며 사용자 텍스트와 속성을 이스케이프합니다. `<CMSRenderer document={document} />`로 React에서 표시할 수도 있습니다. 폼 필드는 정적 출력에서 비활성화되고 제출 버튼은 숨겨집니다. 응답 가능한 화면은 `CMSForm`/`mountForm`을 사용하세요. 이미지와 링크에는 허용된 URL 형식만 적용합니다. 커스텀 확장은 서비스 개발자가 작성하는 신뢰된 코드이며 외부에서 제공된 실행 코드를 등록해서는 안 됩니다.

여러 렌더러를 같은 페이지에 직접 출력할 때는 `idPrefix`를 서로 다르게 지정하세요. React 렌더러와 DOM 폼 마운트는 자동으로 고유 prefix를 부여합니다.

## 커스텀 블록

```ts
import type { BlockExtension } from "cms-editor-core";
const callout: BlockExtension = {
  name: "callout",
  label: "알림 상자",
  spec: {
    content: "inline*",
    attrs: { tone: { default: "info" } },
    toDOM: () => ["aside", { class: "callout" }, 0],
  },
  validate(attrs) {
    if (attrs.tone !== "info")
      throw new Error("지원하지 않는 알림 종류입니다.");
  },
};
```

에디터, `parseDocument`, `renderHTML`, 폼에 같은 `extensions: [FormKit, callout]`를 전달하세요. `group: block`과 블록 ID 속성은 코어가 부여합니다. `toDOM`은 SSR 호환을 위해 DOM 노드 대신 배열 형태의 DOMOutputSpec을 반환해야 합니다. 복잡한 편집 UI는 `nodeViews`로 ProseMirror NodeView를 전달하고, 서비스의 설정 UI에서 `updateBlock`을 사용합니다. `apps/vanilla/main.ts`가 실제 예제입니다.

## 테마와 라벨

```css
.my-editor {
  --color-accent: #2458c9;
  --color-surface: #ffffff;
  --color-ink: #242c3b;
  --color-muted: #657187;
  --color-rule: #dbe1ea;
  --color-soft: #f5f7fa;
  --color-tint: #edf2ff;
  --font-body: system-ui, sans-serif;
}
```

기본 UI는 한국어입니다. `labels` 옵션은 툴바의 add/undo/redo/bold/italic/strike/link 접근성 라벨 재정의용이며 전체 다국어 지원을 의미하지 않습니다. 입력 안내는 `placeholder`, 폼 완료 문구는 `successMessage`로 바꿀 수 있습니다. 문서 제목과 질문 문구는 사용자가 직접 작성합니다.

## 사이드 패널 없이 사용하기

상단 편집 툴바는 기본적으로 표시하지 않습니다. 기존 고정 툴바가 필요한 통합에서는 생성 옵션 또는 React prop에 `showToolbar: true`를 지정할 수 있습니다. 별도 `inspectorElement`를 전달하지 않으면 블록 설정이 팝오버로 열립니다. 질문 제목·도움말·입력 안내·선택지·필수 여부·숫자 범위는 질문 블록 안에서 바로 수정합니다. 왼쪽 6점 핸들을 드래그해 순서를 바꾸고, 호버 또는 길게 누르기로 복제·삭제 아이콘 메뉴를 열 수 있습니다. 목록 항목 핸들의 메뉴는 해당 항목에만 적용됩니다. 제출 버튼은 문구를 직접 편집하고 정렬 아이콘으로 배치합니다. 이미지는 블록의 `설정` 버튼으로, 토글은 핸들 메뉴의 설정 아이콘으로 수정합니다.

```tsx
<CMSEditor document={document} onChange={setDocument} inspectorMode="popover" />
```

외부 설정 패널을 연결할 때는 `inspectorElement`(React는 `inspectorRef`)와 `inspectorMode: 'inline'`을 사용합니다. 외부 요소만 전달한 경우 기본값은 `inline`입니다.

- `setInspectorMode('inline' | 'popover')`: 설정 UI 위치만 전환하며 문서, 선택, 실행 취소 기록을 유지합니다. React의 `inspectorMode` prop도 재마운트 없이 변경할 수 있습니다.
- `openInspector('toolbar' | 'block')`: 현재 블록의 설정을 엽니다.
- `closeInspector()`: 팝오버를 닫습니다. 화면을 숨기거나 미리보기로 바꿀 때 호출하세요.

설정 UI는 코어가 소유한 별도 DOM 노드이므로 외부 호스트의 다른 내용을 삭제하거나 React가 소유한 호스트를 이동하지 않습니다. 스튜디오의 패널 표시 여부는 문서 데이터와 별도로 현재 브라우저에 저장됩니다.

질문을 직접 편집할 때 DOM 입력 요소를 유지하여 커서와 한글 조합을 보존합니다. IME 조합은 완료 시 커밋하고, 일반 유효한 입력은 즉시 문서 변경 이벤트를 발생시킵니다. 빈 질문 제목이나 중복 선택지는 저장하지 않으며 포커스를 떠나면 이전 유효 값으로 복원하고 오류를 표시합니다. 질문 내용 편집은 기존 실행 취소/다시 실행 기록에 포함되고, 질문 ID는 바뀌지 않습니다.

## 블록 핸들

일반 블록 왼쪽에는 블록 핸들, 글머리·번호 목록에는 각 항목의 왼쪽 핸들이 표시됩니다. 목록 항목은 같은 목록 안에서 순서를 바꾸며, 중첩 목록과 항목 안의 내용은 함께 이동합니다. 중첩 목록의 항목에도 개별 핸들을 제공합니다. 목록 전체 이동은 문서 구조 패널에서 사용할 수 있습니다.

- 데스크톱: 핸들 드래그로 순서를 변경하고, 호버하면 핸들 위에 가로형 아이콘 메뉴를 엽니다. 메뉴에는 이동 항목이 없으며, 각 아이콘에 호버하거나 키보드 포커스를 두면 이름이 상단 툴팁으로 표시됩니다. 상단 공간이 부족하면 화면 안쪽 아래로 전환합니다.
- 모바일: 핸들을 약 0.5초 누르면 작업 메뉴를 엽니다. 누른 뒤 움직이면 드래그로 처리하며, 짧은 탭은 블록만 선택합니다. 본문 영역에서는 일반 스크롤과 직접 편집을 유지합니다.
- 키보드: 핸들에 포커스를 둔 뒤 Enter/Space/아래 방향키로 메뉴를 열고, 좌우 방향키로 항목을 선택합니다. Alt+위/아래로 순서를 바꿀 수도 있습니다. 목록 항목 핸들에서는 Tab/Shift+Tab으로 들여쓰기·내어쓰기를 할 수 있으며, 중첩 단계가 바뀌어도 같은 핸들의 포커스를 유지합니다. Esc는 메뉴나 진행 중 드래그를 취소합니다.

드래그 중 삽입선을 표시하고 화면 또는 스크롤 컨테이너 가장자리에서 자동 스크롤합니다. 놓는 시점에 한 번만 문서를 변경하므로 한 번의 실행 취소로 복원할 수 있습니다. 블록 ID와 질문 ID는 유지합니다. 편집기 바깥에 놓기, pointercancel, 창 비활성화, 문서 교체 시 드래그를 취소합니다.

핸들과 메뉴는 편집 DOM 바깥에 배치되어 저장 JSON, 복사된 콘텐츠, 게시 화면과 응답 폼에 포함되지 않습니다. `destroy()`에서 포인터 캡처·타이머·스크롤 처리·관찰자를 정리합니다.

핸들은 평소 낮은 불투명도로 표시하며 호버·포커스·드래그 시 선명해집니다. 드래그 중에는 블록 모양의 미리보기가 포인터를 부드럽게 따라가고 주변 블록이 예상 위치로 이동합니다. 놓거나 취소하면 약 220ms 동안 정착합니다. 시각적 이동과 드롭 판정 좌표를 분리해 흔들리는 재정렬을 방지하고, 실제 문서는 드롭 시 한 번만 변경합니다. `prefers-reduced-motion: reduce`에서는 보간·정착 효과 없이 같은 기능을 제공합니다.

핸들은 각 블록 상단에 맞추고 편집 콘텐츠보다 위에 표시합니다. 핸들 자체에는 테두리나 포커스 외곽선을 쓰지 않으며, 키보드 포커스는 배경색과 대비로 구분합니다. 메뉴 아이콘은 접근 가능한 이름을 유지하고, 툴팁은 화면 가장자리를 넘지 않도록 위치를 조정합니다.

제출 블록의 `attrs.align`은 `left | center | right`이며 생략한 기존 문서는 `left`로 처리합니다. 문구와 정렬은 JSON·클립보드·실행 취소 기록에 보존되며 `CMSForm`/`mountForm` 출력에도 적용됩니다.

툴바 없이 `/`로 블록을 추가하고 `Cmd/Ctrl+Z`로 실행 취소, `Cmd/Ctrl+Shift+Z`로 다시 실행합니다. `Cmd/Ctrl+B`·`I`로 굵게·기울임을 적용하고, 목록의 `Tab`·`Shift+Tab`으로 들여쓰기·내어쓰기를 합니다. `showToolbar`는 생성 시 옵션입니다.

목록 본문에서 클릭 직후 Tab을 누를 때도 실제 브라우저 커서 위치를 기준으로 들여씁니다. 이전 항목이 없는 첫 항목에서는 들여쓰기하지 않고 본문 포커스를 유지합니다. 목록 밖의 Tab은 일반 포커스 이동을 유지합니다.
