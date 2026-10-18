import { createEditor } from "cms-editor-core/browser";
import { mountForm, FormKit } from "cms-editor-form/browser";
import { formTemplate } from "cms-editor-form";
import {
  parseDocument,
  type BlockExtension,
  type CMSDocument,
} from "cms-editor-core";
import "cms-editor-core/style.css";
import "cms-editor-form/style.css";
import "./style.css";
// A consumer-owned block: its own schema, defaults, HTML output, and validation.
const callout: BlockExtension = {
  name: "callout",
  label: "알림 상자",
  spec: {
    content: "inline*",
    attrs: { tone: { default: "info" } },
    toDOM: () => ["aside", { class: "callout" }, 0],
  },
  validate(attrs) {
    if (attrs.tone !== "info")
      throw new Error("지원하지 않는 알림 종류입니다.");
  },
};
let doc: CMSDocument = formTemplate();
const stored = localStorage.getItem("cms-editor:vanilla");
const status = document.querySelector<HTMLElement>("#status")!;
try {
  if (stored) doc = parseDocument(stored, [FormKit, callout]);
} catch {
  status.textContent = "저장 문서가 올바르지 않습니다. 예제로 시작합니다.";
}
const host = document.querySelector<HTMLElement>("#editor")!,
  formHost = document.querySelector<HTMLElement>("#form")!;
const editor = createEditor(host, {
  document: doc,
  extensions: [FormKit, callout],
  onChange: (value) => {
    doc = value;
  },
  onError: (error) => {
    status.textContent = error.message;
  },
});
let form: ReturnType<typeof mountForm> | undefined;
document.querySelector("#preview")!.addEventListener("click", () => {
  editor.closeInspector();
  form?.destroy();
  host.hidden = true;
  formHost.hidden = false;
  form = mountForm(formHost, {
    document: doc,
    extensions: [FormKit, callout],
    onSubmit: (submission) => {
      localStorage.setItem(
        "cms-editor:vanilla-response",
        JSON.stringify(submission),
      );
    },
  });
});
document.querySelector("#edit")!.addEventListener("click", () => {
  form?.destroy();
  form = undefined;
  host.hidden = false;
  formHost.hidden = true;
});
document.querySelector("#save")!.addEventListener("click", () => {
  try {
    localStorage.setItem("cms-editor:vanilla", JSON.stringify(doc));
    status.textContent = "저장했습니다.";
  } catch {
    status.textContent = "저장하지 못했습니다.";
  }
});
window.addEventListener("pagehide", () => {
  editor.destroy();
  form?.destroy();
});
