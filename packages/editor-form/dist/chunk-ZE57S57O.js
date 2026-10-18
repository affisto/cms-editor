// src/schema.ts
var fieldKinds = [
  "text",
  "textarea",
  "email",
  "number",
  "radio",
  "checkbox",
  "select"
];
function validateFieldAttributes(a) {
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  assert(
    fieldKinds.includes(a.kind),
    "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uC9C8\uBB38 \uC885\uB958\uC785\uB2C8\uB2E4."
  );
  for (const key of ["label", "help", "placeholder"])
    assert(
      typeof a[key] === "string" && String(a[key]).length <= 5e3,
      "\uC9C8\uBB38 \uBB38\uAD6C\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."
    );
  assert(String(a.label).trim().length > 0, "\uC9C8\uBB38 \uC81C\uBAA9\uC744 \uC785\uB825\uD558\uC138\uC694.");
  assert(typeof a.required === "boolean", "\uD544\uC218 \uC5EC\uBD80\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  assert(
    Array.isArray(a.options) && a.options.length <= 100 && a.options.every(
      (x) => typeof x === "string" && x.length > 0 && x.length <= 1e3
    ) && new Set(a.options).size === a.options.length,
    "\uC120\uD0DD\uC9C0\uB294 \uBE44\uC5B4 \uC788\uAC70\uB098 \uC911\uBCF5\uB420 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."
  );
  if (["radio", "checkbox", "select"].includes(String(a.kind)))
    assert(a.options.length > 0, "\uC120\uD0DD\uC9C0\uB97C \uD558\uB098 \uC774\uC0C1 \uC785\uB825\uD558\uC138\uC694.");
  for (const key of ["min", "max"])
    assert(
      a[key] === null || typeof a[key] === "number" && Number.isFinite(a[key]),
      "\uC22B\uC790 \uBC94\uC704\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."
    );
  assert(
    a.min === null || a.max === null || Number(a.min) <= Number(a.max),
    "\uCD5C\uC19F\uAC12\uC740 \uCD5C\uB313\uAC12\uBCF4\uB2E4 \uD074 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."
  );
}
function clipboardField(dom) {
  try {
    const raw = dom.getAttribute("data-cms-attrs") || "";
    if (raw.length > 12e4) return false;
    const a = JSON.parse(raw);
    if (!a || typeof a !== "object" || Array.isArray(a)) return false;
    validateFieldAttributes(a);
    return { ...a, id: null, fieldId: null };
  } catch {
    return false;
  }
}
var identity = { id: { default: null } };
var formNodes = {
  field: {
    attrs: {
      ...identity,
      fieldId: { default: null },
      kind: { default: "text" },
      label: { default: "\uC0C8 \uC9C8\uBB38" },
      help: { default: "" },
      required: { default: false },
      placeholder: { default: "" },
      options: { default: ["\uCCAB \uBC88\uC9F8 \uC120\uD0DD\uC9C0", "\uB450 \uBC88\uC9F8 \uC120\uD0DD\uC9C0"] },
      min: { default: null },
      max: { default: null }
    },
    group: "block",
    atom: true,
    draggable: true,
    parseDOM: [
      {
        tag: "div[data-cms-field][data-cms-attrs]",
        getAttrs: clipboardField
      }
    ],
    toDOM: (n) => [
      "div",
      {
        "data-cms-field": n.attrs.fieldId,
        "data-cms-attrs": JSON.stringify(n.attrs)
      },
      n.attrs.label
    ]
  },
  submit: {
    attrs: {
      ...identity,
      label: { default: "\uC81C\uCD9C\uD558\uAE30" },
      align: { default: "left" }
    },
    group: "block",
    atom: true,
    draggable: true,
    parseDOM: [
      {
        tag: "div[data-cms-submit]",
        getAttrs: (dom) => ({
          label: dom.textContent || "\uC81C\uCD9C\uD558\uAE30",
          align: ["left", "center", "right"].includes(
            dom.getAttribute("data-align") || ""
          ) ? dom.getAttribute("data-align") : "left"
        })
      }
    ],
    toDOM: (n) => [
      "div",
      { "data-cms-submit": "", "data-align": n.attrs.align },
      n.attrs.label
    ]
  }
};

