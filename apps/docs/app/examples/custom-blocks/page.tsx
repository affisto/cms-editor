"use client";
import * as React from "react";
import { CMSEditor, CMSRenderer, type BlockViewProps } from "cms-editor-react";
import {
  createDocument,
  newId,
  type BlockExtension,
  type CMSDocument,
} from "cms-editor-core";
import { FormKit, useCMSForm } from "cms-editor-form/react";
import { fieldBlock, collectFields } from "cms-editor-form";

// This definition is application-owned. In production keep it in a shared,
// DOM-free module so parsing/validation and rendering use it on the server too.
const NoticeCard: BlockExtension = {
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
  renderHTML: (node, { escapeHTML }) =>
    `<aside class="consumer-notice"><strong>${escapeHTML(node.attrs?.title)}</strong><p>${escapeHTML(node.attrs?.message)}</p></aside>`,
};
const extensions = [FormKit, NoticeCard];
const Brand = React.createContext("서비스");
const cardStyle: React.CSSProperties = {
  border: "1px solid #dbe1ea",
  borderRadius: 12,
  padding: 20,
  margin: "12px 0",
  background: "#f8fafc",
};
function NoticeEditor({ attrs, updateAttributes }: BlockViewProps) {
  const brand = React.useContext(Brand);
  const [title, setTitle] = React.useState(String(attrs.title));
  React.useEffect(() => setTitle(String(attrs.title)), [attrs.title]);
  return (
    <aside style={cardStyle}>
      <small>{brand}의 커스텀 블록</small>
      <input
        aria-label="안내 카드 제목"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          updateAttributes({ title: e.target.value });
        }}
        onBlur={() => {
          if (!title.trim()) setTitle(String(attrs.title));
        }}
      />
      <textarea
        aria-label="안내 카드 내용"
        value={String(attrs.message)}
        onChange={(e) => updateAttributes({ message: e.target.value })}
      />
    </aside>
  );
}
// Reuses the form schema/validation while replacing the editor component.
function QuestionEditor({ attrs, updateAttributes }: BlockViewProps) {
  const brand = React.useContext(Brand);
  const [label, setLabel] = React.useState(String(attrs.label));
  React.useEffect(() => setLabel(String(attrs.label)), [attrs.label]);
  return (
    <section style={cardStyle}>
      <small>{brand}의 질문 컴포넌트</small>
      <input
        aria-label="커스텀 질문 제목"
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          updateAttributes({ label: e.target.value });
        }}
        onBlur={() => {
          if (!label.trim()) setLabel(String(attrs.label));
        }}
      />
      <label>
        <input
          type="checkbox"
          checked={!!attrs.required}
          onChange={(e) => updateAttributes({ required: e.target.checked })}
        />{" "}
        필수 응답
      </label>
    </section>
  );
}
const components = { notice_card: NoticeEditor, field: QuestionEditor };

// The application owns the form, inputs, messages and submit button completely.
function MyForm({ document }: { document: CMSDocument }) {
  const form = useCMSForm({ document, extensions, onSubmit: async () => {} });
  const notices = document.content.content!.filter(
    (node) => node.type === "notice_card",
  );
  return (
    <form noValidate aria-label="사용처가 만든 폼" onSubmit={form.submit}>
      {notices.length > 0 && (
        <CMSRenderer
          document={{ ...document, content: { type: "doc", content: notices } }}
          extensions={[NoticeCard]}
        />
      )}
      {collectFields(form.document).map((field) => {
        const a = field.attrs!,
          key = String(a.fieldId),
          id = `answer-${key}`;
        return (
          <div key={key} style={cardStyle}>
            <label htmlFor={id}>{String(a.label)}</label>
            <input
              id={id}
              type={a.kind === "email" ? "email" : "text"}
              value={String(form.answers[key] || "")}
              onChange={(e) => form.setAnswer(key, e.target.value)}
              aria-required={!!a.required}
              aria-invalid={!!form.errors[key]}
              aria-describedby={`${id}-error`}
              disabled={form.status === "pending" || form.status === "success"}
            />
            <p id={`${id}-error`} role="alert">
              {form.errors[key]}
            </p>
          </div>
        );
      })}
      <button
        type="submit"
        disabled={form.status === "pending" || form.status === "success"}
      >
        내 디자인으로 제출
      </button>
      <p role="status">
        {form.status === "success" ? "커스텀 폼 제출 완료" : form.error}
      </p>
    </form>
  );
}
export default function CustomBlocksExample() {
  const [doc, setDoc] = React.useState<CMSDocument | null>(null);
  const [preview, setPreview] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    setDoc(
      createDocument("사용처 커스텀 컴포넌트", [
        {
          type: "notice_card",
          attrs: {
            id: newId(),
            title: "참여 안내",
            message: "이 카드와 질문 화면은 사용처의 React 컴포넌트입니다.",
          },
        },
        fieldBlock("text", "이름", { required: true }),
        fieldBlock("email", "이메일"),
      ]),
    );
  }, []);
  return (
    <Brand.Provider value="우리 서비스">
      <main
        className="consumer-example"
        style={{ maxWidth: 840, margin: "40px auto", padding: 24 }}
      >
        <a href="/">← 기본 폼 플러그인 데모</a>
        <style>{`.consumer-example input:not([type=checkbox]),.consumer-example textarea{display:block;width:100%;padding:10px;margin:10px 0;border:1px solid #ccd5e0;border-radius:6px;background:white}.consumer-example > button,.consumer-example form > button{border:1px solid #ccd5e0;border-radius:6px;padding:8px 14px;background:white}.consumer-example h1{font-size:26px;font-weight:700;margin:24px 0}.consumer-example small{color:#657187}.consumer-example [role=alert]{color:#b32638}`}</style>
        <h1>사용처에서 만든 블록과 폼</h1>
        <p>
          안내 카드는 새 확장입니다. 질문은 FormKit의 편집 컴포넌트를
          교체했습니다. 응답 화면도 직접 만든 컴포넌트입니다.
        </p>
        <button type="button" onClick={() => setPreview(!preview)}>
          {preview ? "편집으로" : "내 폼 미리보기"}
        </button>
        <p role="alert">{error}</p>
        {doc &&
          (preview ? (
            <MyForm document={doc} />
          ) : (
            <CMSEditor
              document={doc}
              extensions={extensions}
              components={components}
              onChange={setDoc}
              onError={(e) => setError(e.message)}
            />
          ))}
      </main>
    </Brand.Provider>
  );
}
