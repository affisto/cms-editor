import {
  createSchema,
  safeURL,
  resolveExtensions,
  type Extension,
} from "./schema";
import { parseDocument, type CMSDocument, type JSONNode } from "./document";
import type { DOMOutputSpec } from "prosemirror-model";
export const escapeHTML = (value: unknown): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export interface RenderOptions {
  extensions?: Extension[];
  idPrefix?: string;
  interactive?: boolean;
  showTitle?: boolean;
}
export function renderHTML(
  input: CMSDocument,
  options: RenderOptions = {},
): string {
  const doc = parseDocument(input, options.extensions),
    schema = createSchema(options.extensions),
    prefix = options.idPrefix || doc.id,
    extensions = new Map(
      resolveExtensions(options.extensions).map((extension) => [
        extension.name,
        extension,
      ]),
    );
  const escape = escapeHTML;
  const render = (n: JSONNode): string => {
    const a = n.attrs || {},
      children = () => n.content?.map(render).join("") || "";
    const extension = extensions.get(n.type);
    if (extension?.renderHTML)
      return extension.renderHTML(n, {
        idPrefix: prefix,
        interactive: !!options.interactive,
        renderChildren: children,
        escapeHTML,
      });
    if (n.type === "text")
      return (n.marks || []).reduce(
        (html, m) =>
          m.type === "link"
            ? `<a href="${escape(safeURL(m.attrs?.href))}" rel="noopener noreferrer">${html}</a>`
            : `<${({ strong: "strong", em: "em", strike: "s", code: "code" } as Record<string, string>)[m.type]}>${html}</${({ strong: "strong", em: "em", strike: "s", code: "code" } as Record<string, string>)[m.type]}>`,
        escape(n.text),
      );
    switch (n.type) {
      case "doc":
        return children();
      case "paragraph":
        return `<p>${children() || "<br>"}</p>`;
      case "heading":
        return `<h${a.level}>${children()}</h${a.level}>`;
      case "blockquote":
        return `<blockquote>${children()}</blockquote>`;
      case "bullet_list":
        return `<ul>${children()}</ul>`;
      case "ordered_list":
        return `<ol start="${a.order}">${children()}</ol>`;
      case "list_item":
        return `<li>${children()}</li>`;
      case "checklist":
        return `<ul class="cms-checklist">${children()}</ul>`;
      case "check_item":
        return `<li class="cms-check-item"><input type="checkbox" disabled aria-label="체크리스트" ${a.checked ? "checked" : ""}><div>${children()}</div></li>`;
      case "code_block":
        return `<pre><code>${children()}</code></pre>`;
      case "hard_break":
        return "<br>";
      case "divider":
        return "<hr>";
      case "toggle":
        return `<details><summary>${escape(a.title)}</summary><div>${children()}</div></details>`;
      case "image":
        return a.src
          ? `<figure><img src="${escape(safeURL(a.src, true))}" alt="${escape(a.alt)}" style="width:${a.width}%" loading="lazy"><figcaption>${escape(a.caption)}</figcaption></figure>`
          : '<div class="cms-empty-image">이미지가 없습니다</div>';
      default: {
        const node = schema.nodeFromJSON(n),
          spec = node.type.spec.toDOM?.(node);
        if (!spec) throw new Error(`블록 렌더러가 필요합니다: ${n.type}`);
        const serialize = (s: DOMOutputSpec | number): string => {
          if (s === 0) return children();
          if (typeof s === "string") return escape(s);
          if (!Array.isArray(s))
            throw new Error("커스텀 블록 toDOM은 배열 형식을 반환해야 합니다.");
          const [tag, ...rest] = s;
          if (
            typeof tag !== "string" ||
            !/^[a-z][a-z0-9-]*$/.test(tag) ||
            ["script", "iframe", "object", "embed", "style"].includes(tag)
          )
            throw new Error("허용하지 않는 HTML 태그입니다.");
          const attributes =
            rest[0] && typeof rest[0] === "object" && !Array.isArray(rest[0])
              ? (rest.shift() as Record<string, unknown>)
              : {};
          const attr = Object.entries(attributes)
            .filter(([k]) => !/^on/i.test(k) && k !== "srcdoc")
            .map(
              ([k, v]) =>
                ` ${escape(k)}="${escape(["href", "src"].includes(k) ? safeURL(v, k === "src") : v)}"`,
            )
            .join("");
          return `<${tag}${attr}>${rest.map((x) => serialize(x as DOMOutputSpec)).join("")}</${tag}>`;
        };
        return serialize(spec);
      }
    }
  };
  return `<article class="cms-content">${options.showTitle ? `<h1>${escape(doc.title)}</h1>` : ""}${render(doc.content)}</article>`;
}
