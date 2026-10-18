import type { Node as PMNode, Schema } from "prosemirror-model";
import {
  createSchema,
  resolveExtensions,
  safeURL,
  type Extension,
} from "./schema";
export interface JSONNode {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: JSONNode[];
}
export interface CMSDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  content: JSONNode;
}
export function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  );
}
export function textBlock(
  text = "",
  type = "paragraph",
  attrs?: Record<string, unknown>,
): JSONNode {
  return {
    type,
    attrs: { id: newId(), ...attrs },
    ...(text ? { content: [{ type: "text", text }] } : {}),
  };
}
export function createDocument(
  title = "제목 없는 문서",
  content: JSONNode[] = [textBlock()],
): CMSDocument {
  return {
    schemaVersion: 1,
    id: newId(),
    title,
    content: { type: "doc", content },
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function parseDocument(
  input: unknown,
  extensions: Extension[] = [],
): CMSDocument {
  const value: unknown =
    typeof input === "string" ? JSON.parse(input) : structuredClone(input);
  assert(object(value), "문서 객체가 필요합니다.");
  assert(
    value.schemaVersion === 1,
    "지원하지 않는 문서 버전입니다. 원본 파일은 변경되지 않았습니다.",
  );
  assert(
    typeof value.id === "string" &&
      value.id.length > 0 &&
      value.id.length <= 200,
    "문서 ID가 올바르지 않습니다.",
  );
  assert(
    typeof value.title === "string" && value.title.length <= 500,
    "제목은 500자 이하로 입력하세요.",
  );
  const resolved = resolveExtensions(extensions),
    schema = createSchema(extensions),
    ids = new Set<string>(),
    fields = new Set<string>();
  let count = 0;
  const walk = (raw: unknown, depth = 0): JSONNode => {
    assert(
      depth < 32 && ++count <= 20000,
      "문서가 너무 크거나 중첩이 깊습니다.",
    );
    assert(
      object(raw) && typeof raw.type === "string",
      "블록 형식이 올바르지 않습니다.",
    );
    assert(
      schema.nodes[raw.type],
      `지원하지 않는 블록입니다: ${raw.type}. 해당 확장을 등록하세요.`,
    );
    const n: JSONNode = { type: raw.type };
    const spec = schema.nodes[raw.type].spec;
    if (raw.text !== undefined) {
      assert(
        typeof raw.text === "string" && raw.text.length <= 1000000,
        "텍스트가 올바르지 않습니다.",
      );
      n.text = raw.text;
    }
    if (raw.attrs !== undefined)
      assert(object(raw.attrs), "블록 속성이 올바르지 않습니다.");
    const a = { ...((raw.attrs as Record<string, unknown>) || {}) };
    for (const key of Object.keys(a))
      assert(spec.attrs?.[key], `지원하지 않는 속성: ${raw.type}.${key}`);
    for (const [key, def] of Object.entries(spec.attrs || {}))
      if (!(key in a) && "default" in def) a[key] = def.default;
    if (spec.attrs?.id) {
      assert(
        typeof a.id === "string" &&
          a.id.length > 0 &&
          a.id.length <= 200 &&
          !ids.has(a.id),
        "블록 ID가 없거나 중복되었습니다.",
      );
      ids.add(a.id);
    }
    if (raw.type === "heading")
      assert(
        [1, 2, 3].includes(Number(a.level)) && typeof a.level === "number",
        "제목 단계가 올바르지 않습니다.",
      );
    if (raw.type === "ordered_list")
      assert(
        Number.isInteger(a.order) &&
          Number(a.order) > 0 &&
          Number(a.order) < 100000,
        "목록 시작 번호가 올바르지 않습니다.",
      );
    if (raw.type === "check_item")
      assert(typeof a.checked === "boolean", "체크 상태가 올바르지 않습니다.");
    if (raw.type === "image") {
      assert(
        typeof a.src === "string" && (!a.src || safeURL(a.src, true)),
        "이미지 주소가 올바르지 않습니다.",
      );
      assert(
        typeof a.alt === "string" && typeof a.caption === "string",
        "이미지 설명이 올바르지 않습니다.",
      );
      assert(
        typeof a.width === "number" && a.width >= 20 && a.width <= 100,
        "이미지 너비는 20~100 사이여야 합니다.",
      );
    }
    if (raw.type === "toggle")
      assert(typeof a.title === "string", "토글 제목이 올바르지 않습니다.");
    const extension = resolved.find((e) => e.name === raw.type);
    for (const key of extension?.uniqueAttributes || []) {
      const value = a[key];
      const identity = `${raw.type}.${key}:${value}`;
      assert(
        typeof value === "string" &&
          value.length > 0 &&
          value.length <= 200 &&
          !fields.has(identity),
        `${raw.type}.${key} ID가 없거나 중복되었습니다.`,
      );
      fields.add(identity);
    }
    extension?.validate?.(a);
    if (Object.keys(a).length) n.attrs = a;
    if (raw.content !== undefined) {
      assert(Array.isArray(raw.content), "블록 내용이 올바르지 않습니다.");
      n.content = raw.content.map((c) => walk(c, depth + 1));
    }
    if (raw.marks !== undefined) {
      assert(Array.isArray(raw.marks), "서식이 올바르지 않습니다.");
      n.marks = raw.marks.map((m) => {
        assert(
          object(m) && typeof m.type === "string" && schema.marks[m.type],
          "지원하지 않는 텍스트 서식입니다.",
        );
        if (m.type === "link") {
          assert(
            object(m.attrs) && safeURL(m.attrs.href),
            "링크 주소가 올바르지 않습니다.",
          );
          return { type: m.type, attrs: { href: safeURL(m.attrs.href) } };
        }
        return { type: m.type };
      });
    }
    return n;
  };
  const content = walk(value.content);
  assert(content.type === "doc", "최상위 노드는 doc이어야 합니다.");
  schema.nodeFromJSON(content).check();
  return { schemaVersion: 1, id: value.id, title: value.title, content };
}
export function normalizeNodeIds(
  node: PMNode,
  schema: Schema,
  seen = new Set<string>(),
  fieldIds = new Set<string>(),
): PMNode {
  if (node.isText) return node;
  const attrs = { ...node.attrs };
  if ("id" in attrs) {
    if (!attrs.id || seen.has(attrs.id)) attrs.id = newId();
    seen.add(attrs.id);
  }
  for (const key of (node.type.spec.uniqueAttributes || []) as string[]) {
    const identity = `${node.type.name}.${key}:${attrs[key]}`;
    if (!attrs[key] || fieldIds.has(identity)) attrs[key] = newId();
    fieldIds.add(`${node.type.name}.${key}:${attrs[key]}`);
  }
  const children: PMNode[] = [];
  node.forEach((child) =>
    children.push(normalizeNodeIds(child, schema, seen, fieldIds)),
  );
  return node.type.create(attrs, children, node.marks);
}
