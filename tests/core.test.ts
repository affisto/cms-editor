import {
  fieldBlock,
  formTemplate,
  createSubmission,
  validateAnswers,
} from "../packages/editor-form/src/index";
import { FormKit } from "../packages/editor-form/src/index";
import { describe, expect, it } from "vitest";
import {
  createDocument,
  createSchema,
  documentTemplate,
  newId,
  parseDocument as parseCoreDocument,
  renderHTML as renderCoreHTML,
  safeURL,
  textBlock,
  type BlockExtension,
} from "../packages/editor-core/src/index";

describe("document persistence boundary", () => {
  it("detaches parsed data from the input object", () => {
    const source = createDocument("F", [fieldBlock("radio", "Question")]);
    const parsed = parseDocument(source);
    (source.content.content![0].attrs!.options as string[]).push("Mutated");
    expect(parsed.content.content![0].attrs!.options).not.toContain("Mutated");
  });
  it("round-trips document and form templates without changing IDs", () => {
    for (const doc of [formTemplate(), documentTemplate()]) {
      const normalized = parseDocument(doc);
      expect(parseDocument(JSON.stringify(normalized))).toEqual(normalized);
    }
  });
  it("rejects future versions and unknown blocks without mutating the source", () => {
    const doc = createDocument();
    expect(() => parseDocument({ ...doc, schemaVersion: 2 })).toThrow("버전");
    const unknown = {
      ...doc,
      content: { type: "doc", content: [{ type: "made_up" }] },
    };
    const before = JSON.stringify(unknown);
    expect(() => parseDocument(unknown)).toThrow("지원하지 않는 블록");
    expect(JSON.stringify(unknown)).toBe(before);
  });
  it("rejects duplicate block and field identities", () => {
    const field = fieldBlock();
    expect(() => parseDocument(createDocument("test", [field, field]))).toThrow(
      "ID",
    );
    expect(() =>
      parseDocument(
        createDocument("test", [
          field,
          { ...field, attrs: { ...field.attrs, id: newId() } },
        ]),
      ),
    ).toThrow("field.fieldId");
  });
  it("rejects malformed node hierarchy and attributes", () => {
    expect(() =>
      parseDocument(
        createDocument("test", [
          {
            type: "list_item",
            attrs: { id: newId() },
            content: [textBlock("x")],
          },
        ]),
      ),
    ).toThrow();
    expect(() =>
      parseDocument(
        createDocument("test", [
          fieldBlock("radio", "q", { options: ["a", "a"] }),
        ]),
      ),
    ).toThrow("선택지");
    expect(() =>
      parseDocument(
        createDocument("test", [
          fieldBlock("number", "q", { min: 10, max: 2 }),
        ]),
      ),
    ).toThrow("최솟값");
    expect(() =>
      parseDocument(
        createDocument("test", [textBlock("x", "heading", { level: "2" })]),
      ),
    ).toThrow("단계");
  });
  it("supports registered consumer blocks and fails clearly when they are absent", () => {
    const extension: BlockExtension = {
      name: "callout",
      label: "알림",
      spec: {
        content: "inline*",
        attrs: { tone: { default: "info" } },
        toDOM: () => ["aside", { class: "callout" }, 0],
      },
      validate: (a) => {
        if (a.tone !== "info") throw new Error("tone");
      },
    };
    const doc = createDocument("custom", [
      textBlock("Hello", "callout", { tone: "info" }),
    ]);
    expect(() => parseDocument(doc)).toThrow("확장");
    expect(renderHTML(doc, { extensions: [extension] })).toContain(
      '<aside class="callout">Hello</aside>',
    );
    expect(createSchema([extension]).nodes.callout).toBeDefined();
    expect(() => createSchema([{ ...extension, name: "paragraph" }])).toThrow();
  });
});
describe("safe output", () => {
  it("rejects executable and obfuscated URL protocols", () => {
    for (const src of [
      "javascript:alert(1)",
      "java\nscript:alert(1)",
      "//evil.test",
      "data:image/svg+xml;base64,AAAA",
      'https://ok.test/" onerror="x',
    ])
      expect(safeURL(src, true)).toBe("");
    expect(safeURL("https://example.com/p")).toBe("https://example.com/p");
    expect(safeURL("/images/a.png", true)).toBe("/images/a.png");
  });
  it("escapes user content, labels, titles, and image captions", () => {
    const doc = createDocument("<script>bad</script>", [
      textBlock("<img src=x onerror=alert(1)>"),
      fieldBlock("text", "<script>label</script>"),
      {
        type: "image",
        attrs: {
          id: newId(),
          src: "/a.png",
          alt: '" onerror="bad',
          caption: "<script>caption</script>",
          width: 80,
        },
      },
    ]);
    const html = renderHTML(doc, { interactive: true, showTitle: true });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('alt="&quot; onerror=&quot;bad"');
  });
  it("rejects unsafe saved links before rendering", () => {
    const doc = createDocument("unsafe", [
      {
        ...textBlock("x"),
        content: [
          {
            type: "text",
            text: "click",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ]);
    expect(() => renderHTML(doc)).toThrow("링크");
  });
  it("renders long documents and nested content", () => {
    const doc = createDocument(
      "long",
      Array.from({ length: 500 }, (_, i) => textBlock(`Paragraph ${i}`)),
    );
    const html = renderHTML(doc);
    expect(html).toContain("Paragraph 499");
  });
});
describe("form responses", () => {
  const a = fieldBlock("email", "Email", { required: true }),
    b = fieldBlock("number", "Age", { min: 1, max: 10 }),
    c = fieldBlock("checkbox", "Topics", {
      required: true,
      options: ["a", "b"],
    }),
    d = fieldBlock("select", "One", { options: ["yes", "no"] });
  const doc = parseDocument(createDocument("test", [a, b, c, d]));
  const [email, number, multi, select] = [a, b, c, d].map((n) =>
    String(n.attrs!.fieldId),
  );
  it("validates required, format, range, and choice tampering", () => {
    expect(Object.keys(validateAnswers(doc, {}))).toHaveLength(2);
    const errors = validateAnswers(doc, {
      [email]: "invalid",
      [number]: "20",
      [multi]: ["injected"],
      [select]: "injected",
    });
    expect(Object.keys(errors)).toHaveLength(4);
    expect(
      validateAnswers(doc, {
        [email]: "me@example.com",
        [number]: "4",
        [multi]: ["a"],
        [select]: "yes",
      }),
    ).toEqual({});
  });
  it("keeps responses separate, strips unknown keys, and preserves field IDs after reordering", () => {
    const before = JSON.stringify(doc),
      answers = {
        [email]: "me@example.com",
        [multi]: ["a"],
        unknown: "ignore",
      };
    const result = createSubmission(doc, answers);
    expect(result.answers.unknown).toBeUndefined();
    expect(JSON.stringify(doc)).toBe(before);
    const reordered = {
      ...doc,
      content: { type: "doc", content: [...doc.content.content!].reverse() },
    };
    expect(createSubmission(reordered, answers)).toEqual(result);
  });
  it("handles hostile property names without changing object prototypes", () => {
    const doc = parseDocument(
      createDocument("test", [
        fieldBlock("text", "q", { fieldId: "__proto__", required: true }),
      ]),
    );
    const answers = JSON.parse('{"__proto__":"answer"}');
    expect(createSubmission(doc, answers).answers["__proto__"]).toBe("answer");
    expect(validateAnswers(doc, {})).toHaveProperty("__proto__");
  });
});

it("persists submit alignment, defaults older documents left, and rejects invalid alignment", () => {
  const doc = createDocument("Button", [
    { type: "submit", attrs: { id: "submit", label: "Send" } },
  ]);
  expect(parseDocument(doc).content.content![0].attrs!.align).toBe("left");
  for (const align of ["left", "center", "right"]) {
    doc.content.content![0].attrs!.align = align;
    const saved = parseDocument(JSON.stringify(doc));
    expect(renderHTML(saved, { interactive: true })).toContain(
      `style="text-align:${align}"`,
    );
  }
  doc.content.content![0].attrs!.align = "invalid";
  expect(() => parseDocument(doc)).toThrow("버튼 정렬");
});

function renderHTML(
  input: Parameters<typeof renderCoreHTML>[0],
  options: Parameters<typeof renderCoreHTML>[1] = {},
) {
  return renderCoreHTML(input, {
    ...options,
    extensions: [FormKit, ...(options.extensions || [])],
  });
}

function parseDocument(
  input: unknown,
  extensions: Parameters<typeof parseCoreDocument>[1] = [],
) {
  return parseCoreDocument(input, [FormKit, ...extensions]);
}
