import { Fragment, type Node as PMNode } from "prosemirror-model";
import {
  NodeSelection,
  Selection,
  TextSelection,
  type Command,
} from "prosemirror-state";
import { closeHistory } from "prosemirror-history";
import { liftListItem, sinkListItem } from "prosemirror-schema-list";
import type { EditorView } from "prosemirror-view";
import { newId } from "./document";

/** Tab belongs to list editing even when the first item cannot be indented. */
export function listIndent(outdent = false): Command {
  return (state, dispatch, view) => {
    // A click can move the browser caret before its asynchronous selectionchange
    // reaches ProseMirror. Read it before Tab acts on the previously selected item.
    if (view?.hasFocus() && state.selection instanceof TextSelection) {
      const native = view.dom.ownerDocument.getSelection();
      if (
        native?.anchorNode &&
        native.focusNode &&
        view.dom.contains(native.anchorNode) &&
        view.dom.contains(native.focusNode)
      ) {
        const selection = TextSelection.between(
          state.doc.resolve(
            view.posAtDOM(native.anchorNode, native.anchorOffset),
          ),
          state.doc.resolve(
            view.posAtDOM(native.focusNode, native.focusOffset),
          ),
        );
        if (!selection.eq(state.selection))
          state = state.apply(
            state.tr.setSelection(selection).setMeta("addToHistory", false),
          );
      }
    }
    const command = outdent ? liftListItem : sinkListItem;
    for (const name of ["list_item", "check_item"]) {
      if (
        command(state.schema.nodes[name])(
          state,
          dispatch ? (tr) => dispatch(closeHistory(tr)) : undefined,
          view,
        )
      )
        return true;
    }
    const { $from } = state.selection;
    for (let depth = $from.depth; depth > 0; depth--)
      if (
        ["bullet_list", "ordered_list", "checklist"].includes(
          $from.node(depth).type.name,
        )
      )
        return true;
    return false;
  };
}

/** List handles act on an item, including its nested content, rather than the whole list. */
export function selectListItem(view: EditorView, pos: number) {
  view.dispatch(
    view.state.tr
      .setSelection(NodeSelection.create(view.state.doc, pos))
      .setMeta("addToHistory", false),
  );
}
export function moveListItem(view: EditorView, pos: number, to: number) {
  const $pos = view.state.doc.resolve(pos),
    parent = $pos.parent;
  const from = $pos.index();
  if (from === to || to < 0 || to >= parent.childCount) return;
  const items: PMNode[] = [];
  parent.forEach((item) => items.push(item));
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
  const start = $pos.start();
  const tr = closeHistory(view.state.tr).replaceWith(
    start,
    $pos.end(),
    Fragment.fromArray(items),
  );
  const target =
    start + items.slice(0, to).reduce((size, node) => size + node.nodeSize, 0);
  view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, target)));
}
export function duplicateListItem(view: EditorView, pos: number) {
  const item = view.state.doc.nodeAt(pos);
  if (!item) return;
  const copy = (node: PMNode): PMNode =>
    node.isText
      ? node
      : node.type.create(
          {
            ...node.attrs,
            ...(node.type.spec.attrs?.id ? { id: newId() } : {}),
            ...Object.fromEntries(
              ((node.type.spec.uniqueAttributes || []) as string[]).map(
                (key) => [key, newId()],
              ),
            ),
          },
          Fragment.fromArray(
            Array.from({ length: node.childCount }, (_, i) =>
              copy(node.child(i)),
            ),
          ),
          node.marks,
        );
  const at = pos + item.nodeSize;
  const tr = closeHistory(view.state.tr).insert(at, copy(item));
  view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, at)));
}
export function removeListItem(view: EditorView, pos: number) {
  const $pos = view.state.doc.resolve(pos),
    item = view.state.doc.nodeAt(pos);
  if (!item) return;
  const tr = closeHistory(view.state.tr);
  if ($pos.parent.childCount > 1) tr.delete(pos, pos + item.nodeSize);
  else {
    // A list cannot be empty. Remove its wrapper, or leave a paragraph if required.
    const depth = $pos.depth,
      parent = $pos.node(depth - 1),
      index = $pos.index(depth - 1);
    const from = $pos.before(depth),
      to = $pos.after(depth);
    if (parent.canReplace(index, index + 1)) tr.delete(from, to);
    else
      tr.replaceWith(
        from,
        to,
        view.state.schema.nodes.paragraph.create({ id: newId() }),
      );
  }
  view.dispatch(
    tr.setSelection(
      Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))),
    ),
  );
  view.focus();
}
