# 새 블록 만들기

제목과 본문을 편집할 수 있는 안내 카드를 만듭니다. 카드를 슬래시 메뉴에서 추가하고, 저장한 JSON을 Node.js에서 검증해 읽기용 HTML로 출력합니다. React와 React DOM이 설치된 앱에서 시작하세요.

```sh
npm install cms-editor-core cms-editor-react
```

블록이 다루는 데이터와 편집 경험을 결정할 때는 [블록 설계 원칙](block-design.md)을 참고하세요.

## 1. 안내 카드의 정의 작성하기

`notice-card.ts`를 만드세요. 이 파일은 브라우저와 Node.js가 함께 사용합니다. 제목과 본문은 각각 텍스트 속성입니다. `menu`의 항목이 슬래시 메뉴에 나타납니다.

```ts
import type { BlockExtension } from "cms-editor-core";

export const NoticeCard: BlockExtension = {
	name: "notice_card",
	label: "안내 카드",
	spec: {
		atom: true,
		draggable: true,
		attrs: {
			title: { default: "참여 안내" },
			message: { default: "궁금한 점을 알려주세요." },
		},
		toDOM: (node) => [
			"aside",
			{
				class: "consumer-notice",
				"data-notice-card": "",
				"data-title": node.attrs.title,
				"data-message": node.attrs.message,
			},
			["strong", node.attrs.title],
			["p", node.attrs.message],
		],
		parseDOM: [
			{
				tag: "aside[data-notice-card]",
				getAttrs: (dom) => ({
				  title: dom.getAttribute("data-title"),
				  message: dom.getAttribute("data-message"),
				}),
			},
		],
	},
	validate(attrs) {
		if (
			typeof attrs.title !== "string" ||
			!attrs.title.trim() ||
			typeof attrs.message !== "string"
		)
			throw new Error("안내 제목과 내용을 입력하세요.");
	},
	menu: [{ label: "안내 카드", icon: "i" }],
};
```

`name`은 JSON에 저장되는 타입입니다. 코어가 블록 그룹과 `id` 속성을 추가합니다. `validate`는 저장 문서를 열거나 React 편집 컴포넌트가 값을 커밋할 때 실행됩니다. `parseDOM`은 대응하는 마크업을 HTML 가져오기와 붙여넣기에서 읽습니다. `spec.toDOM`을 배열로 반환하면 코어가 같은 구조를 HTML로 직렬화하면서 텍스트와 속성값을 이스케이프합니다.

## 2. 블록을 등록하고 편집하기

`NoticeComposer.tsx`를 만들고 앱에 `<NoticeComposer />`를 표시하세요. 첫 화면에는 안내 카드와 빈 문단이 나타납니다. 빈 문단에 `/`를 입력하고 **안내 카드**를 선택하면 기본 제목과 본문을 가진 카드가 추가됩니다.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
	createDocument,
	newId,
	parseDocument,
	textBlock,
	type CMSDocument,
} from "cms-editor-core";
import { CMSEditor, type BlockViewProps } from "cms-editor-react";
import { NoticeCard } from "./notice-card";
import "cms-editor-core/style.css";

const extensions = [NoticeCard];

function NoticeEditor({ attrs, updateAttributes }: BlockViewProps) {
	const savedTitle = String(attrs.title);
	const savedMessage = String(attrs.message);
	const [draft, setDraft] = useState({ title: savedTitle, message: savedMessage });
	const composing = useRef(false);

	useEffect(() => {
		setDraft({ title: savedTitle, message: savedMessage });
	}, [savedTitle, savedMessage]);

	function edit(field: "title" | "message", value: string) {
		setDraft((current) => ({ ...current, [field]: value }));
		if (!composing.current) updateAttributes({ [field]: value });
	}

	return (
		<aside>
			<input
				aria-label="안내 카드 제목"
				value={draft.title}
				onChange={(event) => edit("title", event.currentTarget.value)}
				onCompositionStart={() => { composing.current = true; }}
				onCompositionEnd={(event) => {
					composing.current = false;
					edit("title", event.currentTarget.value);
				}}
				onBlur={() => {
					if (!draft.title.trim()) setDraft({ ...draft, title: savedTitle });
				}}
			/>
			<textarea
				aria-label="안내 카드 내용"
				value={draft.message}
				onChange={(event) => edit("message", event.currentTarget.value)}
				onCompositionStart={() => { composing.current = true; }}
				onCompositionEnd={(event) => {
					composing.current = false;
					edit("message", event.currentTarget.value);
				}}
			/>
		</aside>
	);
}

