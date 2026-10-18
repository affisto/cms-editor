import { FormField as Field, SubmitButton as Submit } from "./kit";
import { createFieldView } from "./field-view";
import { createSubmitView } from "./submit-view";
import type { ExtensionKit } from "cms-editor-core";
export const FormField = { ...Field, nodeView: createFieldView };
export const SubmitButton = { ...Submit, nodeView: createSubmitView };
export const FormKit: ExtensionKit = {
  name: "form",
  extensions: [FormField, SubmitButton],
};
export * from "./forms";
