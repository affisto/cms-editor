import {
  DOMParser as PMParser,
  Fragment,
  type Node as PMNode,
} from "prosemirror-model";
import {
  EditorState,
  Plugin,
  NodeSelection,
  TextSelection,
  Selection,
  type Command,
} from "prosemirror-state";
import {
  EditorView,
  Decoration,
  DecorationSet,
  type NodeView,
  type NodeViewConstructor,
} from "prosemirror-view";
import {
  baseKeymap,
  toggleMark,
  setBlockType,
  chainCommands,
  exitCode,
} from "prosemirror-commands";
import {
  history,
  undo,
  redo,
  undoDepth,
  redoDepth,
  closeHistory,
} from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import {
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
  undoInputRule,
} from "prosemirror-inputrules";
import { splitListItem } from "prosemirror-schema-list";
import { listIndent } from "./list-actions";
import {
  createSchema,
  safeURL,
  resolveExtensions,
  type Extension,
} from "./schema";
import { createSlashMenuPlugin } from "./slash-menu";
import { createInspector, type InspectorMode } from "./inspector";
import { createBlockHandles } from "./block-handles";
import {
  newId,
  normalizeNodeIds,
  parseDocument,
  type CMSDocument,
  type JSONNode,
} from "./document";
export interface BlockChoice {
  suggested?: boolean;
  type: string;
  label: string;
  icon: string;
  group: "문서" | "질문";
  attrs?: Record<string, unknown>;
}
export const blockChoices: BlockChoice[] = [
  { type: "paragraph", label: "본문", icon: "T", group: "문서" },
  {
    type: "heading",
    label: "제목",
    icon: "H",
    group: "문서",
    attrs: { level: 2 },
  },
  { type: "bullet_list", label: "글머리 목록", icon: "≡", group: "문서" },
  { type: "ordered_list", label: "번호 목록", icon: "1.", group: "문서" },
  { type: "checklist", label: "체크리스트", icon: "☑", group: "문서" },
  { type: "blockquote", label: "인용", icon: "❞", group: "문서" },
  { type: "toggle", label: "접기 / 펼치기", icon: "▸", group: "문서" },
  { type: "divider", label: "구분선", icon: "—", group: "문서" },
  { type: "image", label: "이미지", icon: "▧", group: "문서" },
  { type: "code_block", label: "코드", icon: "<>", group: "문서" },
];
export function getBlockChoices(extensions: Extension[] = []): BlockChoice[] {
  return [
    ...blockChoices,
    ...resolveExtensions(extensions).flatMap((extension) =>
      extension.menu === false
        ? []
        : (extension.menu || [{ label: extension.label }]).map(
            (item) =>
              ({
                type: extension.name,
                suggested: item.suggested,
                label: item.label,
                icon: item.icon || "◇",
                group: item.group || "문서",
                attrs: item.attrs,
              }) as BlockChoice,
          ),
    ),
  ];
}
export interface SelectedBlock {
  index: number;
  pos: number;
  node: JSONNode;
}
export interface EditorOptions {
  document: CMSDocument;
  onChange?: (document: CMSDocument) => void;
  onSelection?: (block: SelectedBlock | null) => void;
  extensions?: Extension[];
  nodeViews?: Record<string, NodeViewConstructor>;
  allowedBlocks?: string[];
  inspectorElement?: HTMLElement;
  inspectorMode?: InspectorMode;
  /** Opt in to the fixed toolbar. The default editor uses inline controls and shortcuts. */
  showToolbar?: boolean;
  uploadImage?: (
    file: File,
    signal: AbortSignal,
  ) => Promise<{ src: string; alt?: string }>;
  onError?: (error: Error) => void;
  placeholder?: string;
  labels?: Partial<
    Record<
      | "add"
      | "undo"
      | "redo"
      | "bold"
      | "italic"
      | "strike"
      | "link"
      | "remove"
      | "duplicate"
      | "up"
      | "down",
      string
    >
  >;
}
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
}
export function createEditor(host: HTMLElement, options: EditorOptions) {
  const extensions = resolveExtensions(options.extensions);
  const schema = createSchema(options.extensions);
  let blockHandles: ReturnType<typeof createBlockHandles> | undefined;
  let data = parseDocument(options.document, options.extensions),
    destroyed = false;
  const controller = new AbortController(),
    shell = el("div", "cms-editor"),
    toolbar = el("div", "cms-toolbar"),
    surface = el("div", "cms-surface"),
    notice = el("p", "cms-notice");
  if (options.showToolbar) shell.append(toolbar);
  shell.append(surface, notice);
  const inspectorUI = createInspector({
    container: shell,
    externalHost: options.inspectorElement,
    mode:
      options.inspectorMode ||
      (options.inspectorElement ? "inline" : "popover"),
    returnFocus: () => {
      if (!destroyed) view.focus();
    },
    getBlockRect: () => {
      const current = selected();
      const node = current ? view.nodeDOM(current.pos) : null;
      return node instanceof HTMLElement
        ? node.getBoundingClientRect()
        : undefined;
    },
  });
  const inspector = inspectorUI.content;
  host.append(shell);
  notice.setAttribute("role", "status");
  const choices = getBlockChoices(options.extensions).filter(
    (c) => !options.allowedBlocks || options.allowedBlocks.includes(c.type),
  );
  const allowed = (type: string) =>
    !options.allowedBlocks || options.allowedBlocks.includes(type);
  const button = (label: string, fn: () => void, text = label) => {
    const b = el("button", "cms-tool", text);
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", fn);
    return b;
  };
  const error = (reason: unknown) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    notice.textContent = err.message;
    options.onError?.(err);
  };
  const emit = () => options.onChange?.(getDocument());
  const getDocument = (): CMSDocument =>
    structuredClone({
      ...data,
      content: view.state.doc.toJSON() as JSONNode,
    });
  const selected = (): SelectedBlock | null => {
    const { selection, doc } = view.state;
    let pos = 0,
      index = 0;
    for (let i = 0; i < doc.childCount; i++) {
      const node = doc.child(i);
      if (selection.from < pos + node.nodeSize || i === doc.childCount - 1) {
        index = i;
        return { index, pos, node: structuredClone(node.toJSON()) as JSONNode };
      }
      pos += node.nodeSize;
    }
    return null;
  };
  let inspectorKey = "",
    palette: { close: () => void } | null = null;
  const run = (command: Command) => {
    command(view.state, view.dispatch, view);
    view.focus();
  };
  function applyAttributes(id: string, patch: Record<string, unknown>) {
    let position: number | undefined, node: PMNode | undefined;
    view.state.doc.descendants((n, p) => {
      if (n.attrs.id === id) {
        position = p;
        node = n;
        return false;
      }
    });
    if (position === undefined || !node) return;
    const tr = closeHistory(view.state.tr).setNodeMarkup(position, undefined, {
      ...node.attrs,
      ...patch,
    });
    parseDocument({ ...data, content: tr.doc.toJSON() }, options.extensions);
    view.dispatch(tr);
  }
  function selectBlock(index: number) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= view.state.doc.childCount
    )
      return;
    let pos = 0;
    for (let i = 0; i < index; i++) pos += view.state.doc.child(i).nodeSize;
    const n = view.state.doc.child(index);
    view.dispatch(
      view.state.tr.setSelection(
        n.isTextblock
          ? TextSelection.create(view.state.doc, pos + 1)
          : NodeSelection.create(view.state.doc, pos),
      ),
    );
  }
  function insert(type: string, attrs: Record<string, unknown> = {}) {
    if (!allowed(type) || !schema.nodes[type]) return;
    const { state } = view;
    const current = selected();
    if (!current) return;
    const a: Record<string, unknown> = { ...attrs, id: newId() };
    for (const key of (schema.nodes[type].spec.uniqueAttributes ||
      []) as string[])
      a[key] = newId();
    let node = schema.nodes[type].createAndFill(a);
    if (!node) return;
    node = normalizeNodeIds(node, schema);
    const old = state.doc.nodeAt(current.pos)!;
    const replace = old.type.name === "paragraph" && old.content.size === 0;
    const from = replace ? current.pos : current.pos + old.nodeSize;
    const tr = closeHistory(state.tr).replaceWith(
      from,
      replace ? from + old.nodeSize : from,
      node,
    );
    tr.setSelection(
      node.isTextblock
        ? TextSelection.create(tr.doc, from + 1)
        : NodeSelection.create(tr.doc, from),
    );
    view.dispatch(tr.scrollIntoView());
    view.focus();
  }
  function remove() {
    const cur = selected();
    if (!cur) return;
    const node = view.state.doc.nodeAt(cur.pos)!;
    const tr = closeHistory(view.state.tr);
    if (view.state.doc.childCount === 1)
      tr.replaceWith(
        0,
        node.nodeSize,
        schema.nodes.paragraph.create({ id: newId() }),
      );
    else tr.delete(cur.pos, cur.pos + node.nodeSize);
    view.dispatch(
      tr
        .setSelection(
          Selection.near(
            tr.doc.resolve(Math.min(cur.pos, tr.doc.content.size)),
          ),
        )
        .scrollIntoView(),
    );
    view.focus();
  }
  function duplicate() {
    const cur = selected();
    if (!cur) return;
    const raw = cur.node;
    const clear = (n: JSONNode): JSONNode => ({
      ...n,
      attrs: n.attrs
        ? {
            ...n.attrs,
            id: newId(),
            ...Object.fromEntries(
              (
                (schema.nodes[n.type].spec.uniqueAttributes || []) as string[]
              ).map((key) => [key, newId()]),
            ),
          }
        : undefined,
      content: n.content?.map(clear),
    });
    const node = schema.nodeFromJSON(clear(raw)),
      at = cur.pos + view.state.doc.nodeAt(cur.pos)!.nodeSize;
    const tr = closeHistory(view.state.tr).insert(at, node);
    view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, at)));
    view.focus();
  }
  function moveBlock(from: number, to: number) {
    const doc = view.state.doc;
    if (
      from === to ||
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to < 0 ||
      from >= doc.childCount ||
      to >= doc.childCount
    )
      return;
    const nodes: PMNode[] = [];
    doc.forEach((n) => nodes.push(n));
    const [node] = nodes.splice(from, 1);
    nodes.splice(to, 0, node);
    const tr = closeHistory(view.state.tr).replaceWith(
      0,
      doc.content.size,
      Fragment.fromArray(nodes),
    );
    let pos = 0;
    for (let i = 0; i < to; i++) pos += nodes[i].nodeSize;
    view.dispatch(
      tr.setSelection(NodeSelection.create(tr.doc, pos)).scrollIntoView(),
    );
    view.focus();
  }
  function openPalette() {
    if (palette || destroyed) return;
    const panel = el("dialog", "cms-palette");
    const close = () => {
      panel.remove();
      palette = null;
      if (!destroyed) view.focus();
    };
    palette = { close };
    panel.setAttribute("aria-label", "블록 추가");
    const header = el("div", "cms-palette-header"),
      input = el("input");
    input.placeholder = "블록 검색";
    input.setAttribute("aria-label", "블록 검색");
    header.append(input, button("닫기", close, "×"));
    const list = el("div", "cms-palette-list");
    panel.append(header, list);
    shell.append(panel);
    const paint = () => {
      list.replaceChildren();
      for (const choice of choices.filter((c) =>
        `${c.label} ${c.type} ${c.group}`
          .toLowerCase()
          .includes(input.value.toLowerCase()),
      )) {
        const row = button(
          `${choice.label} 추가`,
          () => {
            close();
            insert(choice.type, choice.attrs);
          },
          `${choice.icon}  ${choice.label}`,
        );
        row.addEventListener("keydown", (event) => {
          if (event.isComposing) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            (row.nextElementSibling as HTMLElement)?.focus();
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            ((row.previousElementSibling as HTMLElement) || input).focus();
          }
        });
        list.append(row);
      }
      if (!list.children.length)
        list.append(el("p", "cms-help", "검색 결과가 없습니다."));
    };
    input.addEventListener("input", paint);
    input.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        const first = list.querySelector<HTMLButtonElement>("button");
        if (event.key === "Enter") first?.click();
        else first?.focus();
      }
    });
    panel.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    panel.addEventListener("click", (event) => {
      if (event.target === panel) close();
    });
    paint();
    panel.showModal();
    input.focus();
  }
  function linkDialog() {
    const dialog = el("dialog", "cms-palette");
    dialog.setAttribute("aria-label", "링크 편집");
    const input = el("input");
    input.placeholder = "https://example.com";
    input.setAttribute("aria-label", "링크 주소");
    input.value =
      view.state.storedMarks?.find((m) => m.type === schema.marks.link)?.attrs
        .href ||
      view.state.selection.$from
        .marks()
        .find((m) => m.type === schema.marks.link)?.attrs.href ||
      "";
    const note = el("p", "cms-error");
    const apply = () => {
      const href = safeURL(input.value);
      if (!href) {
        note.textContent =
          "https:// 주소나 / 로 시작하는 내부 경로를 입력하세요.";
        return;
      }
      const { from, to, empty } = view.state.selection;
      const mark = schema.marks.link.create({ href });
      view.dispatch(
        empty
          ? view.state.tr.addStoredMark(mark)
          : view.state.tr.addMark(from, to, mark),
      );
      dialog.close();
    };
    dialog.append(
      el("h3", "", "링크"),
      input,
      note,
      button("적용", apply),
      button("링크 해제", () => {
        view.dispatch(
          view.state.tr
            .removeMark(
              view.state.selection.from,
              view.state.selection.to,
              schema.marks.link,
            )
            .removeStoredMark(schema.marks.link),
        );
        dialog.close();
      }),
      button("닫기", () => dialog.close()),
    );
    shell.append(dialog);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
    });
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove();
        view.focus();
      },
      { once: true },
    );
    dialog.showModal();
    input.focus();
  }
  const markButtons = new Map<string, HTMLButtonElement>();
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "편집 도구");
  toolbar.append(
    button(options.labels?.add || "블록 추가", openPalette, "+ 블록 추가"),
  );
  const undoButton = button(
      options.labels?.undo || "실행 취소",
      () => run(undo),
      "↶",
    ),
    redoButton = button(
      options.labels?.redo || "다시 실행",
      () => run(redo),
      "↷",
    );
  toolbar.append(undoButton, redoButton);
  for (const [mark, label, display] of [
    ["strong", options.labels?.bold || "굵게", "B"],
    ["em", options.labels?.italic || "기울임", "I"],
    ["strike", options.labels?.strike || "취소선", "S"],
    ["code", "인라인 코드", "<>"],
  ]) {
    const b = button(label, () => run(toggleMark(schema.marks[mark])), display);
    markButtons.set(mark, b);
    toolbar.append(b);
  }
  toolbar.append(button(options.labels?.link || "링크", linkDialog, "↗"));
  const format = el("select", "cms-format");
  format.setAttribute("aria-label", "텍스트 종류");
  for (const [value, label] of [
    ["paragraph", "본문"],
    ["heading:1", "제목 1"],
    ["heading:2", "제목 2"],
    ["heading:3", "제목 3"],
    ["code_block", "코드"],
  ]) {
    const o = el("option", "", label);
    o.value = value;
    format.append(o);
  }
  format.addEventListener("change", () => {
    const [type, level] = format.value.split(":");
    if (allowed(type))
      run(
        setBlockType(
          schema.nodes[type],
          level ? { level: Number(level) } : undefined,
        ),
      );
  });
  toolbar.append(format, inspectorUI.trigger);
  function atomicView(
    initial: PMNode,
    nodeView: EditorView,
    getPos: () => number | undefined,
  ): NodeView {
    let current = initial;
    const dom = el("div", "cms-atomic");
    dom.contentEditable = "false";
    dom.draggable = true;
    const paint = () => {
      dom.replaceChildren();
      const a = current.attrs;
      dom.dataset.blockId = a.id;
      const settings = button(
        "이 블록 설정",
        () => {
          const pos = getPos();
          if (pos === undefined) return;
          nodeView.dispatch(
            nodeView.state.tr.setSelection(
              NodeSelection.create(nodeView.state.doc, pos),
            ),
          );
          inspectorUI.open("block");
        },
        "설정",
      );
      settings.classList.add("cms-atomic-settings");
      dom.append(settings);
      if (current.type.name === "image") {
        if (a.src) {
          const image = el("img");
          image.src = safeURL(a.src, true);
          image.alt = a.alt;
          image.style.width = `${a.width}%`;
          dom.append(image);
          if (a.caption) dom.append(el("p", "cms-help", a.caption));
        } else
          dom.append(
            el("div", "cms-image-placeholder", "▧  이미지를 선택해주세요"),
            el(
              "p",
              "cms-help",
              "블록 설정에서 파일을 업로드하거나 주소를 입력하세요.",
            ),
          );
      }
    };
    paint();
    return {
      dom,
      update(node) {
        if (node.type !== current.type) return false;
        current = node;
        paint();
        return true;
      },
      ignoreMutation: () => true,
      stopEvent: (event) =>
        event.target instanceof Element &&
        !!event.target.closest(".cms-atomic-settings"),
    };
  }
  const keys: Record<string, Command> = {
    "Mod-z": undo,
    "Shift-Mod-z": redo,
    "Mod-y": redo,
    "Mod-b": toggleMark(schema.marks.strong),
    "Mod-i": toggleMark(schema.marks.em),
    "Mod-`": toggleMark(schema.marks.code),
    Backspace: undoInputRule,
    "Mod-Enter": chainCommands(exitCode, (state, dispatch) => {
      dispatch?.(
        state.tr.replaceSelectionWith(schema.nodes.hard_break.create()),
      );
      return true;
    }),
    "Shift-Enter": (state, dispatch) => {
      dispatch?.(
        state.tr.replaceSelectionWith(schema.nodes.hard_break.create()),
      );
      return true;
    },
    Enter: chainCommands(
      splitListItem(schema.nodes.list_item),
      splitListItem(schema.nodes.check_item),
    ),
    Tab: listIndent(),
    "Shift-Tab": listIndent(true),
    "Alt-ArrowUp": () => {
      const s = selected();
      if (s) moveBlock(s.index, s.index - 1);
      return true;
    },
    "Alt-ArrowDown": () => {
      const s = selected();
      if (s) moveBlock(s.index, s.index + 1);
      return true;
    },
    "Mod-Shift-k": () => {
      openPalette();
      return true;
    },
  };
  const rules = [];
  if (allowed("heading"))
    rules.push(
      textblockTypeInputRule(/^(#{1,3})\s$/, schema.nodes.heading, (m) => ({
        level: m[1].length,
      })),
    );
  if (allowed("bullet_list"))
    rules.push(wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list));
  if (allowed("ordered_list"))
    rules.push(
      wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (m) => ({
        order: Number(m[1]),
      })),
    );
  if (allowed("blockquote"))
    rules.push(wrappingInputRule(/^>\s$/, schema.nodes.blockquote));
  if (allowed("code_block"))
    rules.push(textblockTypeInputRule(/^```$/, schema.nodes.code_block));
  const plugins = [
    createSlashMenuPlugin(choices),
    inputRules({ rules }),
    keymap(keys),
    keymap(baseKeymap),
    history(),
    dropCursor(),
    gapCursor(),
    new Plugin({
      appendTransaction(transactions, _old, state) {
        if (!transactions.some((t) => t.docChanged)) return null;
        const ids = new Set<string>(),
          fields = new Set<string>(),
          tr = state.tr;
        state.doc.descendants((n, pos) => {
          const a = { ...n.attrs };
          let changed = false;
          if ("id" in a) {
            if (!a.id || ids.has(a.id)) {
              a.id = newId();
              changed = true;
            }
            ids.add(a.id);
          }
          for (const key of (n.type.spec.uniqueAttributes || []) as string[]) {
            const identity = `${n.type.name}.${key}:${a[key]}`;
            if (!a[key] || fields.has(identity)) {
              a[key] = newId();
              changed = true;
            }
            fields.add(`${n.type.name}.${key}:${a[key]}`);
          }
          if (changed) tr.setNodeMarkup(pos, undefined, a);
        });
        return tr.docChanged ? tr : null;
      },
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];
          state.doc.descendants((n, pos) => {
            if (n.isTextblock && !n.content.size)
              decorations.push(
                Decoration.node(pos, pos + n.nodeSize, {
                  "data-placeholder":
                    options.placeholder ||
                    "내용을 입력하거나 '/'로 블록을 추가하세요.",
                }),
              );
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
  ];
  const view = new EditorView(surface, {
    state: EditorState.create({
      schema,
      doc: schema.nodeFromJSON(data.content),
      plugins,
    }),
    attributes: {
      class: "cms-content",
      "aria-label": "콘텐츠 편집",
      role: "textbox",
      "aria-multiline": "true",
    },
    nodeViews: {
      image: atomicView,
      toggle(node) {
        const dom = el("details", "cms-toggle");
        dom.open = true;
        const summary = el("summary", "", node.attrs.title);
        summary.contentEditable = "false";
        const contentDOM = el("div");
        dom.append(summary, contentDOM);
        return { dom, contentDOM };
      },
      check_item(node, editor, getPos) {
        let current = node;
        const dom = el("li", "cms-check-item"),
          check = el("input"),
          contentDOM = el("div");
        check.type = "checkbox";
        check.checked = node.attrs.checked;
        check.contentEditable = "false";
        check.setAttribute("aria-label", "완료 표시");
        check.addEventListener("change", () => {
          const pos = getPos();
          if (typeof pos === "number")
            editor.dispatch(
              editor.state.tr.setNodeMarkup(pos, undefined, {
                ...current.attrs,
                checked: check.checked,
              }),
            );
        });
        dom.append(check, contentDOM);
        return {
          dom,
          contentDOM,
          stopEvent: (event) => event.target === check,
          update(next) {
            if (next.type !== current.type) return false;
            current = next;
            check.checked = next.attrs.checked;
            return true;
          },
        };
      },
      ...Object.fromEntries(
        extensions.filter((e) => e.nodeView).map((e) => [e.name, e.nodeView!]),
      ),
      ...options.nodeViews,
    },
    dispatchTransaction(transaction) {
      const next = view.state.applyTransaction(transaction);
      view.updateState(next.state);
      if (next.transactions.some((t) => t.docChanged)) emit();
      updateUI();
    },
    handleClickOn(editor, _pos, node, nodePos, _event, direct) {
      if (direct && node.isAtom && node.isBlock) {
        editor.dispatch(
          editor.state.tr.setSelection(
            NodeSelection.create(editor.state.doc, nodePos),
          ),
        );
        return true;
      }
      return false;
    },
    transformPasted(slice) {
      const normalized = normalizeNodeIds(
        schema.nodes.doc.create(null, slice.content),
        schema,
      );
      return new (slice.constructor as typeof import("prosemirror-model").Slice)(
        normalized.content,
        slice.openStart,
        slice.openEnd,
      );
    },
    handlePaste(_editor, event) {
      const files = Array.from(event.clipboardData?.files || []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        insert("image");
        void upload(files[0]);
        return true;
      }
      return false;
    },
  });
  blockHandles = createBlockHandles({
    view,
    container: surface,
    select: selectBlock,
    move: moveBlock,
    duplicate,
    remove,
    settings: () => inspectorUI.open("block"),
    beforeMenu: () => inspectorUI.close(),
  });
  async function upload(file: File) {
    const cur = selected();
    if (!cur || cur.node.type !== "image") return;
    const id = String(cur.node.attrs!.id);
    if (!options.uploadImage) {
      error(
        new Error(
          "이 서비스에는 이미지 업로드가 연결되지 않았습니다. 이미지 주소를 입력해주세요.",
        ),
      );
      return;
    }
    if (
      !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
        file.type,
      ) ||
      file.size > 5 * 1024 * 1024
    ) {
      error(new Error("5MB 이하의 PNG, JPEG, GIF, WebP 파일을 선택하세요."));
      return;
    }
    notice.textContent = "이미지 업로드 중…";
    try {
      const result = await options.uploadImage(file, controller.signal);
      if (!destroyed) {
        if (!safeURL(result.src, true))
          throw new Error("업로드한 이미지 주소가 올바르지 않습니다.");
        applyAttributes(id, { src: result.src, alt: result.alt || file.name });
        notice.textContent = "이미지를 추가했습니다.";
      }
    } catch (reason) {
      if (!destroyed) error(reason);
    }
  }
  function paintInspector(cur: SelectedBlock | null) {
    inspector.replaceChildren();
    if (!cur) {
      inspector.append(el("p", "cms-help", "블록을 선택해주세요."));
      return;
    }
    const n = cur.node,
      a = n.attrs || {},
      id = String(a.id);
    inspector.append(
      el("h2", "cms-inspector-title", "블록 설정"),
      el(
        "p",
        "cms-help",
        choices.find(
          (c) =>
            c.type === n.type &&
            Object.entries(c.attrs || {}).every(
              ([key, value]) => a[key] === value,
            ),
        )?.label ||
          extensions.find((e) => e.name === n.type)?.label ||
          n.type,
      ),
    );
    const change = (patch: Record<string, unknown>) => {
      try {
        applyAttributes(id, patch);
        notice.textContent = "";
      } catch (reason) {
        error(reason);
      }
    };
    const input = (key: string, label: string, kind = "text") => {
      const wrap = el("label", "cms-setting"),
        caption = el("span", "", label);
      const control = kind === "textarea" ? el("textarea") : el("input");
      if (control instanceof HTMLInputElement) control.type = kind;
      control.value = String(a[key] ?? "");
      control.setAttribute("aria-label", label);
      control.addEventListener("change", () =>
        change({
          [key]:
            kind === "number"
              ? control.value === ""
                ? null
                : Number(control.value)
              : control.value,
        }),
      );
      wrap.append(caption, control);
      inspector.append(wrap);
    };
    if (n.type === "image") {
      const file = el("input");
      file.type = "file";
      file.accept = "image/png,image/jpeg,image/gif,image/webp";
      file.setAttribute("aria-label", "이미지 파일");
      file.disabled = !options.uploadImage;
      file.addEventListener("change", () => {
        if (file.files?.[0]) void upload(file.files[0]);
      });
      inspector.append(file);
      input("src", "이미지 주소");
      input("alt", "대체 텍스트");
      input("caption", "캡션");
      input("width", "너비 (%)", "number");
    }
    if (n.type === "toggle") input("title", "접기 제목");
    if (!["image", "toggle"].includes(n.type))
      inspector.append(
        el(
          "p",
          "cms-help",
          extensions.find((e) => e.name === n.type)?.inspectorHint ||
            "본문을 클릭해 직접 편집하세요.",
        ),
      );
    const actions = el("div", "cms-block-actions");
    actions.append(
      button(
        options.labels?.up || "블록 위로",
        () => moveBlock(cur.index, cur.index - 1),
        "↑ 위로",
      ),
      button(
        "블록 아래로",
        () => moveBlock(cur.index, cur.index + 1),
        "↓ 아래로",
      ),
      button("블록 복제", duplicate, "복제"),
      button("블록 삭제", remove, "삭제"),
    );
    inspector.append(actions);
  }
  function updateUI() {
    const cur = selected(),
      key = JSON.stringify(cur);
    if (key !== inspectorKey) {
      inspectorKey = key;
      paintInspector(cur);
      options.onSelection?.(cur);
    }
    inspectorUI.refresh();
    blockHandles?.update();
    undoButton.disabled = undoDepth(view.state) === 0;
    redoButton.disabled = redoDepth(view.state) === 0;
    for (const [name, b] of markButtons) {
      const mark = schema.marks[name],
        s = view.state.selection;
      const active = s.empty
        ? !!mark.isInSet(view.state.storedMarks || s.$from.marks())
        : view.state.doc.rangeHasMark(s.from, s.to, mark);
      b.setAttribute("aria-pressed", String(active));
    }
    const parent = view.state.selection.$from.parent;
    format.value =
      parent.type.name === "heading"
        ? `heading:${parent.attrs.level}`
        : parent.type.name;
  }
  updateUI();
  return {
    view,
    getDocument,
    insert,
    selectBlock,
    moveBlock,
    duplicate,
    remove,
    openPalette,
    openInspector: inspectorUI.open,
    closeInspector() {
      inspectorUI.close();
      blockHandles?.close();
    },
    setInspectorMode: inspectorUI.setMode,
    uploadImage: upload,
    updateBlock(patch: Record<string, unknown>) {
      const s = selected();
      if (s) applyAttributes(String(s.node.attrs!.id), patch);
    },
    setTitle(title: string) {
      if (title.length > 500)
        throw new Error("제목은 500자 이하로 입력하세요.");
      data = { ...data, title };
      emit();
    },
    setDocument(value: CMSDocument) {
      const nextDocument = parseDocument(value, options.extensions);
      palette?.close();
      inspectorUI.close();
      blockHandles?.close();
      data = nextDocument;
      view.updateState(
        EditorState.create({
          schema,
          doc: schema.nodeFromJSON(data.content),
          plugins,
        }),
      );
      inspectorKey = "";
      updateUI();
    },
    importHTML(html: string) {
      const container = document.createElement("div");
      container.innerHTML = html;
      container
        .querySelectorAll("script,style,iframe,object,embed")
        .forEach((n) => n.remove());
      const doc = normalizeNodeIds(
        PMParser.fromSchema(schema).parse(container),
        schema,
      );
      const next = parseDocument(
        { ...data, content: doc.toJSON() },
        options.extensions,
      );
      this.setDocument(next);
      emit();
    },
    undo() {
      run(undo);
    },
    redo() {
      run(redo);
    },
    focus() {
      view.focus();
    },
    getSelected: selected,
    destroy() {
      destroyed = true;
      controller.abort();
      palette?.close();
      inspectorUI.destroy();
      blockHandles?.destroy();
      view.destroy();
      shell.remove();
    },
  };
}
export type EditorInstance = ReturnType<typeof createEditor>;
