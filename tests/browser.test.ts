// @vitest-environment jsdom
import {
  collectFields,
  fieldBlock,
  formTemplate,
} from "../packages/editor-form/src/index";
import { FormKit } from "../packages/editor-form/src/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditor as createCoreEditor } from "../packages/editor-core/src/editor";
import { mountForm } from "../packages/editor-form/src/forms";
import { DOMSerializer } from "prosemirror-model";
import {
  createDocument,
  parseDocument as parseCoreDocument,
  textBlock,
} from "../packages/editor-core/src/index";
const disposers: (() => void)[] = [];
function host() {
  const div = document.createElement("div");
  document.body.append(div);
  return div;
}
function editor(
  doc = createDocument(),
  extra: Partial<Parameters<typeof createEditor>[1]> = {},
) {
  const instance = createEditor(host(), { document: doc, ...extra });
  instance.view.setProps({ handleScrollToSelection: () => true });
  disposers.push(() => instance.destroy());
  return instance;
}
afterEach(() => {
  disposers.splice(0).forEach((d) => d());
  document.body.replaceChildren();
});
describe("editor lifecycle and transactions", () => {
  it("moves inspector placement without resetting history or deleting consumer DOM", () => {
    const external = host(),
      marker = document.createElement("span");
    marker.textContent = "Consumer";
    external.append(marker);
    const instance = createEditor(host(), {
      document: createDocument("Form", [fieldBlock("text", "Original")]),
      inspectorElement: external,
    });
    instance.view.setProps({ handleScrollToSelection: () => true });
    const inspector = external.querySelector(".cms-inspector");
    expect(inspector).not.toBeNull();
    instance.selectBlock(0);
    instance.updateBlock({ label: "Changed" });
    instance.setInspectorMode("popover");
    expect(external.querySelector(".cms-inspector")).toBeNull();
    instance.setInspectorMode("inline");
    expect(external.querySelector(".cms-inspector")).toBe(inspector);
    instance.undo();
    expect(collectFields(instance.getDocument())[0].attrs!.label).toBe(
      "Original",
    );
    instance.destroy();
    expect(external.textContent).toBe("Consumer");
  });
  it("returns detached snapshots to consumers", () => {
    const instance = editor(
      createDocument("F", [fieldBlock("radio", "Original")]),
    );
    const snapshot = instance.getDocument();
    snapshot.content.content![0].attrs!.label = "Changed";
    (snapshot.content.content![0].attrs!.options as string[]).push("Injected");
    const selection = instance.getSelected()!;
    selection.node.attrs!.label = "Changed selection";
    expect(instance.getDocument().content.content![0].attrs!.label).toBe(
      "Original",
    );
    expect(
      instance.getDocument().content.content![0].attrs!.options,
    ).not.toContain("Injected");
  });
  it("round-trips clipboard fields without reusing response IDs", () => {
    const one = editor(
        createDocument("F", [
          fieldBlock("radio", "Pick", { required: true, options: ["A", "B"] }),
        ]),
      ),
      two = editor();
    const wrapper = document.createElement("div");
    wrapper.append(
      DOMSerializer.fromSchema(one.view.state.schema).serializeFragment(
        one.view.state.doc.content,
      ),
    );
    two.importHTML(wrapper.innerHTML);
    const first = collectFields(one.getDocument())[0].attrs!,
      second = collectFields(two.getDocument())[0].attrs!;
    expect(second).toMatchObject({
      kind: "radio",
      label: "Pick",
      required: true,
      options: ["A", "B"],
    });
    expect(second.fieldId).not.toBe(first.fieldId);
    parseDocument(two.getDocument());
    const bad = document.createElement("div");
    bad.setAttribute("data-cms-field", "x");
    bad.setAttribute(
      "data-cms-attrs",
      JSON.stringify({ ...first, options: ["A", "A"] }),
    );
    bad.textContent = "Bad field";
    two.importHTML(bad.outerHTML);
    expect(collectFields(two.getDocument())).toHaveLength(0);
  });
  it("isolates instances and restores a deleted block through undo", () => {
    const first = editor(),
      second = editor();
    first.insert("field", { kind: "email" });
    expect(collectFields(first.getDocument())).toHaveLength(1);
    expect(collectFields(second.getDocument())).toHaveLength(0);
    first.remove();
    expect(collectFields(first.getDocument())).toHaveLength(0);
    first.undo();
    expect(collectFields(first.getDocument())).toHaveLength(1);
  });
  it("assigns new field IDs on duplication, retains IDs on moving, and clears history on replacement", () => {
    const instance = editor(formTemplate());
    instance.selectBlock(3);
    const field = collectFields(instance.getDocument())[0];
    instance.duplicate();
    const fields = collectFields(instance.getDocument());
    expect(new Set(fields.map((f) => f.attrs!.fieldId)).size).toBe(
      fields.length,
    );
    instance.moveBlock(3, 6);
    expect(
      collectFields(instance.getDocument()).some(
        (f) => f.attrs!.fieldId === field.attrs!.fieldId,
      ),
    ).toBe(true);
    instance.setDocument(createDocument("New"));
    instance.undo();
    expect(instance.getDocument().title).toBe("New");
    expect(collectFields(instance.getDocument())).toHaveLength(0);
    parseDocument(instance.getDocument());
  });
  it("sanitizes pasted HTML and preserves basic formatting", () => {
    const instance = editor();
    instance.importHTML(
      '<p><strong>bold</strong><a href="javascript:alert(1)">unsafe</a><img src="javascript:bad"><script>alert(1)</script></p>',
    );
    const json = JSON.stringify(instance.getDocument());
    expect(json).toContain("strong");
    expect(json).not.toContain("javascript:");
    expect(json).not.toContain("alert(1)");
    parseDocument(instance.getDocument());
  });
  it("supports filtered insertion without dropping existing unsupported palette blocks", () => {
    const instance = editor(formTemplate(), {
      allowedBlocks: ["paragraph", "heading"],
    });
    const before = instance.getDocument();
    instance.insert("field");
    expect(instance.getDocument()).toEqual(before);
    instance.insert("heading");
    expect(
      instance.getDocument().content.content!.some((n) => n.type === "heading"),
    ).toBe(true);
  });
  it("rejects invalid settings without corrupting the current document", () => {
    const instance = editor(
      createDocument("Form", [fieldBlock("radio", "Choice")]),
    );
    instance.selectBlock(0);
    const before = instance.getDocument();
    expect(() => instance.updateBlock({ options: ["x", "x"] })).toThrow();
    expect(instance.getDocument()).toEqual(before);
  });
  it("does not install a browser-global singleton or leave content after destroy", () => {
    const div = host();
    const instance = createEditor(div, { document: createDocument() });
    instance.destroy();
    expect(div.childElementCount).toBe(0);
    const second = createEditor(div, { document: createDocument() });
    expect(div.querySelectorAll(".ProseMirror")).toHaveLength(1);
    second.destroy();
  });
  it("does not reopen a deleted image after its asynchronous upload finishes", async () => {
    let resolve!: (value: { src: string }) => void;
    const instance = editor(
      createDocument("Image", [
        {
          type: "image",
          attrs: { id: "image", src: "", alt: "", caption: "", width: 100 },
        },
      ]),
      {
        uploadImage: () =>
          new Promise((r) => {
            resolve = r;
          }),
      },
    );
    instance.selectBlock(0);
    const upload = instance.uploadImage(
      new File(["img"], "a.png", { type: "image/png" }),
    );
    instance.remove();
    resolve({ src: "/uploaded.png" });
    await upload;
    expect(
      instance.getDocument().content.content!.some((n) => n.type === "image"),
    ).toBe(false);
  });
});
describe("form lifecycle", () => {
  it("prevents duplicate in-flight submissions and aborts on teardown", async () => {
    let release!: () => void;
    let signal: AbortSignal | undefined;
    const submit = vi.fn((_value, s) => {
      signal = s;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const div = host();
    const instance = mountForm(div, {
      document: createDocument("F", [fieldBlock("text", "Optional")]),
      onSubmit: submit,
    });
    const form = div.querySelector("form")!;
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    expect(submit).toHaveBeenCalledTimes(1);
    expect(form.getAttribute("aria-busy")).toBe("true");
    instance.destroy();
    expect(signal?.aborted).toBe(true);
    release();
    await Promise.resolve();
    expect(div.childElementCount).toBe(0);
  });
  it("uses unique label targets for multiple forms on a page", () => {
    const a = host(),
      b = host(),
      doc = formTemplate();
    const one = mountForm(a, { document: doc, onSubmit: () => {} }),
      two = mountForm(b, { document: doc, onSubmit: () => {} });
    disposers.push(one.destroy, two.destroy);
    const ids = Array.from(document.querySelectorAll("[id]")).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("keeps submit controls usable when persistence fails", async () => {
    const div = host(),
      submit = vi
        .fn()
        .mockRejectedValueOnce(new Error("Try again"))
        .mockResolvedValueOnce(undefined);
    const instance = mountForm(div, {
      document: createDocument("F", [textBlock("Welcome")]),
      onSubmit: submit,
    });
    disposers.push(instance.destroy);
    div
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(div.textContent).toContain("Try again");
    expect(div.querySelector("button")!.disabled).toBe(false);
    div
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(div.textContent).toContain("감사합니다");
  });
});

describe("inline question editing", () => {
  it("updates attributes while retaining the focused input node and selection", () => {
    const instance = editor(
      createDocument("Form", [fieldBlock("text", "Original")]),
    );
    const title = instance.view.dom.querySelector<HTMLTextAreaElement>(
      '[aria-label="질문 제목"]',
    )!;
    title.focus();
    title.value = "Changed question";
    title.setSelectionRange(7, 7);
    title.dispatchEvent(new Event("input", { bubbles: true }));
    expect(collectFields(instance.getDocument())[0].attrs!.label).toBe(
      "Changed question",
    );
    expect(instance.view.dom.querySelector('[aria-label="질문 제목"]')).toBe(
      title,
    );
    expect(document.activeElement).toBe(title);
    expect(title.selectionStart).toBe(7);
    instance.undo();
    expect(title.value).toBe("Original");
    instance.redo();
    expect(title.value).toBe("Changed question");
  });
  it("commits composition only when finished and rejects empty question titles", () => {
    const instance = editor(
      createDocument("Form", [fieldBlock("text", "Original")]),
    );
    const title = instance.view.dom.querySelector<HTMLTextAreaElement>(
      '[aria-label="질문 제목"]',
    )!;
    title.focus();
    title.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    title.value = "한글";
    title.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
    expect(collectFields(instance.getDocument())[0].attrs!.label).toBe(
      "Original",
    );
    title.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "한글" }),
    );
    expect(collectFields(instance.getDocument())[0].attrs!.label).toBe("한글");
    title.value = "";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    title.blur();
    expect(title.value).toBe("한글");
    expect(instance.view.dom.textContent).toContain("질문 제목을 입력하세요");
    parseDocument(instance.getDocument());
  });
  it("adds and removes options while keeping IDs stable and rejecting duplicates", () => {
    const instance = editor(
      createDocument("Form", [
        fieldBlock("radio", "Choice", { options: ["A", "B"] }),
      ]),
    );
    const id = collectFields(instance.getDocument())[0].attrs!.fieldId;
    instance.view.dom
      .querySelector<HTMLButtonElement>(".cms-inline-add")!
      .click();
    expect(
      collectFields(instance.getDocument())[0].attrs!.options,
    ).toHaveLength(3);
    instance.view.dom
      .querySelector<HTMLButtonElement>('[aria-label="선택지 3 삭제"]')!
      .click();
    expect(collectFields(instance.getDocument())[0].attrs!.options).toEqual([
      "A",
      "B",
    ]);
    const first = instance.view.dom.querySelector<HTMLInputElement>(
      '[aria-label="선택지 1"]',
    )!;
    first.focus();
    first.value = "B";
    first.dispatchEvent(new Event("input", { bubbles: true }));
    first.blur();
    expect(first.value).toBe("A");
    expect(collectFields(instance.getDocument())[0].attrs!.fieldId).toBe(id);
    parseDocument(instance.getDocument());
  });
});

describe("inline submit editing", () => {
  it("keeps the caret and IME input, rejects blanks, and restores label/alignment through history", () => {
    const instance = editor(
      createDocument("Button", [
        { type: "submit", attrs: { id: "submit", label: "Original" } },
      ]),
    );
    const input = instance.view.dom.querySelector<HTMLInputElement>(
      '[aria-label="버튼 문구"]',
    )!;
    const attrs = () => instance.getDocument().content.content![0].attrs!;
    expect(attrs().align).toBe("left");
    expect(instance.view.dom.querySelector(".cms-atomic-settings")).toBeNull();
    input.focus();
    input.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    input.value = "신청 완료";
    input.setSelectionRange(2, 2);
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
    expect(attrs().label).toBe("Original");
    input.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true }),
    );
    expect(attrs().label).toBe("신청 완료");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(2);
    input.value = " ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.blur();
    expect(input.value).toBe("신청 완료");
    instance.view.dom
      .querySelector<HTMLButtonElement>('[aria-label="가운데 정렬"]')!
      .click();
    expect(attrs().align).toBe("center");
    instance.undo();
    expect(attrs().align).toBe("left");
    instance.undo();
    expect(input.value).toBe("Original");
    instance.redo();
    instance.redo();
    expect(attrs()).toMatchObject({ label: "신청 완료", align: "center" });
    expect(instance.view.dom.querySelector('[aria-label="버튼 문구"]')).toBe(
      input,
    );
    const wrapper = document.createElement("div");
    wrapper.append(
      DOMSerializer.fromSchema(instance.view.state.schema).serializeFragment(
        instance.view.state.doc.content,
      ),
    );
    const other = editor();
    other.importHTML(wrapper.innerHTML);
    expect(other.getDocument().content.content![0].attrs).toMatchObject({
      label: "신청 완료",
      align: "center",
    });
  });
});

