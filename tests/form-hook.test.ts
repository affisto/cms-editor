// @vitest-environment jsdom
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  useCMSForm,
  type UseCMSFormOptions,
} from "../packages/editor-form/src/use-form";
import { createDocument } from "../packages/editor-core/src/document";
import { fieldBlock } from "../packages/editor-form/src/templates";
let root: Root | undefined;
let current: ReturnType<typeof useCMSForm>;
function Harness(props: UseCMSFormOptions) {
  current = useCMSForm(props);
  return null;
}
function render(props: UseCMSFormOptions) {
  if (!root) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  act(() => root!.render(React.createElement(Harness, props)));
}
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});
describe("consumer-owned form state", () => {
  it("retains answers across equivalent document objects and validates before submission", async () => {
    const field = fieldBlock("text", "Name", { required: true }),
      key = String(field.attrs!.fieldId);
    const doc = createDocument("Form", [field]),
      save = vi.fn();
    render({
      document: doc,
      onSubmit: save,
      initialAnswers: { [key]: "Initial" },
    });
    expect(current.answers[key]).toBe("Initial");
    act(() => current.setAnswer(key, "Edited"));
    render({ document: structuredClone(doc), onSubmit: save });
    expect(current.answers[key]).toBe("Edited");
    act(() => current.setAnswer(key, ""));
    await act(async () => current.submit());
    expect(save).not.toHaveBeenCalled();
    expect(current.errors[key]).toContain("필수");
    act(() => current.setAnswer(key, "Consumer"));
    await act(async () => current.submit());
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].answers[key]).toBe("Consumer");
    expect(current.status).toBe("success");
  });
  it("prevents duplicate submissions and aborts the request when the document is replaced", async () => {
    const field = fieldBlock("text", "Name"),
      key = String(field.attrs!.fieldId);
    const doc = createDocument("Form", [field]);
    let release!: () => void;
    let signal!: AbortSignal;
    const save = vi.fn((_value, abort) => {
      signal = abort;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    render({ document: doc, onSubmit: save });
    act(() => {
      void current.submit();
      void current.submit();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(current.status).toBe("pending");
    const replacement = { ...doc, title: "Another revision" };
    render({
      document: replacement,
      onSubmit: save,
      initialAnswers: { [key]: "Restored" },
    });
    expect(signal.aborted).toBe(true);
    expect(current.status).toBe("idle");
    expect(current.answers[key]).toBe("Restored");
    await act(async () => {
      release();
      await Promise.resolve();
    });
    expect(current.status).toBe("idle");
  });
});
