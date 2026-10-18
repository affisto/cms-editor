import { BlockExtension, ExtensionKit, JSONNode, CMSDocument } from 'cms-editor-core';
export { A as Answers, S as Submission, c as collectFields, a as createSubmission, v as validateAnswers } from './document-CWl_8tbw.cjs';

declare const FormField: BlockExtension;
declare const SubmitButton: BlockExtension;
/** Pure schema/validation/render definitions, safe to use on the server. */
declare const FormKit: ExtensionKit;

type FieldKind = "text" | "textarea" | "email" | "number" | "radio" | "checkbox" | "select";
declare const fieldKinds: FieldKind[];
declare function validateFieldAttributes(a: Record<string, unknown>): void;

declare function fieldBlock(kind?: FieldKind, label?: string, attrs?: Record<string, unknown>): JSONNode;
declare function formTemplate(): CMSDocument;

export { type FieldKind, FormField, FormKit, SubmitButton, fieldBlock, fieldKinds, formTemplate, validateFieldAttributes };
