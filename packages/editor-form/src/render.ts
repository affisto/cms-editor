import type { BlockRenderContext, JSONNode } from "cms-editor-core";
export function renderFormBlock(
  n: JSONNode,
  context: BlockRenderContext,
): string {
  const { idPrefix: prefix, interactive } = context;
  const options = { interactive };
  const escape = context.escapeHTML;
  const a = n.attrs || {};
  switch (n.type) {
    case "submit":
      return options.interactive
        ? `<div class="cms-submit-row" style="text-align:${a.align}"><button class="cms-primary cms-submit" type="submit">${escape(a.label)}</button></div>`
        : "";
    case "field": {
      const id = `${prefix}-${a.fieldId}`,
        errorId = `${id}-error`,
        helpId = `${id}-help`;
      const attrs = `data-cms-answer="${escape(a.fieldId)}" aria-describedby="${escape(helpId)} ${escape(errorId)}" ${a.required ? 'aria-required="true"' : ""} ${options.interactive ? "" : "disabled"}`;
      const label = `${escape(a.label)}${a.required ? ' <span class="cms-required" aria-hidden="true">*</span>' : ""}`;
      const help = `<p class="cms-help" id="${escape(helpId)}">${escape(a.help)}</p>`;
      const error = `<p class="cms-error" id="${escape(errorId)}" data-cms-error="${escape(a.fieldId)}" aria-live="polite"></p>`;
      let control = "";
      if (a.kind === "radio" || a.kind === "checkbox") {
        control = (a.options as string[])
          .map(
            (v, i) =>
              `<label class="cms-choice"><input type="${a.kind}" name="${escape(id)}" id="${escape(id)}-${i}" value="${escape(v)}" ${attrs}> <span>${escape(v)}</span></label>`,
          )
          .join("");
        return `<fieldset class="cms-field"><legend>${label}</legend>${help}${control}${error}</fieldset>`;
      }
      if (a.kind === "textarea")
        control = `<textarea id="${escape(id)}" placeholder="${escape(a.placeholder)}" ${attrs} rows="4"></textarea>`;
      else if (a.kind === "select")
        control = `<select id="${escape(id)}" ${attrs}><option value="">${escape(a.placeholder || "선택해주세요")}</option>${(a.options as string[]).map((v) => `<option value="${escape(v)}">${escape(v)}</option>`).join("")}</select>`;
      else
        control = `<input id="${escape(id)}" type="${a.kind === "number" ? "text" : a.kind}" ${a.kind === "number" ? 'inputmode="decimal"' : ""} placeholder="${escape(a.placeholder)}" ${attrs}>`;
      return `<div class="cms-field"><label for="${escape(id)}">${label}</label>${help}${control}${error}</div>`;
    }
  }
  return "";
}
