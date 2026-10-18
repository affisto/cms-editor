import { describe, it, expect } from "vitest";
import {
  createDocument,
  createSchema,
  parseDocument,
  renderHTML,
  newId,
  resolveExtensions,
  type BlockExtension,
  type ExtensionKit,
} from "../packages/editor-core/src/index";
import { getBlockChoices } from "../packages/editor-core/src/editor";
import { FormKit, formTemplate } from "../packages/editor-form/src/index";
const Notice: BlockExtension = {
  name: "notice",
  label: "알림",
  spec: {
    atom: true,
    attrs: { message: { default: "Hello" } },
    toDOM: (n) => ["aside", n.attrs.message],
  },
  validate: (attrs) => {
    if (typeof attrs.message !== "string")
      throw new Error("message must be text");
  },
  renderHTML: (node, context) =>
    `<aside data-custom="true">${context.escapeHTML(node.attrs?.message)}</aside>`,
};
describe("optional extension kits", () => {
  it("has no form schema or palette entries until the form kit is installed", () => {
    expect(createSchema().nodes.field).toBeUndefined();
    expect(createSchema().nodes.submit).toBeUndefined();
    expect(getBlockChoices().some((c) => c.type === "field")).toBe(false);
    expect(() => parseDocument(formTemplate())).toThrow("지원하지 않는 블록");
    const doc = parseDocument(formTemplate(), [FormKit]);
    expect(
      renderHTML(doc, { extensions: [FormKit], interactive: true }),
    ).toContain('type="submit"');
    expect(
      getBlockChoices([FormKit]).filter((c) => c.type === "field"),
    ).toHaveLength(7);
  });
  it("uses consumer definitions for validation, menu and rendered output", () => {
    const doc = createDocument("Custom", [
      {
        type: "notice",
        attrs: { id: newId(), message: "<script>alert(1)</script>" },
      },
    ]);
    const kit: ExtensionKit = { name: "consumer", extensions: [Notice] };
    const parsed = parseDocument(doc, [kit]);
    expect(renderHTML(parsed, { extensions: [kit] })).toContain(
      'data-custom="true"',
    );
    expect(renderHTML(parsed, { extensions: [kit] })).toContain(
      "&lt;script&gt;",
    );
    expect(getBlockChoices([kit]).find((c) => c.type === "notice")?.label).toBe(
      "알림",
    );
    doc.content.content![0].attrs!.message = 42;
    expect(() => parseDocument(doc, [kit])).toThrow("message must be text");
  });
  it("rejects duplicate registrations and kit cycles instead of silently overriding nodes", () => {
    expect(() => createSchema([FormKit, FormKit])).toThrow("중복");
    expect(() => createSchema([{ ...Notice, name: "paragraph" }])).toThrow(
      "등록",
    );
    const loop: ExtensionKit = { name: "loop", extensions: [] };
    loop.extensions.push(loop);
    expect(() => resolveExtensions([loop])).toThrow("순환");
  });
  it("can combine the default form kit with an application block without changing stored IDs", () => {
    const source = formTemplate();
    source.content.content!.push({
      type: "notice",
      attrs: { id: newId(), message: "Consumer" },
    });
    const doc = parseDocument(source, [FormKit, Notice]);
    expect(parseDocument(JSON.stringify(doc), [FormKit, Notice])).toEqual(doc);
    const html = renderHTML(doc, {
      extensions: [FormKit, Notice],
      interactive: true,
    });
    expect(html).toContain("data-cms-answer");
    expect(html).toContain('data-custom="true"');
  });
});
