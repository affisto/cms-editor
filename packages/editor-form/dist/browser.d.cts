import * as cms_editor_core from 'cms-editor-core';
import { RenderOptions, CMSDocument, ExtensionKit } from 'cms-editor-core';
import * as prosemirror_model from 'prosemirror-model';
import { Node } from 'prosemirror-model';
import { EditorView, NodeView } from 'prosemirror-view';
import { S as Submission, A as Answers } from './document-CWl_8tbw.cjs';

/** Native controls remain mounted while ProseMirror stores their attributes and history. */
declare function createFieldView(initial: Node, view: EditorView, getPos: () => number | undefined): NodeView;

/** Keep the label input mounted so editing and IME composition retain their caret. */
declare function createSubmitView(initial: Node, view: EditorView, getPos: () => number | undefined): NodeView;

interface FormOptions extends RenderOptions {
    document: CMSDocument;
    onSubmit: (submission: Submission, signal: AbortSignal) => Promise<void> | void;
    successMessage?: string;
}
declare function mountForm(host: HTMLElement, options: FormOptions): {
    getAnswers: () => Answers;
    destroy(): void;
};

declare const FormField: {
    nodeView: typeof createFieldView;
    name: string;
    label: string;
    spec: prosemirror_model.NodeSpec;
    validate?: (attrs: Record<string, unknown>) => void;
    menu?: false | cms_editor_core.BlockMenuItem[];
    renderHTML?: (node: cms_editor_core.JSONNode, context: cms_editor_core.BlockRenderContext) => string;
    uniqueAttributes?: string[];
    inspectorHint?: string;
};
declare const SubmitButton: {
    nodeView: typeof createSubmitView;
    name: string;
    label: string;
    spec: prosemirror_model.NodeSpec;
    validate?: (attrs: Record<string, unknown>) => void;
    menu?: false | cms_editor_core.BlockMenuItem[];
    renderHTML?: (node: cms_editor_core.JSONNode, context: cms_editor_core.BlockRenderContext) => string;
    uniqueAttributes?: string[];
    inspectorHint?: string;
};
declare const FormKit: ExtensionKit;

export { FormField, FormKit, type FormOptions, SubmitButton, mountForm };
