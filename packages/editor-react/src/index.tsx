"use client";
import * as React from "react";
import { createComponentViews, type BlockComponents } from "./node-views";
export type { BlockViewProps, BlockComponents } from "./node-views";
import {
  createEditor,
  type EditorInstance,
  type EditorOptions,
} from "cms-editor-core/browser";
import {
  renderHTML,
  type CMSDocument,
  type RenderOptions,
} from "cms-editor-core";
export interface CMSEditorProps
  extends Omit<EditorOptions, "inspectorElement"> {
  className?: string;
  components?: BlockComponents;
  inspectorRef?: React.RefObject<HTMLElement>;
  onReady?: (editor: EditorInstance) => void;
}
/** Extensions and allowedBlocks are mount-time configuration; change the key to reconfigure. */
export const CMSEditor = React.forwardRef<EditorInstance, CMSEditorProps>(
  function CMSEditor(props, ref) {
    const host = React.useRef<HTMLDivElement>(null),
      instance = React.useRef<EditorInstance | null>(null),
      latest = React.useRef(props),
      initial = React.useRef(props);
    const [portals, setPortals] = React.useState<React.ReactPortal[]>([]);
    latest.current = props;
    React.useEffect(() => {
      if (!host.current) return;
      const bridge = createComponentViews(
        initial.current.components || {},
        initial.current.extensions,
        setPortals,
        (error) => latest.current.onError?.(error),
      );
      const editor = createEditor(host.current, {
        ...initial.current,
        nodeViews: { ...initial.current.nodeViews, ...bridge.nodeViews },
        inspectorElement: initial.current.inspectorRef?.current || undefined,
        onChange: (doc) => latest.current.onChange?.(doc),
        onSelection: (selection) => latest.current.onSelection?.(selection),
        onError: (error) => latest.current.onError?.(error),
        uploadImage: initial.current.uploadImage
          ? (file, signal) => latest.current.uploadImage!(file, signal)
          : undefined,
      });
      instance.current = editor;
      if (typeof ref === "function") ref(editor);
      else if (ref) ref.current = editor;
      latest.current.onReady?.(editor);
      return () => {
        bridge.destroy();
        editor.destroy();
        instance.current = null;
        if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
      };
    }, [ref]);
    React.useEffect(() => {
      instance.current?.setInspectorMode(
        props.inspectorMode ||
          (initial.current.inspectorRef?.current ? "inline" : "popover"),
      );
    }, [props.inspectorMode]);
    React.useEffect(() => {
      const editor = instance.current;
      if (
        editor &&
        JSON.stringify(editor.getDocument()) !== JSON.stringify(props.document)
      )
        editor.setDocument(props.document);
    }, [props.document]);
    return (
      <>
        <div className={props.className} ref={host} />
        {portals}
      </>
    );
  },
);
export interface CMSRendererProps extends RenderOptions {
  document: CMSDocument;
  className?: string;
}
export function CMSRenderer({
  document: doc,
  className,
  ...options
}: CMSRendererProps) {
  const id = React.useId();
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{
        __html: renderHTML(doc, {
          ...options,
          idPrefix: options.idPrefix || id,
        }),
      }}
    />
  );
}
export type { EditorInstance, EditorOptions };
