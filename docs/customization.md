# 에디터와 폼 디자인 바꾸기

## 색상과 글꼴 적용하기

기본 CSS를 먼저 가져오고 앱의 CSS를 마지막에 가져오세요. FormKit의 기본 UI를 쓰는 경우 폼 CSS도 가져옵니다.

```tsx
import "cms-editor-core/style.css";
import "cms-editor-form/style.css";
import "./brand-editor.css";
```

호스트의 `className`에 색상과 글꼴을 지정하세요. 편집기, 응답 폼, 읽기 화면에 같은 클래스를 적용할 수 있습니다.

```css
.brand-editor {
	--color-surface: #fff;
	--color-ink: #192b24;
	--color-muted: #51665d;
	--color-rule: #cbd8d1;
	--color-soft: #f3f7f5;
	--color-accent: #1c684e;
	--color-tint: #e5f2eb;
	--color-on-accent: #fff;
	--color-error: #a82538;
	--color-overlay: rgb(15 31 24 / 0.4);
	--color-shadow: rgb(15 31 24 / 0.2);
	--font-body: "Pretendard", system-ui, sans-serif;

	background: var(--color-surface);
}

.brand-editor--dark {
	color-scheme: dark;
	--color-surface: #18241f;
	--color-ink: #edf6f0;
	--color-muted: #b2c5ba;
	--color-rule: #496255;
	--color-soft: #23342b;
	--color-accent: #8ddcbb;
	--color-tint: #294638;
	--color-on-accent: #132a20;
	--color-error: #ffa7b4;
	--color-overlay: rgb(0 0 0 / 0.6);
	--color-shadow: rgb(0 0 0 / 0.35);
}
```

페이지마다 다른 팔레트가 필요하면 각 편집기에 다른 클래스를 주세요. 다크 모드 버튼이나 시스템 테마 설정은 앱에서 관리하고, 어두운 화면에만 두 번째 클래스를 붙입니다. 전역 테마는 문서 JSON과 별도로 저장하세요. 편집 중 테마 클래스만 바꿀 때는 `key`가 그대로 유지되어야 합니다.

```tsx
<CMSEditor
	className={dark ? "brand-editor brand-editor--dark" : "brand-editor"}
	document={document}
	onChange={setDocument}
/>
```

바닐라 환경에서는 `createEditor(element, options)`의 `element`에 클래스를 붙이세요. `CMSForm`과 `CMSRenderer`는 각각 `className`을 받습니다. `mountForm`과 `renderHTML`을 직접 쓰는 경우 결과를 표시하는 요소에 클래스를 붙이세요.

슬래시 메뉴, 블록 핸들과 팝오버 설정은 편집기 안에서 CSS 변수를 상속합니다. `inspectorRef`나 `inspectorElement`로 외부 설정 패널을 연결하면 해당 요소에도 테마 클래스를 적용하거나 테마가 지정된 공통 요소 안에 두세요.

## 모서리와 간격 조정하기

CSS 변수로 바꿀 수 있는 항목은 색상과 글꼴입니다. 모서리, 편집 영역 여백과 질문 간격은 필요한 선택자에 범위를 좁혀 덮어쓰세요.

```css
.brand-editor .cms-atomic,
.brand-editor .cms-form .cms-choice {
	border-radius: 12px;
}

.brand-editor .cms-surface {
	padding-block: 28px 40px;
}

.brand-editor .cms-form .cms-field {
	margin-block: 20px;
}
```

좁은 화면에서는 왼쪽 여백에 블록 핸들이 놓입니다. 편집 영역의 세로 여백만 바꿀 때는 `padding-block`을 사용해 기본 좌우 여백을 유지하세요. `.cms-*` 선택자를 덮어쓴 뒤에는 좁은 화면에서 핸들 위치와 키보드 포커스 표시를 확인하세요.

## 질문과 제출 버튼의 편집 UI 교체하기

`FormKit`을 등록한 `CMSEditor`의 `components`에 앱의 컴포넌트를 연결하세요. 질문 키는 `field`이고 제출 버튼 키는 `submit`입니다. 교체할 키만 지정하세요.

- 컴포넌트는 `BlockViewProps`의 `attrs`, `selected`, `updateAttributes`를 받습니다. 질문의 `kind`, `label`, `required` 같은 속성을 읽고 수정값을 `updateAttributes`로 전달하세요.
- `components`는 자식 콘텐츠가 없는 atom 블록의 **편집 화면**에 적용됩니다. 속성 변경은 FormKit의 검증과 에디터의 실행 취소 기록을 거칩니다. [질문 편집 컴포넌트 예제](../apps/docs/app/examples/custom-blocks/page.tsx)
- `components`, `extensions`, `allowedBlocks`, `nodeViews`는 마운트 시 설정됩니다. 구성 자체를 바꿀 때는 현재 문서를 상태에 보관한 뒤 `key`를 변경해 에디터를 다시 마운트하세요.

외부 설정 패널, 상단 툴바, 입력 안내가 필요하면 [통합 가이드](integration.md#사이드-패널-없이-사용하기)를 참고하세요.

## 응답 화면과 읽기 화면 꾸미기

- **기본 응답 폼.** `CMSForm`과 `mountForm`은 정해진 폼 마크업을 렌더링합니다. 위 CSS를 적용하고 `successMessage`로 제출 완료 문구를 바꾸세요.
- **직접 만든 응답 폼.** 마크업이나 컨트롤을 교체하려면 `useCMSForm`의 `answers`, `errors`, `status`, `setAnswer`, `submit`을 앱의 폼에 연결하세요. 앱에서 라벨, 입력, 오류와 제출 버튼을 렌더링하고 `onSubmit`에서 전송합니다. [응답 폼 통합 예제](integration.md#앱의-컴포넌트로-응답-폼-만들기)
- **읽기 화면.** `CMSRenderer`와 `renderHTML`은 확장 정의의 `renderHTML` 또는 `spec.toDOM`으로 HTML을 출력합니다. 모양은 호스트 CSS로 바꾸고, 블록 마크업 변경은 해당 확장의 출력 정의에 적용하세요. [새 블록 만들기](extensions.md)
