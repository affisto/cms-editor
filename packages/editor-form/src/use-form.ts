import * as React from "react";
import {
  parseDocument,
  type CMSDocument,
  type Extension,
} from "cms-editor-core";
import { FormKit } from "./kit";
import {
  validateAnswers,
  createSubmission,
  type Answers,
  type Submission,
} from "./document";
export interface UseCMSFormOptions {
  document: CMSDocument;
  extensions?: Extension[];
  initialAnswers?: Answers;
  onSubmit: (
    submission: Submission,
    signal: AbortSignal,
  ) => Promise<void> | void;
}
/** State and validation only: the consuming application owns every rendered component. */
export function useCMSForm(options: UseCMSFormOptions) {
  const latest = React.useRef(options);
  latest.current = options;
  const signature = JSON.stringify(options.document);
  const doc = React.useMemo(
    () => parseDocument(JSON.parse(signature), options.extensions || [FormKit]),
    [signature, options.extensions],
  );
  const [answers, setAnswers] = React.useState<Answers>(() =>
    structuredClone(options.initialAnswers || {}),
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [error, setError] = React.useState("");
  const controller = React.useRef<AbortController | null>(null);
  const current = React.useRef(answers);
  current.current = answers;
  React.useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    const next = structuredClone(latest.current.initialAnswers || {});
    current.current = next;
    setAnswers(next);
    setErrors({});
    setStatus("idle");
    setError("");
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, [signature]);
  const setAnswer = (fieldId: string, value: string | string[]) => {
    if (controller.current || status === "success") return;
    const next = {
      ...current.current,
      [fieldId]: Array.isArray(value) ? [...value] : value,
    };
    current.current = next;
    setAnswers(next);
    setErrors((previous) => {
      const next = { ...previous };
      delete next[fieldId];
      return next;
    });
  };
  const submit = async (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    if (controller.current || status === "success") return;
    const invalid = validateAnswers(doc, current.current);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    const request = new AbortController();
    controller.current = request;
    setStatus("pending");
    setError("");
    try {
      await latest.current.onSubmit(
        createSubmission(doc, current.current),
        request.signal,
      );
      if (!request.signal.aborted) setStatus("success");
    } catch (reason) {
      if (!request.signal.aborted) {
        setStatus("error");
        setError(
          reason instanceof Error ? reason.message : "제출하지 못했습니다.",
        );
      }
    } finally {
      if (controller.current === request) controller.current = null;
    }
  };
  return { document: doc, answers, errors, status, error, setAnswer, submit };
}
