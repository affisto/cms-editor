import type { BlockExtension, ExtensionKit } from "cms-editor-core";
import { formNodes, validateFieldAttributes } from "./schema";
import { renderFormBlock } from "./render";
export const FormField: BlockExtension = {
  name: "field",
  label: "질문",
  spec: formNodes.field,
  uniqueAttributes: ["fieldId"],
  validate: validateFieldAttributes,
  inspectorHint:
    "질문 제목, 도움말, 선택지와 필수 여부는 블록에서 바로 수정하세요.",
  menu: [
    {
      label: "짧은 답변",
      suggested: true,
      icon: "Aa",
      group: "질문",
      attrs: { kind: "text" },
    },
    { label: "긴 답변", icon: "≡", group: "질문", attrs: { kind: "textarea" } },
    {
      label: "이메일",
      suggested: true,
      icon: "@",
      group: "질문",
      attrs: { kind: "email" },
    },
    { label: "숫자", icon: "#", group: "질문", attrs: { kind: "number" } },
    { label: "하나 선택", icon: "◉", group: "질문", attrs: { kind: "radio" } },
    {
      label: "여러 개 선택",
      icon: "☑",
      group: "질문",
      attrs: { kind: "checkbox" },
    },
    { label: "드롭다운", icon: "⌄", group: "질문", attrs: { kind: "select" } },
  ],
  renderHTML: renderFormBlock,
};
export const SubmitButton: BlockExtension = {
  name: "submit",
  label: "제출 버튼",
  spec: formNodes.submit,
  inspectorHint: "버튼 문구와 정렬은 블록에서 바로 수정하세요.",
  menu: [{ label: "제출 버튼", icon: "↗", group: "질문" }],
  validate(attrs) {
    if (typeof attrs.label !== "string" || !attrs.label.trim())
      throw new Error("제출 버튼 이름이 필요합니다.");
    if (
      typeof attrs.align !== "string" ||
      !["left", "center", "right"].includes(attrs.align)
    )
      throw new Error("버튼 정렬이 올바르지 않습니다.");
  },
  renderHTML: renderFormBlock,
};
/** Pure schema/validation/render definitions, safe to use on the server. */
export const FormKit: ExtensionKit = {
  name: "form",
  extensions: [FormField, SubmitButton],
};
