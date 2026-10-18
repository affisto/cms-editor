import { Schema, type NodeSpec, type MarkSpec } from "prosemirror-model";
import type { NodeViewConstructor } from "prosemirror-view";
import type { JSONNode } from "./document";

export interface BlockRenderContext {
  idPrefix: string;
  interactive: boolean;
  renderChildren: () => string;
  escapeHTML: (value: unknown) => string;
}
export interface BlockMenuItem {
  suggested?: boolean;
  label: string;
  icon?: string;
  group?: "문서" | "질문";
  attrs?: Record<string, unknown>;
}
export interface BlockExtension {
  name: string;
  label: string;
  spec: NodeSpec;
  validate?: (attrs: Record<string, unknown>) => void;
  menu?: false | BlockMenuItem[];
  nodeView?: NodeViewConstructor;
  renderHTML?: (node: JSONNode, context: BlockRenderContext) => string;
  uniqueAttributes?: string[];
  inspectorHint?: string;
}
export interface ExtensionKit {
  name: string;
  extensions: Extension[];
}
export type Extension = BlockExtension | ExtensionKit;
export function resolveExtensions(
  extensions: Extension[] = [],
): BlockExtension[] {
  const result: BlockExtension[] = [];
  const visiting = new Set<Extension>();
  const visit = (extension: Extension) => {
    if (visiting.has(extension))
      throw new Error(`순환 확장 등록: ${extension.name}`);
    visiting.add(extension);
    if ("extensions" in extension) extension.extensions.forEach(visit);
    else result.push(extension);
    visiting.delete(extension);
  };
  extensions.forEach(visit);
  const names = new Set<string>();
  for (const extension of result) {
    if (names.has(extension.name))
      throw new Error(`중복 확장 등록: ${extension.name}`);
    names.add(extension.name);
  }
  return result;
}
export function safeURL(value: unknown, image = false): string {
  if (
    typeof value !== "string" ||
    Array.from(value).some(
      (c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127,
    )
  )
    return "";
  if (
    image &&
    /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
  )
    return value;
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).href;
    } catch {
      return "";
    }
  }
  if (!image && /^mailto:[^<>"\s]+$/i.test(value)) return value;
  if (/^\/(?!\/)/.test(value) || (!image && /^#[\w-]+$/.test(value)))
    return value;
  return "";
}
const identity = { id: { default: null } };
export function createSchema(extensions: Extension[] = []): Schema {
  const nodes: Record<string, NodeSpec> = {
    doc: { content: "block+" },
    paragraph: {
      attrs: identity,
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    heading: {
      attrs: { ...identity, level: { default: 2 } },
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [1, 2, 3].map((level) => ({
        tag: `h${level}`,
        attrs: { level },
      })),
      toDOM: (node) => [`h${node.attrs.level}`, 0],
    },
    blockquote: {
      attrs: identity,
      content: "block+",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "blockquote" }],
      toDOM: () => ["blockquote", 0],
    },
    bullet_list: {
      attrs: identity,
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ul:not([data-checklist])" }],
      toDOM: () => ["ul", 0],
    },
    ordered_list: {
      attrs: { ...identity, order: { default: 1 } },
      content: "list_item+",
      group: "block",
      parseDOM: [
        {
          tag: "ol",
          getAttrs: (dom) => ({
            order: Number(dom.getAttribute("start")) || 1,
          }),
        },
      ],
      toDOM: (n) => ["ol", { start: n.attrs.order }, 0],
    },
    list_item: {
      attrs: identity,
      content: "paragraph block*",
      defining: true,
      parseDOM: [{ tag: "li:not([data-check-item])" }],
      toDOM: () => ["li", 0],
    },
    checklist: {
      attrs: identity,
      content: "check_item+",
      group: "block",
      parseDOM: [{ tag: "ul[data-checklist]" }],
      toDOM: () => ["ul", { "data-checklist": "" }, 0],
    },
    check_item: {
      attrs: { ...identity, checked: { default: false } },
      content: "paragraph block*",
      defining: true,
      parseDOM: [
        {
          tag: "li[data-check-item]",
          getAttrs: (dom) => ({
            checked: dom.getAttribute("data-checked") === "true",
          }),
        },
      ],
      toDOM: (n) => [
        "li",
        { "data-check-item": "", "data-checked": String(n.attrs.checked) },
        0,
      ],
    },
    code_block: {
      attrs: identity,
      content: "text*",
      marks: "",
      group: "block",
      code: true,
      defining: true,
      parseDOM: [{ tag: "pre", preserveWhitespace: "full" }],
      toDOM: () => ["pre", ["code", 0]],
    },
    divider: {
      attrs: identity,
      group: "block",
      atom: true,
      draggable: true,
      parseDOM: [{ tag: "hr" }],
      toDOM: () => ["hr"],
    },
    image: {
      attrs: {
        ...identity,
        src: { default: "" },
        alt: { default: "" },
        caption: { default: "" },
        width: { default: 100 },
      },
      group: "block",
      atom: true,
      draggable: true,
      parseDOM: [
        {
          tag: "figure[data-cms-image]",
          getAttrs: (dom) => {
            const img = dom.querySelector("img"),
              src = safeURL(img?.getAttribute("src"), true);
            if (!src) return false;
            return {
              src,
              alt: img?.getAttribute("alt") || "",
              caption: dom.querySelector("figcaption")?.textContent || "",
              width: Math.max(
                20,
                Math.min(100, Number(dom.getAttribute("data-width")) || 100),
              ),
            };
          },
        },
        {
          tag: "img[src]",
          getAttrs: (dom) => {
            const src = safeURL(dom.getAttribute("src"), true);
            return src ? { src, alt: dom.getAttribute("alt") || "" } : false;
          },
        },
      ],
      toDOM: (n) => [
        "figure",
        { "data-cms-image": "", "data-width": n.attrs.width },
        [
          "img",
          {
            src: safeURL(n.attrs.src, true),
            alt: n.attrs.alt,
            style: `width:${Math.max(20, Math.min(100, Number(n.attrs.width) || 100))}%`,
          },
        ],
        ["figcaption", n.attrs.caption],
      ],
    },
    toggle: {
      attrs: { ...identity, title: { default: "자세히 보기" } },
      content: "block+",
      group: "block",
      defining: true,
      parseDOM: [
        {
          tag: "details",
          contentElement: "div",
          getAttrs: (dom) => ({
            title: dom.querySelector("summary")?.textContent || "자세히 보기",
          }),
        },
      ],
      toDOM: (n) => ["details", ["summary", n.attrs.title], ["div", 0]],
    },
    text: { group: "inline" },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM: () => ["br"],
    },
  };
  for (const ext of resolveExtensions(extensions)) {
    if (!/^[a-z][a-z0-9_]*$/.test(ext.name) || nodes[ext.name])
      throw new Error(`블록 이름을 등록할 수 없습니다: ${ext.name}`);
    nodes[ext.name] = {
      ...ext.spec,
      group: "block",
      attrs: { ...ext.spec.attrs, ...identity },
      uniqueAttributes: ext.uniqueAttributes || [],
    };
  }
  const marks: Record<string, MarkSpec> = {
    strong: {
      parseDOM: [
        { tag: "strong" },
        { tag: "b" },
        { style: "font-weight=bold" },
      ],
      toDOM: () => ["strong", 0],
    },
    em: { parseDOM: [{ tag: "em" }, { tag: "i" }], toDOM: () => ["em", 0] },
    strike: { parseDOM: [{ tag: "s" }, { tag: "del" }], toDOM: () => ["s", 0] },
    code: { parseDOM: [{ tag: "code" }], toDOM: () => ["code", 0] },
    link: {
      attrs: { href: {} },
      inclusive: false,
      parseDOM: [
        {
          tag: "a[href]",
          getAttrs: (dom) => {
            const href = safeURL(dom.getAttribute("href"));
            return href ? { href } : false;
          },
        },
      ],
      toDOM: (mark) => [
        "a",
        { href: safeURL(mark.attrs.href), rel: "noopener noreferrer" },
        0,
      ],
    },
  };
  return new Schema({ nodes, marks });
}
