"use client";
import {
  FormField,
  FormKit as FormKit2,
  SubmitButton,
  mountForm
} from "./chunk-WXSWGEHG.js";
import {
  FormKit,
  createSubmission,
  validateAnswers
} from "./chunk-ZE57S57O.js";

// src/react.tsx
import * as React2 from "react";

// src/use-form.ts
import * as React from "react";
import {
  parseDocument
} from "cms-editor-core";
function useCMSForm(options) {
  const latest = React.useRef(options);
  latest.current = options;
  const signature = JSON.stringify(options.document);
  const doc = React.useMemo(
    () => parseDocument(JSON.parse(signature), options.extensions || [FormKit]),
    [signature, options.extensions]
  );
  const [answers, setAnswers] = React.useState(
    () => structuredClone(options.initialAnswers || {})
  );
  const [errors, setErrors] = React.useState({});
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState("");
  const controller = React.useRef(null);
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
  const setAnswer = (fieldId, value) => {
    if (controller.current || status === "success") return;
    const next = {
      ...current.current,
      [fieldId]: Array.isArray(value) ? [...value] : value
    };
    current.current = next;
    setAnswers(next);
    setErrors((previous) => {
      const next2 = { ...previous };
      delete next2[fieldId];
      return next2;
    });
  };
  const submit = async (event) => {
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
        request.signal
      );
      if (!request.signal.aborted) setStatus("success");
    } catch (reason) {
      if (!request.signal.aborted) {
        setStatus("error");
        setError(
          reason instanceof Error ? reason.message : "\uC81C\uCD9C\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."
        );
      }
    } finally {
      if (controller.current === request) controller.current = null;
    }
  };
  return { document: doc, answers, errors, status, error, setAnswer, submit };
}

// src/react.tsx
import { jsx } from "react/jsx-runtime";
function CMSForm(props) {
  const host = React2.useRef(null), latest = React2.useRef(props);
  latest.current = props;
  const id = React2.useId();
  React2.useEffect(() => {
    if (!host.current) return;
    const form = mountForm(host.current, {
      ...latest.current,
      idPrefix: id,
      onSubmit: (submission, signal) => latest.current.onSubmit(submission, signal)
    });
    return () => form.destroy();
  }, [props.document, id]);
  return /* @__PURE__ */ jsx("div", { ref: host, className: props.className });
}
export {
  CMSForm,
  FormField,
  FormKit2 as FormKit,
  SubmitButton,
  useCMSForm
};
