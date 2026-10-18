import {
  collectFields,
  createSubmission,
  validateAnswers,
  type Answers,
  type Submission,
} from "./document";
import {
  newId,
  parseDocument,
  renderHTML,
  type RenderOptions,
  type CMSDocument,
} from "cms-editor-core";
import { FormKit } from "./kit";
export interface FormOptions extends RenderOptions {
  document: CMSDocument;
  onSubmit: (
    submission: Submission,
    signal: AbortSignal,
  ) => Promise<void> | void;
  successMessage?: string;
}
export function mountForm(host: HTMLElement, options: FormOptions) {
  const extensions = options.extensions || [FormKit];
  const doc = parseDocument(options.document, extensions),
    form = document.createElement("form"),
    controller = new AbortController();
  let destroyed = false,
    pending = false;
  form.className = "cms-form";
  form.noValidate = true;
  form.innerHTML = renderHTML(doc, {
    ...options,
    extensions,
    interactive: true,
    idPrefix: options.idPrefix || newId(),
  });
  if (!form.querySelector("[type=submit]")) {
    const button = document.createElement("button");
    button.type = "submit";
    button.className = "cms-primary cms-submit";
    button.textContent = "제출하기";
    form.append(button);
  }
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.className = "cms-form-status";
  form.append(status);
  host.append(form);
  function getAnswers(): Answers {
    const answers: Answers = Object.create(null);
    for (const field of collectFields(doc)) {
      const key = String(field.attrs!.fieldId),
        controls = Array.from(
          form.querySelectorAll<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          >("[data-cms-answer]"),
        ).filter((e) => e.dataset.cmsAnswer === key);
      if (field.attrs!.kind === "checkbox")
        answers[key] = controls
          .filter((e) => (e as HTMLInputElement).checked)
          .map((e) => e.value);
      else if (field.attrs!.kind === "radio")
        answers[key] =
          controls.find((e) => (e as HTMLInputElement).checked)?.value || "";
      else answers[key] = controls[0]?.value || "";
    }
    return answers;
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (pending) return;
    const answers = getAnswers(),
      errors = validateAnswers(doc, answers);
    for (const el of form.querySelectorAll<HTMLElement>("[data-cms-error]"))
      el.textContent = errors[el.dataset.cmsError!] || "";
    for (const el of form.querySelectorAll<HTMLElement>("[data-cms-answer]"))
      el.setAttribute("aria-invalid", String(!!errors[el.dataset.cmsAnswer!]));
    if (Object.keys(errors).length) {
      status.textContent = "입력 내용을 확인해주세요.";
      form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    pending = true;
    status.textContent = "제출 중…";
    form.setAttribute("aria-busy", "true");
    const controls = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
        "input,select,textarea,button",
      ),
    );
    controls.forEach((e) => (e.disabled = true));
    try {
      await options.onSubmit(createSubmission(doc, answers), controller.signal);
      if (!destroyed) {
        status.textContent =
          options.successMessage || "응답이 제출되었습니다. 감사합니다.";
        form.dataset.submitted = "true";
      }
    } catch (error) {
      if (!destroyed) {
        status.textContent =
          error instanceof Error
            ? error.message
            : "제출하지 못했습니다. 다시 시도해주세요.";
        controls.forEach((e) => (e.disabled = false));
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
    },
  };
}
