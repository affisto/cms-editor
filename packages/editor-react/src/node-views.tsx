import * as React from "react";
import { createPortal } from "react-dom";
import type { NodeViewConstructor } from "prosemirror-view";
import { NodeSelection } from "prosemirror-state";
import { closeHistory, undo, redo } from "prosemirror-history";
import { parseDocument, type Extension } from "cms-editor-core";

export interface BlockViewProps {
  attrs: Readonly<Record<string, unknown>>;
  selected: boolean;
  updateAttributes: (patch: Record<string, unknown>) => boolean;
}
export type BlockComponents = Record<
  string,
  React.ComponentType<BlockViewProps>
>;
/** Portals retain the host's providers. Components are for atomic (leaf) blocks. */
export function createComponentViews(
  components: BlockComponents,
  extensions: Extension[] | undefined,
  publish: (portals: React.ReactPortal[]) => void,
  onError?: (error: Error) => void,
) {
  const portals = new Map<HTMLElement, React.ReactPortal>();
  let active = true,
    scheduled = false;
  const notify = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (active) publish([...portals.values()]);
    });
  };
  const nodeViews: Record<string, NodeViewConstructor> = {};
  for (const [name, Component] of Object.entries(components))
    nodeViews[name] = (initial, view, getPos) => {
      if (!initial.isAtom || !initial.isLeaf)
        throw new Error(
          `React 블록 컴포넌트는 leaf atom이어야 합니다: ${name}`,
        );
      let node = initial,
        selected = false,
        alive = true;
      const dom = document.createElement("div");
      dom.className = "cms-component-block";
      dom.contentEditable = "false";
      const updateAttributes = (patch: Record<string, unknown>) => {
        const pos = getPos();
        if (!alive || view.isDestroyed || pos === undefined) return false;
        try {
          // IDs belong to the document, not to an individual component's input controls.
          const attrs: Record<string, unknown> = {
            ...node.attrs,
            ...patch,
            id: node.attrs.id,
          };
          for (const key of (node.type.spec.uniqueAttributes || []) as string[])
            attrs[key] = node.attrs[key];
          if (JSON.stringify(attrs) === JSON.stringify(node.attrs)) return true;
          const tr = view.state.tr.setNodeMarkup(pos, undefined, attrs);
          parseDocument(
            {
              schemaVersion: 1,
              id: "component-validation",
              title: "",
              content: tr.doc.toJSON(),
            },
            extensions,
          );
          view.dispatch(tr);
          return true;
        } catch (reason) {
          onError?.(
            reason instanceof Error ? reason : new Error(String(reason)),
          );
          return false;
        }
      };
      const paint = () => {
        dom.dataset.blockId = node.attrs.id;
        portals.set(
          dom,
          createPortal(
            <Component
              attrs={structuredClone(node.attrs)}
              selected={selected}
              updateAttributes={updateAttributes}
            />,
            dom,
            String(node.attrs.id),
          ),
        );
        notify();
      };
      dom.addEventListener("focusin", () => {
        const pos = getPos();
        if (pos === undefined) return;
        view.dispatch(
          closeHistory(view.state.tr)
            .setSelection(NodeSelection.create(view.state.doc, pos))
            .setMeta("addToHistory", false),
        );
      });
      dom.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        const key = event.key.toLowerCase();
        if ((event.metaKey || event.ctrlKey) && ["z", "y"].includes(key)) {
          event.preventDefault();
          (event.shiftKey || key === "y" ? redo : undo)(
            view.state,
            view.dispatch,
          );
        }
      });
      paint();
      return {
        dom,
        ignoreMutation: () => true,
        stopEvent: () => true,
        update(next) {
          if (next.type !== node.type) return false;
          node = next;
          paint();
          return true;
        },
        selectNode() {
          selected = true;
          paint();
        },
        deselectNode() {
          selected = false;
          paint();
        },
        destroy() {
          alive = false;
          portals.delete(dom);
          notify();
        },
      };
    };
  return {
    nodeViews,
    destroy() {
      active = false;
      portals.clear();
    },
  };
}
