import { Plugin, PluginKey, NodeSelection, Selection } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { closeHistory } from "prosemirror-history";
import { newId, normalizeNodeIds } from "./document";
import type { BlockChoice } from "./editor";

type SlashState = { from: number; to: number; query: string; index: number };
type SlashAction = { open?: boolean; close?: boolean; index?: number };
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = "",
) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
function icon(choice: BlockChoice) {
  const wrapper = element("span", "cms-slash-icon");
  wrapper.setAttribute("aria-hidden", "true");
  if (choice.type === "heading") {
    wrapper.textContent = `H${choice.attrs?.level}`;
    return wrapper;
  }
  const paths: Record<string, string> = {
    paragraph: "M5 5h14M12 5v15M8 20h8",
    image: "M4 4h16v16H4zM4 17l5-6 4 4 3-3 4 5M15 8h.01",
    toggle: "M8 5l9 7-9 7z",
    bullet_list: "M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01",
    ordered_list: "M9 6h11M9 12h11M9 18h11M3 4h1v4M3 11h2l-2 3h2M3 17h2v4H3",
    checklist: "M4 4h16v16H4zM7 12l3 3 7-7",
    blockquote: "M5 8h5v7H5V8zm9 0h5v7h-5V8zM10 15l-3 4m12-4-3 4",
    divider: "M3 12h18",
    code_block: "M8 6l-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", paths[choice.type] || "M12 3l9 9-9 9-9-9z");
  svg.append(path);
  wrapper.append(svg);
  return wrapper;
}

