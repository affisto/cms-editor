import type { Node as PMNode } from "prosemirror-model";
import { NodeSelection } from "prosemirror-state";
import { closeHistory, undo, redo } from "prosemirror-history";
import type { EditorView, NodeView } from "prosemirror-view";

/** Keep the label input mounted so editing and IME composition retain their caret. */
export function createSubmitView(
  initial: PMNode,
  view: EditorView,
  getPos: () => number | undefined,
): NodeView {
  let current = initial,
    writing = false,
    composing = false;
  const dom = document.createElement("div");
  dom.className = "cms-atomic cms-submit-editor";
  dom.contentEditable = "false";
  dom.draggable = true;
  const controls = document.createElement("div");
  controls.className = "cms-submit-alignment";
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "버튼 정렬");
  const row = document.createElement("div");
  row.className = "cms-submit-row";
  const shell = document.createElement("label");
  shell.className = "cms-primary cms-submit-label";
  const measure = document.createElement("span");
  measure.setAttribute("aria-hidden", "true");
  const input = document.createElement("input");
  input.type = "text";
  input.size = 1;
  input.setAttribute("aria-label", "버튼 문구");
  input.placeholder = "버튼 문구";
  input.draggable = false;
  const status = document.createElement("p");
  status.className = "cms-inline-error";
  status.setAttribute("role", "alert");
  shell.append(measure, input);
  row.append(shell);
  dom.append(controls, row, status);

  function select() {
    const pos = getPos();
    if (pos === undefined || view.isDestroyed) return;
    if (
      !(view.state.selection instanceof NodeSelection) ||
      view.state.selection.from !== pos
    )
      view.dispatch(
        view.state.tr
          .setSelection(NodeSelection.create(view.state.doc, pos))
          .setMeta("addToHistory", false),
      );
  }
  function commit(patch: Record<string, unknown>, separate = false) {
    const pos = getPos();
    if (pos === undefined || view.isDestroyed) return;
    if (
      Object.entries(patch).every(
        ([key, value]) => current.attrs[key] === value,
      )
    )
      return;
    writing = true;
    try {
      let tr = view.state.tr.setNodeMarkup(pos, undefined, {
        ...current.attrs,
        ...patch,
      });
      if (separate) tr = closeHistory(tr);
      view.dispatch(tr);
    } finally {
      writing = false;
    }
  }
  const alignments = [
    ["left", "왼쪽 정렬", "M4 5h16M4 10h10M4 15h16M4 20h10"],
    ["center", "가운데 정렬", "M4 5h16M7 10h10M4 15h16M7 20h10"],
    ["right", "오른쪽 정렬", "M4 5h16M10 10h10M4 15h16M10 20h10"],
  ];
  for (const [alignment, label, path] of alignments) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.align = alignment;
    button.setAttribute("aria-label", label);
    button.title = label;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(svg.namespaceURI, "path");
    line.setAttribute("d", path);
    svg.append(line);
    button.append(svg);
    button.addEventListener("click", () => {
      select();
      commit({ align: alignment }, true);
    });
    controls.append(button);
  }
  function sync() {
    dom.dataset.blockId = current.attrs.id;
    row.style.textAlign = current.attrs.align;
    if (!writing && !composing) input.value = current.attrs.label;
    measure.textContent = input.value || input.placeholder;
    for (const button of controls.querySelectorAll("button"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.align === current.attrs.align),
      );
  }
  function updateLabel() {
    measure.textContent = input.value || input.placeholder;
    if (composing) return;
    const valid = input.value.trim().length > 0;
    input.setAttribute("aria-invalid", String(!valid));
    status.textContent = "";
    if (valid) commit({ label: input.value });
  }
  input.addEventListener("focus", () => {
    select();
    view.dispatch(closeHistory(view.state.tr));
    dom.draggable = false;
  });
  input.addEventListener("input", updateLabel);
  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    updateLabel();
  });
  input.addEventListener("blur", () => {
    if (!composing && !input.value.trim()) {
      input.value = current.attrs.label;
      measure.textContent = input.value;
      input.setAttribute("aria-invalid", "false");
      status.textContent = "버튼 문구를 입력해주세요.";
    }
    dom.draggable = true;
  });
  input.addEventListener("keydown", (event) => {
    if (event.isComposing || composing) return;
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
      event.preventDefault();
      (event.shiftKey || key === "y" ? redo : undo)(view.state, view.dispatch);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });
  sync();
  return {
    dom,
    ignoreMutation: () => true,
    stopEvent: (event) =>
      event.target instanceof Element &&
      !!event.target.closest("input,button,label"),
    update(node) {
      if (node.type !== current.type) return false;
      current = node;
      sync();
      return true;
    },
  };
}
