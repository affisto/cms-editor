# 사용처에서 블록과 폼을 만드는 방법

에디터는 문서 상태·선택·슬래시 메뉴·핸들·실행 취소를 관리합니다. 블록의 데이터와 편집 화면은 확장으로 등록합니다. 우리가 제공하는 폼도 같은 확장 API를 사용하는 선택 패키지입니다.

Tiptap의 [노드 확장](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node)과 [React NodeView](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react)처럼 데이터 정의와 편집 컴포넌트를 분리하는 구조입니다. Tiptap 확장이나 API를 그대로 가져다 쓰는 호환 계층은 아닙니다.

## 패키지 선택

| 패키지/엔트리 | 역할 |
| --- | --- |
| `cms-editor-core` | 문서 JSON, 스키마, 검증, HTML 출력, 확장 타입. 서버 사용 가능 |
| `cms-editor-core/browser` | DOM 에디터, 슬래시 메뉴, 핸들, 편집 명령 |
| `cms-editor-react` | `CMSEditor`, `CMSRenderer`, React 블록 컴포넌트 연결 |
| `cms-editor-form` | 폼 스키마, 질문/템플릿 생성, 응답 검증. 서버 사용 가능 |
| `cms-editor-form/browser` | 기본 폼 편집 UI가 연결된 `FormKit`, DOM 응답 화면 `mountForm` |
| `cms-editor-form/react` | 기본 UI가 연결된 `FormKit`, `CMSForm`, UI 없는 `useCMSForm` |

기본 `createSchema()`와 `CMSEditor`에는 질문과 제출 버튼이 없습니다. 필요한 플러그인만 등록하세요. `npm install cms-editor-core cms-editor-react cms-editor-form`으로 설치합니다. 폼을 쓰지 않으면 마지막 패키지는 생략하세요. 로컬 tarball 설치도 지원합니다.

## 1. 제공되는 폼을 그대로 사용하기

```tsx
'use client';
import { useState } from 'react';
import { CMSEditor } from 'cms-editor-react';
import { FormKit, CMSForm } from 'cms-editor-form/react';
import { formTemplate } from 'cms-editor-form';
import 'cms-editor-core/style.css';
import 'cms-editor-form/style.css';

const extensions = [FormKit];

export function FormBuilder() {
  const [document, setDocument] = useState(formTemplate);
  return <>
    <CMSEditor document={document} extensions={extensions} onChange={setDocument} />
    <CMSForm document={document} onSubmit={async (submission, signal) => {
      const response = await fetch('/api/responses', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      if (!response.ok) throw new Error('저장하지 못했습니다.');
    }} />
  </>;
}
```

`CMSForm`과 `mountForm`은 기본으로 FormKit을 사용합니다. 다른 확장을 함께 쓰는 문서에서는 `extensions={[FormKit, OtherBlock]}`를 **폼에도** 전달하세요. 명시한 `extensions`가 전체 등록 목록입니다.

React가 없으면 `createEditor(element, { document, extensions: [FormKit] })`를 사용하고 FormKit을 `cms-editor-form/browser`에서 가져옵니다. 기본 UI 중 일부만 필요하면 같은 엔트리의 `FormField`, `SubmitButton`을 개별 등록할 수 있습니다.

## 2. 사용처의 새로운 블록 정의

다음 파일은 React나 브라우저 DOM을 실행하지 않는 공용 모듈로 둡니다.

```ts
// notice-card.ts
import type { BlockExtension } from 'cms-editor-core';

export const NoticeCard: BlockExtension = {
  name: 'notice_card',
  label: '안내 카드',
  menu: [{ label: '안내 카드', icon: 'i' }],
  spec: {
    atom: true,
    draggable: true,
    attrs: { title: { default: '참여 안내' } },
    parseDOM: [{
      tag: 'aside[data-notice-card]',
      getAttrs: element => ({ title: element.textContent || '참여 안내' }),
    }],
    toDOM: node => ['aside', { 'data-notice-card': '' }, node.attrs.title],
  },
  validate(attrs) {
    if (typeof attrs.title !== 'string' || !attrs.title.trim()) {
      throw new Error('안내 제목을 입력하세요.');
    }
  },
  renderHTML(node, { escapeHTML }) {
    return `<aside class="notice-card">${escapeHTML(node.attrs?.title)}</aside>`;
  },
};
```