// src/render.ts
function renderFormBlock(n, context) {
  const { idPrefix: prefix, interactive } = context;
  const options = { interactive };
  const escape = context.escapeHTML;
  const a = n.attrs || {};
  switch (n.type) {
    case "submit":
      return options.interactive ? `<div class="cms-submit-row" style="text-align:${a.align}"><button class="cms-primary cms-submit" type="submit">${escape(a.label)}</button></div>` : "";
    case "field": {
      const id = `${prefix}-${a.fieldId}`, errorId = `${id}-error`, helpId = `${id}-help`;
      const attrs = `data-cms-answer="${escape(a.fieldId)}" aria-describedby="${escape(helpId)} ${escape(errorId)}" ${a.required ? 'aria-required="true"' : ""} ${options.interactive ? "" : "disabled"}`;
      const label = `${escape(a.label)}${a.required ? ' <span class="cms-required" aria-hidden="true">*</span>' : ""}`;
      const help = `<p class="cms-help" id="${escape(helpId)}">${escape(a.help)}</p>`;
      const error = `<p class="cms-error" id="${escape(errorId)}" data-cms-error="${escape(a.fieldId)}" aria-live="polite"></p>`;
      let control = "";
      if (a.kind === "radio" || a.kind === "checkbox") {
        control = a.options.map(
          (v, i) => `<label class="cms-choice"><input type="${a.kind}" name="${escape(id)}" id="${escape(id)}-${i}" value="${escape(v)}" ${attrs}> <span>${escape(v)}</span></label>`
        ).join("");
        return `<fieldset class="cms-field"><legend>${label}</legend>${help}${control}${error}</fieldset>`;
      }
      if (a.kind === "textarea")
        control = `<textarea id="${escape(id)}" placeholder="${escape(a.placeholder)}" ${attrs} rows="4"></textarea>`;
      else if (a.kind === "select")
        control = `<select id="${escape(id)}" ${attrs}><option value="">${escape(a.placeholder || "\uC120\uD0DD\uD574\uC8FC\uC138\uC694")}</option>${a.options.map((v) => `<option value="${escape(v)}">${escape(v)}</option>`).join("")}</select>`;
      else
        control = `<input id="${escape(id)}" type="${a.kind === "number" ? "text" : a.kind}" ${a.kind === "number" ? 'inputmode="decimal"' : ""} placeholder="${escape(a.placeholder)}" ${attrs}>`;
      return `<div class="cms-field"><label for="${escape(id)}">${label}</label>${help}${control}${error}</div>`;
    }
  }
  return "";
}

