import * as react_jsx_runtime from 'react/jsx-runtime';
import { FormOptions } from './browser.js';
export { FormField, FormKit, SubmitButton } from './browser.js';
import { CMSDocument, Extension } from 'cms-editor-core';
import { A as Answers, S as Submission } from './document-CWl_8tbw.js';
import 'prosemirror-model';
import 'prosemirror-view';

interface UseCMSFormOptions {
    document: CMSDocument;
    extensions?: Extension[];
    initialAnswers?: Answers;
    onSubmit: (submission: Submission, signal: AbortSignal) => Promise<void> | void;
}
/** State and validation only: the consuming application owns every rendered component. */
declare function useCMSForm(options: UseCMSFormOptions): {
    document: CMSDocument;
    answers: Answers;
    errors: Record<string, string>;
    status: "error" | "idle" | "pending" | "success";
    error: string;
    setAnswer: (fieldId: string, value: string | string[]) => void;
    submit: (event?: {
        preventDefault: () => void;
    }) => Promise<void>;
};

declare function CMSForm(props: FormOptions & {
    className?: string;
}): react_jsx_runtime.JSX.Element;

export { CMSForm, FormOptions, type UseCMSFormOptions, useCMSForm };