- `name`: 저장 문서에서 사용하는 고유 타입 이름. 저장 후 이름을 바꾸려면 데이터 변환이 필요합니다.
- `spec`: ProseMirror NodeSpec. 코어가 블록 그룹과 `id`를 부여합니다.
- `validate`: 저장 문서 파싱 및 React 컴포넌트의 속성 수정 시 검사합니다.
- `menu`: 슬래시/전체 추가 메뉴. 여러 초기 속성 조합을 제공할 수 있고 `false`이면 메뉴에서 숨깁니다.
- `renderHTML`: 조회·SSR·폼 출력용입니다. 생략하면 `spec.toDOM`으로 출력합니다.
- `uniqueAttributes`: `['responseId']`처럼 별도 식별자가 필요할 때 선언합니다. 스키마에 해당 속성을 정의해야 합니다. 생성·복제 시 새 ID를 부여하고, 이동·편집에서는 유지합니다.
- `nodeView`: React 없이 직접 NodeView를 연결하는 고급 옵션입니다.
- `inspectorHint`: 선택 설정 영역에서 보여줄 사용 안내입니다.

여러 블록은 `{ name: 'my-kit', extensions: [NoticeCard, OtherBlock] }`로 묶을 수 있습니다. 같은 타입을 중복 등록하거나 기본 타입을 덮어쓰면 오류가 발생합니다.

## 3. React 컴포넌트로 편집 화면 만들기

```tsx
import { useEffect, useState } from 'react';
import { CMSEditor, type BlockViewProps } from 'cms-editor-react';
import { NoticeCard } from './notice-card';

function NoticeEditor({ attrs, selected, updateAttributes }: BlockViewProps) {
  const [title, setTitle] = useState(String(attrs.title));
  useEffect(() => setTitle(String(attrs.title)), [attrs.title]);

  return <section className={selected ? 'notice selected' : 'notice'}>
    <input
      aria-label="안내 제목"
      value={title}
      onChange={event => {
        setTitle(event.target.value);
        updateAttributes({ title: event.target.value });
      }}
      onBlur={() => {
        if (!title.trim()) setTitle(String(attrs.title));
      }}
    />
  </section>;
}

const extensions = [NoticeCard];
const components = { notice_card: NoticeEditor };
// <CMSEditor document={document} onChange={setDocument}
//   extensions={extensions} components={components} onError={showError} />
```

`updateAttributes`는 성공 여부를 반환합니다. 유효하지 않은 변경은 저장 문서를 바꾸지 않고 `onError`로 전달합니다. 입력 중 잠깐 빈 값이 필요한 컴포넌트는 예제처럼 임시 입력 상태를 유지하세요. HTML을 저장하지 말고 속성을 갱신합니다. `id`와 `uniqueAttributes`는 컴포넌트에서 변경할 수 없습니다.

컴포넌트는 React portal로 마운트되어 사용하는 앱의 Context/테마 Provider를 상속합니다. 노드가 삭제되면 컴포넌트도 해제됩니다. `selected`는 노드 선택 상태이며, 입력 내 Cmd/Ctrl+Z와 다시 실행은 에디터 기록을 사용합니다.

현재 `components` 연결은 **자식 콘텐츠가 없는 atom 블록**을 지원합니다. 중첩 리치 텍스트를 편집할 블록은 `spec.content`와 기본 `toDOM`의 `0` 콘텐츠 홀을 사용하거나 `nodeViews`로 ProseMirror의 `contentDOM`을 구현하세요. React 컴포넌트 안에 임의의 `contentEditable`을 만들어 에디터 DOM과 섞지 마세요.

## 4. 제공되는 질문 UI만 교체하기

```tsx
const extensions = [FormKit];
const components = { field: MyQuestionEditor, submit: MySubmitEditor };

<CMSEditor document={document} onChange={setDocument}
  extensions={extensions} components={components} />
```

`MyQuestionEditor`도 `BlockViewProps`를 받습니다. `attrs`에는 `kind`, `label`, `help`, `required`, `placeholder`, `options`, `min`, `max`가 있습니다. 화면은 사용처가 만들고 검증과 저장 형식은 FormKit을 재사용합니다. `kind`에 따라 사용처의 Input/Select/Radio 컴포넌트를 고르면 됩니다.

