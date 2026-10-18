import {
  FormField,
  FormKit,
  SubmitButton,
  collectFields,
  createSubmission,
  validateAnswers,
  validateFieldAttributes
} from "./chunk-ZE57S57O.js";

// src/field-view.ts
import { NodeSelection } from "prosemirror-state";
import { closeHistory, undo, redo } from "prosemirror-history";
var labels = {
  text: "\uC9E7\uC740 \uB2F5\uBCC0",
  textarea: "\uAE34 \uB2F5\uBCC0",
  email: "\uC774\uBA54\uC77C",
  number: "\uC22B\uC790",
  radio: "\uD558\uB098 \uC120\uD0DD",
  checkbox: "\uC5EC\uB7EC \uAC1C \uC120\uD0DD",
  select: "\uB4DC\uB86D\uB2E4\uC6B4"
};
function element(tag, cls, text = "") {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
}
function createFieldView(initial, view, getPos) {
  let current = initial, writing = false;
  const composing = /* @__PURE__ */ new Set(), controls = /* @__PURE__ */ new Map();
  const dom = element("div", "cms-atomic cms-field-editor");
  dom.contentEditable = "false";
  dom.draggable = true;
  const top = element("div", "cms-inline-field-heading"), kind = element(
    "span",
    "cms-field-kind",
    labels[current.attrs.kind] || "\uC9C8\uBB38"
  );
  const requiredLabel = element("label", "cms-inline-required"), required = element("input", "");
  required.type = "checkbox";
  required.setAttribute("aria-label", "\uD544\uC218 \uC9C8\uBB38");
  requiredLabel.append(required, element("span", "", "\uD544\uC218"));
  top.append(kind, requiredLabel);
  dom.append(top);
  const status = element("p", "cms-inline-error");
  status.setAttribute("role", "alert");
  const choiceList = element("div", "cms-inline-options");
  const add = element("button", "cms-inline-add", "+ \uC120\uD0DD\uC9C0 \uCD94\uAC00");
  add.type = "button";
  const choiceInputs = [];
  function select() {
    const pos = getPos();
    if (pos === void 0 || view.isDestroyed) return;
    if (!(view.state.selection instanceof NodeSelection) || view.state.selection.from !== pos)
      view.dispatch(
        view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta("addToHistory", false)
      );
  }
  function commit(patch, showError = false) {
    const pos = getPos();
    if (pos === void 0 || view.isDestroyed) return false;
    const attrs = { ...current.attrs, ...patch };
    try {
      validateFieldAttributes(attrs);
      if (Object.entries(patch).every(
        ([key, value]) => JSON.stringify(current.attrs[key]) === JSON.stringify(value)
      )) {
        status.textContent = "";
        return true;
      }
      writing = true;
      view.dispatch(view.state.tr.setNodeMarkup(pos, void 0, attrs));
      status.textContent = "";
      return true;
    } catch (error) {
      if (showError)
        status.textContent = error instanceof Error ? error.message : "\uC785\uB825 \uB0B4\uC6A9\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.";
      return false;
    } finally {
      writing = false;
    }
  }
  function resize(control) {
    if (control instanceof HTMLTextAreaElement) {
      control.style.height = "auto";
      control.style.height = `${Math.max(24, control.scrollHeight + 2)}px`;
    }
  }
  function connect(control, patch, stored) {
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
    control.addEventListener("keydown", (event) => {
      if (event.isComposing || composing.has(control)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")) {
        event.preventDefault();
        const command = event.shiftKey || event.key.toLowerCase() === "y" ? redo : undo;
        command(view.state, view.dispatch);
      }
    });
  }
  function text(key, label, placeholder, cls, multiline = false) {
    const control = multiline ? element("textarea", cls) : element("input", cls);
    if (control instanceof HTMLTextAreaElement) control.rows = 1;
    else control.type = "text";
    control.setAttribute("aria-label", label);
    control.placeholder = placeholder;
    control.maxLength = 5e3;
    control.value = String(current.attrs[key] ?? "");
    controls.set(key, control);
    connect(
      control,
      () => ({ [key]: control.value }),
      () => String(current.attrs[key] ?? "")
    );
    dom.append(control);
    return control;
  }
  text("label", "\uC9C8\uBB38 \uC81C\uBAA9", "\uC9C8\uBB38\uC744 \uC785\uB825\uD558\uC138\uC694", "cms-inline-title", true);
  text("help", "\uB3C4\uC6C0\uB9D0", "\uB3C4\uC6C0\uB9D0 \uCD94\uAC00", "cms-inline-help", true);
  const isChoice = () => ["radio", "checkbox", "select"].includes(current.attrs.kind);
  if (isChoice()) {
    dom.append(choiceList, add);
  }
  if (!isChoice() || current.attrs.kind === "select")
    text(
      "placeholder",
      "\uC785\uB825 \uC548\uB0B4",
      current.attrs.kind === "select" ? "\uC120\uD0DD\uD574\uC8FC\uC138\uC694" : "\uC785\uB825 \uC548\uB0B4\uB97C \uC791\uC131\uD558\uC138\uC694",
      "cms-inline-placeholder" + (current.attrs.kind === "textarea" ? " cms-inline-long" : ""),
      current.attrs.kind === "textarea"
    );
  if (current.attrs.kind === "number") {
    const range = element("div", "cms-inline-range");
    for (const [key, label] of [
      ["min", "\uCD5C\uC19F\uAC12"],
      ["max", "\uCD5C\uB313\uAC12"]
    ]) {
      const wrap = element("label", ""), control = element("input", "");
      control.type = "number";
      control.setAttribute("aria-label", label);
      control.placeholder = "\uC81C\uD55C \uC5C6\uC74C";
      controls.set(key, control);
      connect(
        control,
        () => ({ [key]: control.value === "" ? null : Number(control.value) }),
        () => String(current.attrs[key] ?? "")
      );
      wrap.append(element("span", "", label), control);
      range.append(wrap);
    }
    dom.append(range);
  }
  dom.append(status);
  function paintChoices() {
    const values = current.attrs.options;
    if (choiceInputs.length !== values.length) {
      choiceList.replaceChildren();
      choiceInputs.length = 0;
      values.forEach((_value, index) => {
        const row = element("div", "cms-inline-option"), symbol = element(
          "span",
          "cms-inline-choice-symbol",
          current.attrs.kind === "radio" ? "\u25CB" : current.attrs.kind === "checkbox" ? "\u25A1" : `${index + 1}.`
        ), input = element("input", ""), remove = element("button", "cms-inline-option-remove", "\xD7");
        symbol.setAttribute("aria-hidden", "true");
        input.type = "text";
        input.maxLength = 1e3;
        input.setAttribute("aria-label", `\uC120\uD0DD\uC9C0 ${index + 1}`);
        input.placeholder = "\uC120\uD0DD\uC9C0 \uC785\uB825";
        remove.type = "button";
        remove.setAttribute("aria-label", `\uC120\uD0DD\uC9C0 ${index + 1} \uC0AD\uC81C`);
        remove.disabled = values.length === 1;
        connect(
          input,
          () => ({
            options: current.attrs.options.map(
              (v, i) => i === index ? input.value : v
            )
          }),
          () => current.attrs.options[index] || ""
        );
        remove.addEventListener("click", () => {
          select();
          view.dispatch(closeHistory(view.state.tr));
          if (commit(
            {
              options: current.attrs.options.filter(
                (_, i) => i !== index
              )
            },
            true
          ))
            choiceInputs[Math.min(index, choiceInputs.length - 1)]?.focus();
        });
        row.append(symbol, input, remove);
        choiceList.append(row);
        choiceInputs.push(input);
      });
    }
    choiceInputs.forEach((input, index) => {
      if (!(writing && input === document.activeElement) && !composing.has(input) && input.value !== values[index])
        input.value = values[index];
    });
    add.disabled = values.length >= 100;
  }
  function sync() {
    dom.dataset.blockId = current.attrs.id;
    dom.dataset.fieldKind = current.attrs.kind;
    required.checked = current.attrs.required;
    for (const [key, control] of controls) {
      if (!(writing && control === document.activeElement) && !composing.has(control)) {
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
    const values = current.attrs.options;
    let n = values.length + 1;
    while (values.includes(`\uC120\uD0DD\uC9C0 ${n}`)) n++;
    view.dispatch(closeHistory(view.state.tr));
    if (commit({ options: [...values, `\uC120\uD0DD\uC9C0 ${n}`] }, true)) {
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
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
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
    stopEvent: (event) => event.target instanceof Element && !!event.target.closest("input,textarea,button,label"),
    update(node) {
      if (node.type !== current.type || node.attrs.kind !== current.attrs.kind)
        return false;
      const changed = !node.eq(current);
      current = node;
      if (changed) sync();
      return true;
    }
  };
}

// src/submit-view.ts
import { NodeSelection as NodeSelection2 } from "prosemirror-state";
import { closeHistory as closeHistory2, undo as undo2, redo as redo2 } from "prosemirror-history";
function createSubmitView(initial, view, getPos) {
  let current = initial, writing = false, composing = false;
  const dom = document.createElement("div");
  dom.className = "cms-atomic cms-submit-editor";
  dom.contentEditable = "false";
  dom.draggable = true;
  const controls = document.createElement("div");
  controls.className = "cms-submit-alignment";
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "\uBC84\uD2BC \uC815\uB82C");
  const row = document.createElement("div");
  row.className = "cms-submit-row";
  const shell = document.createElement("label");
  shell.className = "cms-primary cms-submit-label";
  const measure = document.createElement("span");
  measure.setAttribute("aria-hidden", "true");
  const input = document.createElement("input");
  input.type = "text";
  input.size = 1;
  input.setAttribute("aria-label", "\uBC84\uD2BC \uBB38\uAD6C");
  input.placeholder = "\uBC84\uD2BC \uBB38\uAD6C";
  input.draggable = false;
  const status = document.createElement("p");
  status.className = "cms-inline-error";
  status.setAttribute("role", "alert");
  shell.append(measure, input);
  row.append(shell);
  dom.append(controls, row, status);
  function select() {
    const pos = getPos();
    if (pos === void 0 || view.isDestroyed) return;
    if (!(view.state.selection instanceof NodeSelection2) || view.state.selection.from !== pos)
      view.dispatch(
        view.state.tr.setSelection(NodeSelection2.create(view.state.doc, pos)).setMeta("addToHistory", false)
      );
  }
  function commit(patch, separate = false) {
    const pos = getPos();
    if (pos === void 0 || view.isDestroyed) return;
    if (Object.entries(patch).every(
      ([key, value]) => current.attrs[key] === value
    ))
      return;
    writing = true;
    try {
      let tr = view.state.tr.setNodeMarkup(pos, void 0, {
        ...current.attrs,
        ...patch
      });
      if (separate) tr = closeHistory2(tr);
      view.dispatch(tr);
    } finally {
      writing = false;
    }
  }
  const alignments = [
    ["left", "\uC67C\uCABD \uC815\uB82C", "M4 5h16M4 10h10M4 15h16M4 20h10"],
    ["center", "\uAC00\uC6B4\uB370 \uC815\uB82C", "M4 5h16M7 10h10M4 15h16M7 20h10"],
    ["right", "\uC624\uB978\uCABD \uC815\uB82C", "M4 5h16M10 10h10M4 15h16M10 20h10"]
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
        String(button.dataset.align === current.attrs.align)
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
    view.dispatch(closeHistory2(view.state.tr));
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
      status.textContent = "\uBC84\uD2BC \uBB38\uAD6C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.";
    }
    dom.draggable = true;
  });
  input.addEventListener("keydown", (event) => {
    if (event.isComposing || composing) return;
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
      event.preventDefault();
      (event.shiftKey || key === "y" ? redo2 : undo2)(view.state, view.dispatch);
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
    stopEvent: (event) => event.target instanceof Element && !!event.target.closest("input,button,label"),
    update(node) {
      if (node.type !== current.type) return false;
      current = node;
      sync();
      return true;
    }
  };
}

// src/forms.ts
import {
  newId,
  parseDocument,
  renderHTML
} from "cms-editor-core";
function mountForm(host, options) {
  const extensions = options.extensions || [FormKit];
  const doc = parseDocument(options.document, extensions), form = document.createElement("form"), controller = new AbortController();
  let destroyed = false, pending = false;
  form.className = "cms-form";
  form.noValidate = true;
  form.innerHTML = renderHTML(doc, {
    ...options,
    extensions,
    interactive: true,
    idPrefix: options.idPrefix || newId()
  });
  if (!form.querySelector("[type=submit]")) {
    const button = document.createElement("button");
    button.type = "submit";
    button.className = "cms-primary cms-submit";
    button.textContent = "\uC81C\uCD9C\uD558\uAE30";
    form.append(button);
  }
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.className = "cms-form-status";
  form.append(status);
  host.append(form);
  function getAnswers() {
    const answers = /* @__PURE__ */ Object.create(null);
    for (const field of collectFields(doc)) {
      const key = String(field.attrs.fieldId), controls = Array.from(
        form.querySelectorAll("[data-cms-answer]")
      ).filter((e) => e.dataset.cmsAnswer === key);
      if (field.attrs.kind === "checkbox")
        answers[key] = controls.filter((e) => e.checked).map((e) => e.value);
      else if (field.attrs.kind === "radio")
        answers[key] = controls.find((e) => e.checked)?.value || "";
      else answers[key] = controls[0]?.value || "";
    }
    return answers;
  }
  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const answers = getAnswers(), errors = validateAnswers(doc, answers);
    for (const el of form.querySelectorAll("[data-cms-error]"))
      el.textContent = errors[el.dataset.cmsError] || "";
    for (const el of form.querySelectorAll("[data-cms-answer]"))
      el.setAttribute("aria-invalid", String(!!errors[el.dataset.cmsAnswer]));
    if (Object.keys(errors).length) {
      status.textContent = "\uC785\uB825 \uB0B4\uC6A9\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.";
      form.querySelector("[aria-invalid=true]")?.focus();
      return;
    }
    pending = true;
    status.textContent = "\uC81C\uCD9C \uC911\u2026";
    form.setAttribute("aria-busy", "true");
    const controls = Array.from(
      form.querySelectorAll(
        "input,select,textarea,button"
      )
    );
    controls.forEach((e) => e.disabled = true);
    try {
      await options.onSubmit(createSubmission(doc, answers), controller.signal);
      if (!destroyed) {
        status.textContent = options.successMessage || "\uC751\uB2F5\uC774 \uC81C\uCD9C\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAC10\uC0AC\uD569\uB2C8\uB2E4.";
        form.dataset.submitted = "true";
      }
    } catch (error) {
      if (!destroyed) {
        status.textContent = error instanceof Error ? error.message : "\uC81C\uCD9C\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.";
        controls.forEach((e) => e.disabled = false);
      }
    } finally {
      pending = false;
      if (!destroyed) form.removeAttribute("aria-busy");
    }
  }
  form.addEventListener("submit", submit);
  return {
    getAnswers,
    destroy() {
      destroyed = true;
      controller.abort();
      form.removeEventListener("submit", submit);
      form.remove();
    }
  };
}

// src/browser.ts
var FormField2 = { ...FormField, nodeView: createFieldView };
var SubmitButton2 = { ...SubmitButton, nodeView: createSubmitView };
var FormKit2 = {
  name: "form",
  extensions: [FormField2, SubmitButton2]
};

export {
  mountForm,
  FormField2 as FormField,
  SubmitButton2 as SubmitButton,
  FormKit2 as FormKit
};
