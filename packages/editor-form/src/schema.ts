import type { NodeSpec } from "prosemirror-model";
export type FieldKind =
  | "text"
  | "textarea"
  | "email"
  | "number"
  | "radio"
  | "checkbox"
  | "select";
export const fieldKinds: FieldKind[] = [
  "text",
  "textarea",
  "email",
  "number",
  "radio",
  "checkbox",
  "select",
];
export function validateFieldAttributes(a: Record<string, unknown>): void {
  function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
  }
  assert(
    fieldKinds.includes(a.kind as never),
    "지원하지 않는 질문 종류입니다.",
  );
  for (const key of ["label", "help", "placeholder"])
    assert(
      typeof a[key] === "string" && String(a[key]).length <= 5000,
      "질문 문구가 올바르지 않습니다.",
    );
  assert(String(a.label).trim().length > 0, "질문 제목을 입력하세요.");
  assert(typeof a.required === "boolean", "필수 여부가 올바르지 않습니다.");
  assert(
    Array.isArray(a.options) &&
      a.options.length <= 100 &&
      a.options.every(
        (x) => typeof x === "string" && x.length > 0 && x.length <= 1000,
      ) &&
      new Set(a.options).size === a.options.length,
    "선택지는 비어 있거나 중복될 수 없습니다.",
  );
  if (["radio", "checkbox", "select"].includes(String(a.kind)))
    assert(a.options.length > 0, "선택지를 하나 이상 입력하세요.");
  for (const key of ["min", "max"])
    assert(
      a[key] === null ||
        (typeof a[key] === "number" && Number.isFinite(a[key])),
      "숫자 범위가 올바르지 않습니다.",
    );
  assert(
    a.min === null || a.max === null || Number(a.min) <= Number(a.max),
    "최솟값은 최댓값보다 클 수 없습니다.",
  );
}
function clipboardField(dom: HTMLElement): Record<string, unknown> | false {
  try {
    const raw = dom.getAttribute("data-cms-attrs") || "";
    if (raw.length > 120000) return false;
    const a: unknown = JSON.parse(raw);
    if (!a || typeof a !== "object" || Array.isArray(a)) return false;
    validateFieldAttributes(a as Record<string, unknown>);
    return { ...a, id: null, fieldId: null };
  } catch {
    return false;
  }
}

const identity = { id: { default: null } };
export const formNodes: Record<string, NodeSpec> = {
  field: {
    attrs: {
      ...identity,
      fieldId: { default: null },
      kind: { default: "text" },
      label: { default: "새 질문" },
      help: { default: "" },
      required: { default: false },
      placeholder: { default: "" },
      options: { default: ["첫 번째 선택지", "두 번째 선택지"] },
      min: { default: null },
      max: { default: null },
    },
    group: "block",
    atom: true,
    draggable: true,
    parseDOM: [
      {
        tag: "div[data-cms-field][data-cms-attrs]",
        getAttrs: clipboardField,
      },
    ],
    toDOM: (n) => [
      "div",
      {
        "data-cms-field": n.attrs.fieldId,
        "data-cms-attrs": JSON.stringify(n.attrs),
      },
      n.attrs.label,
    ],
  },
  submit: {
    attrs: {
      ...identity,
      label: { default: "제출하기" },
      align: { default: "left" },
    },
    group: "block",
    atom: true,
    draggable: true,
    parseDOM: [
      {
        tag: "div[data-cms-submit]",
        getAttrs: (dom) => ({
          label: dom.textContent || "제출하기",
          align: ["left", "center", "right"].includes(
            dom.getAttribute("data-align") || "",
          )
            ? dom.getAttribute("data-align")
            : "left",
        }),
      },
    ],
    toDOM: (n) => [
      "div",
      { "data-cms-submit": "", "data-align": n.attrs.align },
      n.attrs.label,
    ],
  },
};
