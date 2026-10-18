"use client";
import * as React from "react";
import { mountForm, type FormOptions } from "./forms";
export { FormKit, FormField, SubmitButton } from "./browser";
export function CMSForm(props: FormOptions & { className?: string }) {
  const host = React.useRef<HTMLDivElement>(null),
    latest = React.useRef(props);
  latest.current = props;
  const id = React.useId();
  React.useEffect(() => {
    if (!host.current) return;
    const form = mountForm(host.current, {
      ...latest.current,
      idPrefix: id,
      onSubmit: (submission, signal) =>
        latest.current.onSubmit(submission, signal),
    });
    return () => form.destroy();
  }, [props.document, id]);
  return <div ref={host} className={props.className} />;
}
export type { FormOptions };
export { useCMSForm, type UseCMSFormOptions } from "./use-form";