/** A transient slash query stays in the document; navigation never moves DOM focus from the editor. */
export function createSlashMenuPlugin(choices: BlockChoice[]) {
  const key = new PluginKey<SlashState | null>("cms-slash-menu");
  const listId = `cms-slash-${newId()}`;
  const all = choices.flatMap((choice) =>
    choice.type === "heading"
      ? [1, 2, 3].map((level) => ({
          ...choice,
          label: `제목 ${level}`,
          attrs: { ...choice.attrs, level },
        }))
      : [choice],
  );
  const suggestions = all.filter(
    (c) => c.suggested || ["image", "toggle"].includes(c.type),
  );
  function groups(query: string) {
    const search = query.trim().toLowerCase();
    const matches = all.filter((c) =>
      `${c.label} ${c.type} ${c.group} ${c.attrs?.kind || ""}`
        .toLowerCase()
        .includes(search),
    );
    return [
      { title: "추천", items: search ? [] : suggestions },
      {
        title: "기본 블록",
        items: matches.filter(
          (c) => c.group === "문서" && (search || !suggestions.includes(c)),
        ),
      },
      {
        title: "폼 블록",
        items: matches.filter(
          (c) => c.group === "질문" && (search || !suggestions.includes(c)),
        ),
      },
    ].filter((g) => g.items.length);
  }
  const matching = (query: string) => groups(query).flatMap((g) => g.items);
  function read(
    state: EditorState,
    from: number,
    index = 0,
  ): SlashState | null {
    const { selection } = state;
    if (
      !selection.empty ||
      selection.$from.parent.type.name !== "paragraph" ||
      selection.$from.start() !== from
    )
      return null;
    const text = selection.$from.parent.textContent;
    if (!text.startsWith("/") || text.length > 100 || selection.from < from + 1)
      return null;
    const query = text.slice(1);
    return {
      from,
      to: from + text.length,
      query,
      index: Math.max(0, Math.min(index, matching(query).length - 1)),
    };
  }
  function dismiss(view: EditorView) {
    if (!view.isDestroyed && key.getState(view.state))
      view.dispatch(view.state.tr.setMeta(key, { close: true }));
  }
  function choose(view: EditorView, index: number) {
    const active = key.getState(view.state);
    if (!active) return;
    const choice = matching(active.query)[index];
    if (!choice) return;
    const type = view.state.schema.nodes[choice.type];
    let node = type.createAndFill({
      ...choice.attrs,
      id: newId(),
      ...Object.fromEntries(
        ((type.spec.uniqueAttributes || []) as string[]).map((key) => [
          key,
          newId(),
        ]),
      ),
    });
    if (!node) return;
    node = normalizeNodeIds(node, view.state.schema);
    const paragraph = view.state.doc.nodeAt(active.from - 1)!;
    const tr = closeHistory(view.state.tr)
      .replaceRangeWith(
        active.from - 1,
        active.from - 1 + paragraph.nodeSize,
        node,
      )
      .setMeta(key, { close: true });
    let position: number | undefined;
    tr.doc.descendants((child, pos) => {
      if (child.attrs.id === node!.attrs.id) {
        position = pos;
        return false;
      }
    });
    if (position !== undefined)
      tr.setSelection(
        node.isAtom
          ? NodeSelection.create(tr.doc, position)
          : Selection.near(tr.doc.resolve(position + 1)),
      );
    view.dispatch(tr.scrollIntoView());
    view.focus();
  }
  return new Plugin<SlashState | null>({
    key,
    state: {
      init: () => null,
      apply(tr, previous, _old, next) {
        const action = tr.getMeta(key) as SlashAction | undefined;
        if (action?.close) return null;
        if (action?.open) return read(next, next.selection.$from.start());
        if (!previous) return null;
        const mapped = tr.mapping.mapResult(previous.from, -1);
        if (mapped.deleted) return null;
        const active = read(next, mapped.pos, action?.index ?? previous.index);
        if (active && active.query !== previous.query) active.index = 0;
        return active;
      },
    },
    props: {
      handleTextInput(view, from, to, text) {
        if (
          text !== "/" ||
          view.composing ||
          from !== to ||
          view.state.selection.$from.parent.type.name !== "paragraph" ||
          view.state.selection.$from.parent.content.size
        )
          return false;
        view.dispatch(
          view.state.tr.insertText("/", from, to).setMeta(key, { open: true }),
        );
        return true;
      },
      handleKeyDown(view, event) {
        const active = key.getState(view.state);
        if (
          !active ||
          event.isComposing ||
          view.composing ||
          event.keyCode === 229
        )
          return false;
        if (event.key === "Escape") {
          dismiss(view);
          return true;
        }
        if (event.key === "Tab") {
          dismiss(view);
          return false;
        }
        if (event.key === "Enter") {
          choose(view, active.index);
          return true;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const count = matching(active.query).length;
          if (count)
            view.dispatch(
              view.state.tr.setMeta(key, {
                index:
                  (active.index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    count) %
                  count,
              }),
            );
          return true;
        }
        return false;
      },
      handleDOMEvents: {
        blur(view) {
          queueMicrotask(() => {
            if (!view.isDestroyed && !view.hasFocus()) dismiss(view);
          });
          return false;
        },
      },
      attributes(state): Record<string, string> {
        const active = key.getState(state);
        return active
          ? {
              "aria-controls": listId,
              "aria-expanded": "true",
              "aria-activedescendant": matching(active.query).length
                ? `${listId}-${active.index}`
                : "",
              "aria-autocomplete": "list",
            }
          : { "aria-expanded": "false" };
      },
      decorations(state) {
        const active = key.getState(state);
        return active
          ? DecorationSet.create(state.doc, [
              Decoration.inline(active.from, active.to, {
                class: "cms-slash-query",
                "data-empty": String(!active.query),
                spellcheck: "false",
              }),
            ])
          : null;
      },
    },
    view(view) {
      let panel: HTMLDivElement | null = null,
        list: HTMLDivElement | null = null,
        renderedQuery: string | null = null,
        renderedIndex = -1;
      const viewport = window.visualViewport;
      function outside(event: PointerEvent) {
        if (panel && !panel.contains(event.target as Node)) dismiss(view);
      }
      function teardown() {
        panel?.remove();
        panel = null;
        list = null;
        renderedQuery = null;
        renderedIndex = -1;
        document.removeEventListener("pointerdown", outside, true);
        window.removeEventListener("resize", position);
        window.removeEventListener("scroll", position, true);
        viewport?.removeEventListener("resize", position);
        viewport?.removeEventListener("scroll", position);
      }
      function position() {
        const active = key.getState(view.state);
        if (!panel || !active) return;
        const caret = view.coordsAtPos(active.from);
        const left = viewport?.offsetLeft || 0,
          top = viewport?.offsetTop || 0,
          right = left + (viewport?.width || innerWidth),
          bottom = top + (viewport?.height || innerHeight);
        if (caret.bottom < top || caret.top > bottom) {
          dismiss(view);
          return;
        }
        const below = bottom - caret.bottom - 16,
          above = caret.top - top - 16,
          down = below >= 220 || below >= above;
        panel.style.width = `${Math.min(326, right - left - 16)}px`;
        panel.style.maxHeight = `${Math.max(0, Math.min(350, down ? below : above))}px`;
        const bounds = panel.getBoundingClientRect();
        panel.style.left = `${Math.max(left + 8, Math.min(caret.left, right - bounds.width - 8))}px`;
        panel.style.top = `${down ? caret.bottom + 8 : caret.top - bounds.height - 8}px`;
      }
      function update() {
        const active = key.getState(view.state);
        if (!active) {
          teardown();
          return;
        }
        if (!panel) {
          panel = element("div", "cms-palette cms-slash-popover");
          panel.setAttribute("popover", "manual");
          panel.setAttribute("role", "dialog");
          panel.setAttribute("aria-label", "블록 추가");
          panel.setAttribute("aria-modal", "false");
          list = element("div", "cms-slash-list");
          list.id = listId;
          list.setAttribute("role", "listbox");
          list.setAttribute("aria-label", "블록");
          const footer = element("button", "cms-slash-footer");
          footer.type = "button";
          footer.tabIndex = -1;
          footer.append(
            element("span", "", "메뉴 닫기"),
            element("kbd", "", "esc"),
          );
          footer.addEventListener("mousedown", (e) => e.preventDefault());
          footer.addEventListener("click", () => {
            dismiss(view);
            view.focus();
          });
          panel.append(list, footer);
          view.dom.parentElement!.append(panel);
          panel.showPopover();
          document.addEventListener("pointerdown", outside, true);
          window.addEventListener("resize", position);
          window.addEventListener("scroll", position, true);
          viewport?.addEventListener("resize", position);
          viewport?.addEventListener("scroll", position);
        }
        if (renderedQuery !== active.query) {
          list!.replaceChildren();
          let index = 0;
          for (const group of groups(active.query)) {
            const section = element("div", "cms-slash-group"),
              heading = element("div", "cms-slash-group-title", group.title);
            heading.id = `${listId}-group-${index}`;
            section.setAttribute("role", "group");
            section.setAttribute("aria-labelledby", heading.id);
            section.append(heading);
            for (const choice of group.items) {
              const itemIndex = index++,
                row = element("button", "cms-slash-option");
              row.type = "button";
              row.tabIndex = -1;
              row.id = `${listId}-${itemIndex}`;
              row.setAttribute("role", "option");
              row.setAttribute("aria-label", `${choice.label} 추가`);
              row.append(
                icon(choice),
                element("span", "cms-slash-label", choice.label),
              );
              const hint =
                choice.type === "heading"
                  ? "#".repeat(Number(choice.attrs?.level))
                  : (
                      {
                        bullet_list: "-",
                        ordered_list: "1.",
                        blockquote: ">",
                      } as Record<string, string>
                    )[choice.type];
              if (hint) row.append(element("span", "cms-slash-hint", hint));
              row.addEventListener("mousedown", (e) => e.preventDefault());
              row.addEventListener("click", () => choose(view, itemIndex));
              row.addEventListener("pointermove", (e) => {
                const current = key.getState(view.state);
                if (
                  e.pointerType !== "touch" &&
                  current &&
                  current.index !== itemIndex
                )
                  view.dispatch(
                    view.state.tr.setMeta(key, { index: itemIndex }),
                  );
              });
              section.append(row);
            }
            list!.append(section);
          }
          if (!index)
            list!.append(
              element("p", "cms-slash-empty", "일치하는 블록이 없습니다."),
            );
          list!.scrollTop = 0;
          renderedQuery = active.query;
          renderedIndex = -1;
        }
        const changed = renderedIndex !== active.index;
        list!
          .querySelectorAll<HTMLElement>("[role=option]")
          .forEach((row, i) =>
            row.setAttribute("aria-selected", String(i === active.index)),
          );
        renderedIndex = active.index;
        position();
        if (changed && list) {
          const row = list.querySelector<HTMLElement>("[aria-selected=true]");
          if (row) {
            const rowBounds = row.getBoundingClientRect(),
              bounds = list.getBoundingClientRect();
            if (rowBounds.top < bounds.top)
              list.scrollTop -= bounds.top - rowBounds.top;
            else if (rowBounds.bottom > bounds.bottom)
              list.scrollTop += rowBounds.bottom - bounds.bottom;
          }
        }
      }
      update();
      return { update, destroy: teardown };
    },
  });
}