describe("list item handle actions", () => {
  for (const type of ["bullet_list", "ordered_list"]) {
    it(`reorders ${type} items with nested content and stable IDs in one undo step`, async () => {
      const { moveListItem, duplicateListItem, removeListItem } = await import(
        "../packages/editor-core/src/list-actions"
      );
      const instance = editor(
        createDocument("Lists", [
          {
            type,
            attrs: {
              id: "list",
              ...(type === "ordered_list" ? { order: 3 } : {}),
            },
            content: [
              {
                type: "list_item",
                attrs: { id: "a" },
                content: [
                  textBlock("A"),
                  {
                    type: "bullet_list",
                    attrs: { id: "nested" },
                    content: [
                      {
                        type: "list_item",
                        attrs: { id: "child" },
                        content: [textBlock("Child")],
                      },
                    ],
                  },
                ],
              },
              {
                type: "list_item",
                attrs: { id: "b" },
                content: [textBlock("B")],
              },
              {
                type: "list_item",
                attrs: { id: "c" },
                content: [textBlock("C")],
              },
            ],
          },
        ]),
      );
      const before = instance.getDocument();
      moveListItem(instance.view, 1, 2);
      const list = instance.getDocument().content.content![0];
      expect(list.content!.map((n) => n.attrs!.id)).toEqual(["b", "c", "a"]);
      expect(list.content![2].content![1].attrs!.id).toBe("nested");
      expect(list.attrs).toEqual(before.content.content![0].attrs);
      instance.undo();
      expect(instance.getDocument()).toEqual(before);
      instance.redo();
      duplicateListItem(instance.view, 1);
      parseDocument(instance.getDocument());
      expect(instance.view.state.doc.firstChild!.childCount).toBe(4);
      expect(instance.view.state.doc.firstChild!.child(1).attrs.id).not.toBe(
        "b",
      );
      for (let i = 0; i < 4; i++) removeListItem(instance.view, 1);
      expect(instance.view.state.doc.firstChild!.type.name).toBe("paragraph");
      parseDocument(instance.getDocument());
      instance.undo();
      expect(instance.view.state.doc.firstChild!.type.name).toBe(type);
    });
  }
});

function createEditor(
  host: HTMLElement,
  options: Parameters<typeof createCoreEditor>[1],
) {
  return createCoreEditor(host, {
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