이 변경은 **편집 화면**에만 적용됩니다. 실제 응답 화면은 다음 단계처럼 별도로 구성합니다. 읽기용 HTML을 바꾸려면 순수 `FormField` 정의를 복사하여 `renderHTML`을 교체하고, 기본 FormKit과 중복 등록하지 않는 별도 kit를 만드세요.

## 5. 응답용 Form 전체를 직접 만들기

```tsx
import { useCMSForm } from 'cms-editor-form/react';
import { collectFields } from 'cms-editor-form';
```

아래 예제는 짧은 답변 질문만 있는 문서용입니다. 다른 종류는 `kind`에 맞는 컨트롤을 렌더링하세요.

```tsx
import type { CMSDocument } from 'cms-editor-core';
import type { Submission } from 'cms-editor-form';

function MyForm({ document, save }: {
  document: CMSDocument;
  save: (value: Submission, signal: AbortSignal) => Promise<void>;
}) {
  const form = useCMSForm({ document, onSubmit: save });
  return <form onSubmit={form.submit}>
    {collectFields(form.document).map(field => {
      const key = String(field.attrs!.fieldId);
      return <label key={key}>
        {String(field.attrs!.label)}
        <input value={String(form.answers[key] || '')}
          disabled={form.status === 'pending' || form.status === 'success'}
          onChange={event => form.setAnswer(key, event.target.value)}
          aria-invalid={!!form.errors[key]} />
        <span role="alert">{form.errors[key]}</span>
      </label>;
    })}
    <button disabled={form.status === 'pending' || form.status === 'success'}>
      보내기
    </button>
    <p role="status">{form.status === 'success' ? '제출 완료' : form.error}</p>
  </form>;
}
```

`useCMSForm`은 답변·검증 오류·제출 상태·중복 제출 방지·요청 취소를 제공합니다. UI, 접근성 라벨, 서버 전송은 사용처가 책임집니다. `initialAnswers`로 초기 답변을 넣을 수 있습니다. 동일 내용의 document 객체를 다시 전달해도 답변을 유지하며, 문서 내용이 실제로 바뀌면 초기화하고 진행 중 요청을 취소합니다. `initialAnswers`는 초기/문서 교체 시 값이며 매 렌더마다 답변을 덮어쓰지 않습니다.

완전히 다른 질문 모델을 만들 경우 자신의 확장을 등록하고 자신의 응답 수집·검증 함수를 구현하세요. FormKit의 응답 도우미는 FormKit `field` 노드를 대상으로 합니다.

## 서버와 브라우저에 같은 정의 등록하기

```ts
import { parseDocument, renderHTML } from 'cms-editor-core';
import { FormKit, validateAnswers, createSubmission } from 'cms-editor-form';
import { NoticeCard } from './notice-card';

const extensions = [FormKit, NoticeCard];
const document = parseDocument(savedJSON, extensions);
const html = renderHTML(document, { extensions });
// 승인된 서버 문서로 validateAnswers(document, answers)를 호출합니다.
// 검증 통과 후 createSubmission(document, answers)로 응답을 정리합니다.
```

폼/확장이 포함된 문서를 등록 없이 열면 데이터를 제거하지 않고 오류를 냅니다. 편집용 React 컴포넌트는 저장 JSON에 포함되지 않습니다. 확장 함수는 신뢰된 애플리케이션 코드이며, 외부 JSON으로 실행 코드를 받지 않습니다. `renderHTML`에서 사용자 문자열은 반드시 `escapeHTML`로 처리하고 URL은 코어의 `safeURL`로 검증하세요.

## 실행 가능한 예제와 이전 코드 변경

- `/`: 제공되는 FormKit 편집 UI와 CMSForm을 사용하는 스튜디오
- `/examples/custom-blocks`: 사용처의 새 안내 블록, 교체한 질문 컴포넌트, 직접 만든 응답 폼
- `apps/vanilla`: React 없는 FormKit 등록과 커스텀 블록

기존 문서 JSON의 `field`/`submit` 형식은 유지합니다. 이전 코드의 `formTemplate`, `fieldBlock`, `collectFields`, `validateAnswers`, `createSubmission`, `Answers`, `Submission`은 코어 대신 `cms-editor-form`에서 가져오세요. `CMSForm`은 `cms-editor-form/react`, `mountForm`은 `cms-editor-form/browser`로 이동했습니다. 에디터·문서 파싱·렌더링에 FormKit을 등록하고 폼 CSS를 별도로 가져오면 됩니다.