// src/kit.ts
var FormField = {
  name: "field",
  label: "\uC9C8\uBB38",
  spec: formNodes.field,
  uniqueAttributes: ["fieldId"],
  validate: validateFieldAttributes,
  inspectorHint: "\uC9C8\uBB38 \uC81C\uBAA9, \uB3C4\uC6C0\uB9D0, \uC120\uD0DD\uC9C0\uC640 \uD544\uC218 \uC5EC\uBD80\uB294 \uBE14\uB85D\uC5D0\uC11C \uBC14\uB85C \uC218\uC815\uD558\uC138\uC694.",
  menu: [
    {
      label: "\uC9E7\uC740 \uB2F5\uBCC0",
      suggested: true,
      icon: "Aa",
      group: "\uC9C8\uBB38",
      attrs: { kind: "text" }
    },
    { label: "\uAE34 \uB2F5\uBCC0", icon: "\u2261", group: "\uC9C8\uBB38", attrs: { kind: "textarea" } },
    {
      label: "\uC774\uBA54\uC77C",
      suggested: true,
      icon: "@",
      group: "\uC9C8\uBB38",
      attrs: { kind: "email" }
    },
    { label: "\uC22B\uC790", icon: "#", group: "\uC9C8\uBB38", attrs: { kind: "number" } },
    { label: "\uD558\uB098 \uC120\uD0DD", icon: "\u25C9", group: "\uC9C8\uBB38", attrs: { kind: "radio" } },
    {
      label: "\uC5EC\uB7EC \uAC1C \uC120\uD0DD",
      icon: "\u2611",
      group: "\uC9C8\uBB38",
      attrs: { kind: "checkbox" }
    },
    { label: "\uB4DC\uB86D\uB2E4\uC6B4", icon: "\u2304", group: "\uC9C8\uBB38", attrs: { kind: "select" } }
  ],
  renderHTML: renderFormBlock
};
var SubmitButton = {
  name: "submit",
  label: "\uC81C\uCD9C \uBC84\uD2BC",
  spec: formNodes.submit,
  inspectorHint: "\uBC84\uD2BC \uBB38\uAD6C\uC640 \uC815\uB82C\uC740 \uBE14\uB85D\uC5D0\uC11C \uBC14\uB85C \uC218\uC815\uD558\uC138\uC694.",
  menu: [{ label: "\uC81C\uCD9C \uBC84\uD2BC", icon: "\u2197", group: "\uC9C8\uBB38" }],
  validate(attrs) {
    if (typeof attrs.label !== "string" || !attrs.label.trim())
      throw new Error("\uC81C\uCD9C \uBC84\uD2BC \uC774\uB984\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
    if (typeof attrs.align !== "string" || !["left", "center", "right"].includes(attrs.align))
      throw new Error("\uBC84\uD2BC \uC815\uB82C\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  },
  renderHTML: renderFormBlock
};
var FormKit = {
  name: "form",
  extensions: [FormField, SubmitButton]
};

// src/document.ts
function collectFields(doc) {
  const fields = [];
  const walk = (n) => {
    if (n.type === "field") fields.push(n);
    n.content?.forEach(walk);
  };
  walk(doc.content);
  return fields;
}
function validateAnswers(doc, answers) {
  const errors = /* @__PURE__ */ Object.create(null);
  for (const field of collectFields(doc)) {
    const a = field.attrs, key = String(a.fieldId), value = Object.prototype.hasOwnProperty.call(answers, key) ? answers[key] : void 0;
    const missing = value === void 0 || typeof value === "string" && !value.trim() || Array.isArray(value) && value.length === 0;
    if (missing) {
      if (a.required) errors[key] = "\uD544\uC218 \uC9C8\uBB38\uC5D0 \uB2F5\uD574\uC8FC\uC138\uC694.";
      continue;
    }
    if (a.kind === "checkbox") {
      if (!Array.isArray(value) || !value.every((x) => a.options.includes(x)) || new Set(value).size !== value.length)
        errors[key] = "\uC62C\uBC14\uB978 \uC120\uD0DD\uC9C0\uB97C \uC120\uD0DD\uD558\uC138\uC694.";
    } else if (typeof value !== "string")
      errors[key] = "\uC62C\uBC14\uB978 \uB2F5\uBCC0\uC744 \uC785\uB825\uD558\uC138\uC694.";
    else if (value.length > 1e5) errors[key] = "\uB2F5\uBCC0\uC774 \uB108\uBB34 \uAE41\uB2C8\uB2E4.";
    else if (a.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      errors[key] = "\uC774\uBA54\uC77C \uC8FC\uC18C\uB97C \uD655\uC778\uD558\uC138\uC694.";
    else if (["radio", "select"].includes(String(a.kind)) && !a.options.includes(value))
      errors[key] = "\uC62C\uBC14\uB978 \uC120\uD0DD\uC9C0\uB97C \uC120\uD0DD\uD558\uC138\uC694.";
    else if (a.kind === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) errors[key] = "\uC22B\uC790\uB97C \uC785\uB825\uD558\uC138\uC694.";
      else if (a.min !== null && number < Number(a.min))
        errors[key] = `${a.min} \uC774\uC0C1 \uC785\uB825\uD558\uC138\uC694.`;
      else if (a.max !== null && number > Number(a.max))
        errors[key] = `${a.max} \uC774\uD558 \uC785\uB825\uD558\uC138\uC694.`;
    }
  }
  return errors;
}
function createSubmission(doc, answers) {
  if (Object.keys(validateAnswers(doc, answers)).length)
    throw new Error("\uB2F5\uBCC0\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.");
  const clean = /* @__PURE__ */ Object.create(null);
  for (const f of collectFields(doc)) {
    const key = String(f.attrs.fieldId);
    if (Object.prototype.hasOwnProperty.call(answers, key))
      clean[key] = Array.isArray(answers[key]) ? [...answers[key]] : answers[key];
  }
  return { documentId: doc.id, schemaVersion: 1, answers: clean };
}

export {
  fieldKinds,
  validateFieldAttributes,
  FormField,
  SubmitButton,
  FormKit,
  collectFields,
  validateAnswers,
  createSubmission
};
