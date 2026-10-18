// @vitest-environment jsdom
import { FormKit } from "../packages/editor-form/src/index";
const blockChoices = getBlockChoices([FormKit]);
import { describe, expect, it, vi } from "vitest";
import {
  EditorState,
  TextSelection,
  type Transaction,
} from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { history, undo } from "prosemirror-history";
import { createSchema } from "../packages/editor-core/src/schema";
import {
  createDocument,
  parseDocument,
  textBlock,
} from "../packages/editor-core/src/document";
import { getBlockChoices } from "../packages/editor-core/src/editor";
import { createSlashMenuPlugin } from "../packages/editor-core/src/slash-menu";
function setup() {
  const schema = createSchema([FormKit]),
    plugin = createSlashMenuPlugin(blockChoices),
    initial = createDocument("Test", [textBlock()]);
  const view = {
    state: EditorState.create({
      schema,
      doc: schema.nodeFromJSON(initial.content),
      plugins: [plugin, history()],
    }),
    composing: false,
    isDestroyed: false,
    focus: vi.fn(),
    dispatch: (tr: Transaction) => {
      view.state = view.state.apply(tr);
    },
  };
  const type = (text: string) => {
    const { from, to } = view.state.selection;
    const handled = plugin.props.handleTextInput!.call(
      plugin,
      view as unknown as EditorView,
      from,
      to,
      text,
      () => view.state.tr.insertText(text, from, to),
    );
    if (!handled) view.dispatch(view.state.tr.insertText(text, from, to));
  };
  const key = (name: string, init: KeyboardEventInit = {}) =>
    plugin.props.handleKeyDown!.call(
      plugin,
      view as unknown as EditorView,
      new KeyboardEvent("keydown", { key: name, ...init }),
    );
  return { view, plugin, type, key, initial };
}
describe("inline slash commands", () => {
  it("filters from document text and replaces the command in one undoable edit", () => {
    const { view, plugin, type, key, initial } = setup();
    type("/");
    type("제목 2");
    expect(plugin.getState(view.state)?.query).toBe("제목 2");
    expect(view.state.doc.textContent).toBe("/제목 2");
    key("Enter");
    expect(view.state.doc.firstChild!.type.name).toBe("heading");
    expect(view.state.doc.firstChild!.attrs.level).toBe(2);
    expect(view.state.doc.textContent).toBe("");
    expect(plugin.getState(view.state)).toBeNull();
    parseDocument({ ...initial, content: view.state.doc.toJSON() }, [FormKit]);
    undo(view.state, view.dispatch);
    expect(view.state.doc.textContent).toBe("/제목 2");
    expect(view.state.doc.childCount).toBe(1);
  });
  it("keeps literal text on dismissal and closes when the slash is deleted", () => {
    const { view, plugin, type, key } = setup();
    type("/");
    type("본문");
    key("Escape");
    expect(view.state.doc.textContent).toBe("/본문");
    expect(plugin.getState(view.state)).toBeNull();
    view.dispatch(view.state.tr.delete(1, view.state.doc.content.size - 1));
    type("/");
    expect(plugin.getState(view.state)).not.toBeNull();
    view.dispatch(view.state.tr.delete(1, 2));
    expect(plugin.getState(view.state)).toBeNull();
  });
  it("does not consume IME confirmation or plain typing in an existing paragraph", () => {
    const { view, plugin, type, key } = setup();
    type("/");
    type("제목");
    expect(key("Enter", { isComposing: true })).toBe(false);
    expect(view.state.doc.firstChild!.type.name).toBe("paragraph");
    view.composing = true;
    expect(key("Enter")).toBe(false);
    view.composing = false;
    key("Escape");
    view.dispatch(view.state.tr.delete(1, view.state.doc.content.size - 1));
    type("본문");
    type("/");
    expect(plugin.getState(view.state)).toBeNull();
  });
  it("keeps selection in the editor when navigating and tolerates no results", () => {
    const { view, plugin, type, key } = setup();
    type("/");
    type("제목");
    const pos = view.state.selection.from;
    key("ArrowDown");
    expect(plugin.getState(view.state)?.index).toBe(1);
    expect(view.state.selection.from).toBe(pos);
    key("ArrowUp");
    expect(plugin.getState(view.state)?.index).toBe(0);
    type("없는종류");
    expect(key("Enter")).toBe(true);
    expect(view.state.doc.textContent).toBe("/제목없는종류");
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)),
    );
    expect(plugin.getState(view.state)).toBeNull();
  });
});