const components = { notice_card: NoticeEditor };

export function NoticeComposer() {
	const [document, setDocument] = useState<CMSDocument>();
	const [error, setError] = useState("");

	useEffect(() => {
		const initial = createDocument("워크숍", [
			{ type: NoticeCard.name, attrs: { id: newId() } },
			textBlock(),
		]);
		setDocument(parseDocument(initial, extensions));
	}, []);

	if (!document) return null;

	return (
		<>
			<p role="alert">{error}</p>
			<CMSEditor
				document={document}
				extensions={extensions}
				components={components}
				onChange={(next) => {
					setError("");
					setDocument(next);
				}}
				onError={(reason) => setError(reason.message)}
			/>
			<details>
				<summary>저장할 JSON</summary>
				<pre>{JSON.stringify(document, null, 2)}</pre>
			</details>
		</>
	);
}
```

제목을 지웠을 때 오류가 표시되고 JSON에는 마지막 유효한 제목이 남습니다. 다른 곳으로 포커스를 옮기면 제목이 유효한 값으로 돌아옵니다. `updateAttributes`는 적용 여부를 반환합니다. 검증 오류는 `onError`로 전달됩니다. 제목을 바꾸고 Cmd/Ctrl+Z를 누르면 에디터 기록의 이전 값으로 돌아옵니다. `id`와 `uniqueAttributes`는 코어가 관리합니다.

React 컴포넌트는 portal로 마운트되므로 앱의 Context를 상속합니다. `components`는 자식이 없는 atom 블록을 지원합니다. 편집 가능한 리치 텍스트가 필요한 블록은 `spec.content`를 정의하고 `spec.toDOM`의 콘텐츠 홀 `0` 또는 ProseMirror NodeView의 `contentDOM`을 사용하세요.

## 3. 저장한 JSON으로 읽기 화면 만들기

**저장할 JSON**의 값을 복사해 아래 함수에 넘기세요. 유효한 입력은 `<strong>`으로 제목을, `<p>`로 본문을 표시하는 HTML을 반환합니다. 공백 제목을 넣거나 블록 이름을 바꿔 호출하면 `ok: false`를 반환합니다.

```ts
// render-notice.ts
import { parseDocument, renderHTML } from "cms-editor-core";
import { NoticeCard } from "./notice-card";

const extensions = [NoticeCard];

export function renderNotice(savedJSON: unknown) {
	try {
		const document = parseDocument(savedJSON, extensions);
		return { ok: true, html: renderHTML(document, { extensions }) } as const;
	} catch (reason) {
		const error = reason instanceof Error ? reason.message : "문서를 읽지 못했습니다.";
		return { ok: false, error } as const;
	}
}
```

JSON에는 스키마에 맞는 콘텐츠가 저장됩니다. 편집 컴포넌트와 HTML 출력 함수는 앱 코드로 등록하세요. `renderHTML` 훅에서 HTML을 직접 구성한다면 사용자 문자열과 속성값을 `escapeHTML`로 처리하세요. URL은 `safeURL`로 검증한 후 이스케이프합니다.

FormKit을 함께 사용하면 편집기, 파서, 렌더러와 응답 폼에 `[FormKit, NoticeCard]`를 전달하세요. 같은 타입 이름은 한 번만 등록합니다. 여러 확장은 `{ name: "my-kit", extensions: [NoticeCard] }`처럼 묶을 수 있습니다. 서버에서 가져올 엔트리와 폼 연결은 [통합 가이드](integration.md)를 참고하세요.

## 저장소에서 예제 실행하기

저장소를 체크아웃한 후 아래 명령을 실행하세요.

```sh
npm ci
npm run build:packages
npm run dev --workspace=docs
```

[커스텀 블록 데모](http://127.0.0.1:4310/examples/custom-blocks)에서 안내 카드, 교체한 질문 편집 UI와 직접 만든 응답 폼을 함께 확인할 수 있습니다. [브라우저와 서버가 공유하는 정의](../apps/docs/app/examples/custom-blocks/notice-card.ts)와 [React 예제 페이지](../apps/docs/app/examples/custom-blocks/page.tsx)를 참고하세요.
