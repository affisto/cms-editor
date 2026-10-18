import type { Node as PMNode } from "prosemirror-model";
import { NodeSelection } from "prosemirror-state";
import { closeHistory, undo, redo } from "prosemirror-history";
import type { EditorView, NodeView } from "prosemirror-view";
import { validateFieldAttributes } from "./schema";

type Control = HTMLInputElement | HTMLTextAreaElement;
const labels: Record<string, string> = {
  text: "짧은 답변",
  textarea: "긴 답변",
  email: "이메일",
  number: "숫자",
  radio: "하나 선택",
  checkbox: "여러 개 선택",
  select: "드롭다운",
};
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text = "",
) {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
}

/** Native controls remain mounted while ProseMirror stores their attributes and history. */
export function createFieldView(
  initial: PMNode,
  view: EditorView,
  getPos: () => number | undefined,
): NodeView {
  let current = initial,
    writing = false;
  const composing = new Set<Control>(),
    controls = new Map<string, Control>();
  const dom = element("div", "cms-atomic cms-field-editor");
  dom.contentEditable = "false";
  dom.draggable = true;
  const top = element("div", "cms-inline-field-heading"),
    kind = element(
      "span",
      "cms-field-kind",
      labels[current.attrs.kind] || "질문",
    );
  const requiredLabel = element("label", "cms-inline-required"),
    required = element("input", "");
  required.type = "checkbox";
  required.setAttribute("aria-label", "필수 질문");
  requiredLabel.append(required, element("span", "", "필수"));
  top.append(kind, requiredLabel);
  dom.append(top);
  const status = element("p", "cms-inline-error");
  status.setAttribute("role", "alert");
  const choiceList = element("div", "cms-inline-options");
  const add = element("button", "cms-inline-add", "+ 선택지 추가");
  add.type = "button";
  const choiceInputs: HTMLInputElement[] = [];
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
  function commit(patch: Record<string, unknown>, showError = false) {
    const pos = getPos();
    if (pos === undefined || view.isDestroyed) return false;
    const attrs = { ...current.attrs, ...patch };
    try {
      validateFieldAttributes(attrs);
      if (
        Object.entries(patch).every(
          ([key, value]) =>
            JSON.stringify(current.attrs[key]) === JSON.stringify(value),
        )
      ) {
        status.textContent = "";
        return true;
      }
      writing = true;
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, attrs));
      status.textContent = "";
      return true;
    } catch (error) {
      if (showError)
        status.textContent =
          error instanceof Error ? error.message : "입력 내용을 확인해주세요.";
      return false;
    } finally {
      writing = false;
    }
  }
  function resize(control: Control) {
    if (control instanceof HTMLTextAreaElement) {
      control.style.height = "auto";
      control.style.height = `${Math.max(24, control.scrollHeight + 2)}px`;
    }
  }
  function connect(
    control: Control,
    patch: () => Record<string, unknown>,
    stored: () => string,
  ) {
    control.draggable = false;
    const update = (showError = false) => {
      if (composing.has(control)) return;
      const valid = commit(patch(), showError);
      control.setAttribute("aria-invalid", String(!valid));
      resize(control);
      return valid;
    };
    control.addEventListener("focus", () => {
      select();
      view.dispatch(closeHistory(view.state.tr));
      dom.draggable = false;
    });
    control.addEventListener("input", () => update());
    control.addEventListener("compositionstart", () => composing.add(control));
    control.addEventListener("compositionend", () => {
      composing.delete(control);
      update();
    });
    control.addEventListener("blur", () => {
      if (!composing.has(control) && update(true) === false) {
        control.value = stored();
        control.setAttribute("aria-invalid", "false");
        resize(control);
      }
      queueMicrotask(() => {
        if (!dom.contains(document.activeElement)) dom.draggable = true;
      });
    });
    (control as HTMLElement).addEventListener("keydown", (event) => {
      if (event.isComposing || composing.has(control)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (
        mod &&
        (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")
      ) {
        event.preventDefault();
        const command =
          event.shiftKey || event.key.toLowerCase() === "y" ? redo : undo;
        command(view.state, view.dispatch);
      }
    });
  }
  function text(
    key: string,
    label: string,
    placeholder: string,
    cls: string,
    multiline = false,
  ) {
    const control = multiline
      ? element("textarea", cls)
      : element("input", cls);
    if (control instanceof HTMLTextAreaElement) control.rows = 1;
    else control.type = "text";
    control.setAttribute("aria-label", label);
    control.placeholder = placeholder;
    control.maxLength = 5000;
    control.value = String(current.attrs[key] ?? "");
    controls.set(key, control);
    connect(
      control,
      () => ({ [key]: control.value }),
      () => String(current.attrs[key] ?? ""),
    );
    dom.append(control);
    return control;
  }
  text("label", "질문 제목", "질문을 입력하세요", "cms-inline-title", true);
  text("help", "도움말", "도움말 추가", "cms-inline-help", true);
  const isChoice = () =>
    ["radio", "checkbox", "select"].includes(current.attrs.kind);
  if (isChoice()) {
    dom.append(choiceList, add);
  }
  if (!isChoice() || current.attrs.kind === "select")
    text(
      "placeholder",
      "입력 안내",
      current.attrs.kind === "select"
        ? "선택해주세요"
        : "입력 안내를 작성하세요",
      "cms-inline-placeholder" +
        (current.attrs.kind === "textarea" ? " cms-inline-long" : ""),
      current.attrs.kind === "textarea",
    );
  if (current.attrs.kind === "number") {
    const range = element("div", "cms-inline-range");
    for (const [key, label] of [
      ["min", "최솟값"],
      ["max", "최댓값"],
    ]) {
      const wrap = element("label", ""),
        control = element("input", "");
      control.type = "number";
      control.setAttribute("aria-label", label);
      control.placeholder = "제한 없음";
      controls.set(key, control);
      connect(
        control,
        () => ({ [key]: control.value === "" ? null : Number(control.value) }),
        () => String(current.attrs[key] ?? ""),
      );
      wrap.append(element("span", "", label), control);
      range.append(wrap);
    }
    dom.append(range);
  }
  dom.append(status);
  function paintChoices() {
    const values = current.attrs.options as string[];
    if (choiceInputs.length !== values.length) {
      choiceList.replaceChildren();
      choiceInputs.length = 0;
      values.forEach((_value, index) => {
        const row = element("div", "cms-inline-option"),
          symbol = element(
            "span",
            "cms-inline-choice-symbol",
            current.attrs.kind === "radio"
              ? "○"
              : current.attrs.kind === "checkbox"
                ? "□"
                : `${index + 1}.`,
          ),
          input = element("input", ""),
          remove = element("button", "cms-inline-option-remove", "×");
        symbol.setAttribute("aria-hidden", "true");
        input.type = "text";
        input.maxLength = 1000;
        input.setAttribute("aria-label", `선택지 ${index + 1}`);
        input.placeholder = "선택지 입력";
        remove.type = "button";
        remove.setAttribute("aria-label", `선택지 ${index + 1} 삭제`);
        remove.disabled = values.length === 1;
        connect(
          input,
          () => ({
            options: (current.attrs.options as string[]).map((v, i) =>
              i === index ? input.value : v,
            ),
          }),
          () => current.attrs.options[index] || "",
        );
        remove.addEventListener("click", () => {
          select();
          view.dispatch(closeHistory(view.state.tr));
          if (
            commit(
              {
                options: (current.attrs.options as string[]).filter(
                  (_, i) => i !== index,
                ),
              },
              true,
            )
          )
            choiceInputs[Math.min(index, choiceInputs.length - 1)]?.focus();
        });
        row.append(symbol, input, remove);
        choiceList.append(row);
        choiceInputs.push(input);
      });
    }
    choiceInputs.forEach((input, index) => {
      if (
        !(writing && input === document.activeElement) &&
        !composing.has(input) &&
        input.value !== values[index]
      )
        input.value = values[index];
    });
    add.disabled = values.length >= 100;
  }
  function sync() {
    dom.dataset.blockId = current.attrs.id;
    dom.dataset.fieldKind = current.attrs.kind;
    required.checked = current.attrs.required;
    for (const [key, control] of controls) {
      if (
        !(writing && control === document.activeElement) &&
        !composing.has(control)
      ) {
        const value = String(current.attrs[key] ?? "");
        if (control.value !== value) control.value = value;
      }
      resize(control);
    }
    if (isChoice()) paintChoices();
  }
  required.addEventListener("focus", select);
  required.addEventListener("change", () => {
    view.dispatch(closeHistory(view.state.tr));
    commit({ required: required.checked }, true);
  });
  add.addEventListener("click", () => {
    select();
    const values = current.attrs.options as string[];
    let n = values.length + 1;
    while (values.includes(`선택지 ${n}`)) n++;
    view.dispatch(closeHistory(view.state.tr));
    if (commit({ options: [...values, `선택지 ${n}`] }, true)) {
      const last = choiceInputs[choiceInputs.length - 1];
      last?.focus();
      last?.select();
    }
  });
  sync();
  let lastWidth = 0;
  const resizeControls = () => {
    for (const control of controls.values()) resize(control);
  };
  const frame = requestAnimationFrame(resizeControls);
  const observer =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          if (dom.clientWidth !== lastWidth) {
            lastWidth = dom.clientWidth;
            resizeControls();
          }
        });
  observer?.observe(dom);
  return {
    destroy() {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    },
    dom,
    ignoreMutation: () => true,
    stopEvent: (event) =>
      event.target instanceof Element &&
      !!event.target.closest("input,textarea,button,label"),
    update(node) {
      if (node.type !== current.type || node.attrs.kind !== current.attrs.kind)
        return false;
      const changed = !node.eq(current);
      current = node;
      if (changed) sync();
      return true;
    },
  };
}
