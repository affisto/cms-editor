import type { Node as PMNode } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { newId } from "./document";
import { createDragMotion } from "./drag-motion";
import {
  selectListItem,
  moveListItem,
  duplicateListItem,
  removeListItem,
  listIndent,
} from "./list-actions";

interface Options {
  view: EditorView;
  container: HTMLElement;
  select: (index: number) => void;
  move: (from: number, to: number) => void;
  duplicate: () => void;
  remove: () => void;
  settings: () => void;
  beforeMenu: () => void;
}
interface Entry {
  pos: number;
  parentId: string | null;
  listContainer: boolean;
  id: string;
  index: number;
  node: PMNode;
  element: HTMLElement;
  handle: HTMLButtonElement;
}
interface Press {
  id: string;
  pointerId: number;
  type: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  dragging: boolean;
  longPressed: boolean;
  document: PMNode;
  handle: HTMLButtonElement;
}
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text = "",
) {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
}
function grip() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 12 18");
  svg.setAttribute("aria-hidden", "true");
  for (const x of [3, 9])
    for (const y of [3, 9, 15]) {
      const dot = document.createElementNS(svg.namespaceURI, "circle");
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(y));
      dot.setAttribute("r", "1.35");
      svg.append(dot);
    }
  return svg;
}
/** Handles live outside the editable DOM; a move is one document transaction on drop. */
export function createBlockHandles(options: Options) {
  const { view, container } = options;
  const layer = element("div", "cms-block-handles"),
    line = element("div", "cms-block-drop-line"),
    status = element("div", "cms-handle-status");
  line.hidden = true;
  line.setAttribute("aria-hidden", "true");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  container.classList.add("cms-handle-surface");
  container.append(layer, line, status);
  const handles = new Map<string, HTMLButtonElement>();
  let entries: Entry[] = [];
  let menu: HTMLDivElement | null = null,
    menuId: string | null = null,
    menuFromHover = false,
    press: Press | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined,
    leaveTimer: ReturnType<typeof setTimeout> | undefined,
    holdTimer: ReturnType<typeof setTimeout> | undefined;
  let layoutFrame = 0,
    dragFrame = 0,
    destroyed = false,
    suppressClickUntil = 0,
    lastPointerType = "mouse";
  const viewport = window.visualViewport,
    observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleLayout);
  let tooltip: HTMLDivElement | null = null,
    tooltipTarget: HTMLButtonElement | null = null;
  function hideTooltip() {
    tooltipTarget?.removeAttribute("aria-describedby");
    tooltip?.remove();
    tooltip = null;
    tooltipTarget = null;
  }
  function positionTooltip() {
    if (!tooltip || !tooltipTarget) return;
    const rect = tooltipTarget.getBoundingClientRect(),
      left = viewport?.offsetLeft || 0,
      top = viewport?.offsetTop || 0,
      width = viewport?.width || innerWidth,
      height = viewport?.height || innerHeight;
    tooltip.style.maxWidth = `${width - 16}px`;
    const bounds = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(left + 8, Math.min(rect.left + (rect.width - bounds.width) / 2, left + width - bounds.width - 8))}px`;
    tooltip.style.top = `${rect.top - bounds.height - 8 >= top + 8 ? rect.top - bounds.height - 8 : Math.min(rect.bottom + 8, top + height - bounds.height - 8)}px`;
  }
  function showTooltip(target: HTMLButtonElement, label: string) {
    hideTooltip();
    tooltipTarget = target;
    tooltip = element("div", "cms-menu-tooltip", label);
    tooltip.id = `cms-tip-${newId()}`;
    tooltip.setAttribute("popover", "manual");
    tooltip.setAttribute("role", "tooltip");
    target.setAttribute("aria-describedby", tooltip.id);
    container.append(tooltip);
    tooltip.showPopover();
    positionTooltip();
  }
  let observed = new Set<HTMLElement>();
  let lastDocument = view.state.doc;
  let motionGroup: string | null = null;
  const siblings = (parentId: string | null) =>
    entries.filter((entry) => entry.parentId === parentId);
  const selectEntry = (entry: Entry) =>
    entry.parentId === null
      ? options.select(entry.index)
      : selectListItem(view, entry.pos);
  const moveEntry = (entry: Entry, to: number) =>
    entry.parentId === null
      ? options.move(entry.index, to)
      : moveListItem(view, entry.pos, to);
  const motion = createDragMotion({
    container,
    root: view.dom,
    blocks: () => siblings(motionGroup),
    relayout: () => {
      cancelAnimationFrame(layoutFrame);
      layout();
    },
  });
  const find = (id: string) => entries.find((entry) => entry.id === id);
  const clearHover = () => {
    clearTimeout(hoverTimer);
    clearTimeout(leaveTimer);
    hoverTimer = undefined;
    leaveTimer = undefined;
  };
  function closeMenu(returnFocus = false) {
    clearHover();
    hideTooltip();
    const handle = menuId ? handles.get(menuId) : null;
    menu?.remove();
    menu = null;
    menuId = null;
    handle?.setAttribute("aria-expanded", "false");
    if (returnFocus) handle?.focus({ preventScroll: true });
  }
  function scheduleClose() {
    if (menuFromHover && !press) {
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => closeMenu(), 250);
    }
  }
  function positionMenu() {
    if (!menu || !menuId) return;
    const entry = find(menuId);
    if (!entry) {
      closeMenu();
      return;
    }
    const rect = entry.handle.getBoundingClientRect(),
      left = viewport?.offsetLeft || 0,
      top = viewport?.offsetTop || 0,
      width = viewport?.width || innerWidth,
      height = viewport?.height || innerHeight;
    if (rect.bottom < top || rect.top > top + height) {
      closeMenu();
      return;
    }
    menu.style.maxHeight = `${height - 16}px`;
    menu.style.width = "max-content";
    menu.style.maxWidth = `${width - 16}px`;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - bounds.width - 8))}px`;
    menu.style.top = `${rect.top - bounds.height - 8 >= top + 8 ? rect.top - bounds.height - 8 : Math.max(top + 8, Math.min(rect.bottom + 8, top + height - bounds.height - 8))}px`;
    positionTooltip();
  }
  function openMenu(id: string, focus = false, hover = false) {
    if (destroyed || press?.dragging) return;
    if (hover && view.dom.getAttribute("aria-expanded") === "true") return;
    const entry = find(id);
    if (!entry) return;
    closeMenu();
    options.beforeMenu();
    menuId = id;
    menuFromHover = hover;
    menu = element("div", "cms-block-menu");
    menu.id = `cms-block-menu-${newId()}`;
    menu.setAttribute("popover", "manual");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "블록 작업");
    menu.setAttribute("aria-orientation", "horizontal");
    entry.handle.setAttribute("aria-controls", menu.id);
    entry.handle.setAttribute("aria-expanded", "true");
    const action = (
      label: string,
      icon: string,
      run: (entry: Entry) => void,
      danger = false,
    ) => {
      const item = element(
        "button",
        `cms-block-menu-item${danger ? " cms-block-menu-danger" : ""}`,
      );
      item.type = "button";
      item.tabIndex = -1;
      item.setAttribute("role", "menuitem");
      item.setAttribute("aria-label", label);
      const symbol = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      symbol.setAttribute("viewBox", "0 0 24 24");
      symbol.setAttribute("fill", "none");
      symbol.setAttribute("stroke", "currentColor");
      symbol.setAttribute("stroke-width", "1.6");
      symbol.setAttribute("stroke-linecap", "round");
      symbol.setAttribute("stroke-linejoin", "round");
      symbol.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(symbol.namespaceURI, "path");
      path.setAttribute(
        "d",
        (
          {
            copy: "M8 8h12v12H8zM16 8V4H4v12h4",
            settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-7 0v6",
            delete: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
          } as Record<string, string>
        )[icon],
      );
      symbol.append(path);
      item.append(symbol);
      item.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "mouse") showTooltip(item, label);
      });
      item.addEventListener("pointerleave", () => {
        if (document.activeElement !== item) hideTooltip();
      });
      item.addEventListener("focus", () => showTooltip(item, label));
      item.addEventListener("blur", hideTooltip);
      item.addEventListener("click", () => {
        const target = find(id);
        closeMenu();
        if (target) {
          selectEntry(target);
          run(target);
        }
      });
      menu!.append(item);
    };
    action("복제", "copy", (target) =>
      target.parentId === null
        ? options.duplicate()
        : duplicateListItem(view, target.pos),
    );
    if (["image", "toggle"].includes(entry.node.type.name))
      action("블록 설정", "settings", () => options.settings());
    action(
      "삭제",
      "delete",
      (target) =>
        target.parentId === null
          ? options.remove()
          : removeListItem(view, target.pos),
      true,
    );
    menu.addEventListener("pointerenter", () => {
      clearTimeout(leaveTimer);
    });
    menu.addEventListener("pointerleave", scheduleClose);
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        closeMenu();
        return;
      }
      const items = Array.from(
        menu!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      let next: number | undefined;
      if (event.key === "ArrowRight" || event.key === "ArrowDown")
        next = (index + 1) % items.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        next = (index - 1 + items.length) % items.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = items.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        items[next]?.focus();
      }
    });
    menu.addEventListener("focusout", () =>
      queueMicrotask(() => {
        if (
          menu &&
          !menu.contains(document.activeElement) &&
          document.activeElement !== handles.get(id)
        )
          closeMenu();
      }),
    );
    container.append(menu);
    menu.showPopover();
    positionMenu();
    if (focus)
      menu
        .querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus({ preventScroll: true });
  }
  function layout() {
    layoutFrame = 0;
    if (destroyed) return;
    const origin = container.getBoundingClientRect();
    for (const entry of entries) {
      const rect = motion.rect(entry);
      entry.handle.style.left = `${rect.left - origin.left - (entry.parentId === null ? 34 : 59)}px`;
      entry.handle.style.top = `${rect.top - origin.top}px`;
    }
    positionMenu();
  }
  function scheduleLayout() {
    if (!destroyed && !layoutFrame) layoutFrame = requestAnimationFrame(layout);
  }
  function inside(x: number, y: number) {
    const rect = container.getBoundingClientRect();
    return (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );
  }
  function dropTarget(point: Press) {
    if (!inside(point.x, point.y)) return null;
    const source = find(point.id);
    if (!source) return null;
    const rest = siblings(source.parentId).filter(
      (entry) => entry.id !== point.id,
    );
    let index = rest.findIndex((entry) => {
      const rect = motion.rect(entry);
      return point.y < rect.top + rect.height / 2;
    });
    if (index < 0) index = rest.length;
    const prev = rest[index - 1] ? motion.rect(rest[index - 1]) : undefined,
      next = rest[index] ? motion.rect(rest[index]) : undefined;
    return {
      index,
      y:
        prev && next
          ? (prev.bottom + next.top) / 2
          : next
            ? next.top - 6
            : prev
              ? prev.bottom + 6
              : point.y,
    };
  }
  function autoScroll(y: number) {
    const viewportTop = viewport?.offsetTop || 0,
      viewportBottom = viewportTop + (viewport?.height || innerHeight);
    for (
      let ancestor: HTMLElement | null = container;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      if (
        !/(auto|scroll)/.test(getComputedStyle(ancestor).overflowY) ||
        ancestor.scrollHeight <= ancestor.clientHeight
      )
        continue;
      const rect = ancestor.getBoundingClientRect(),
        top = Math.max(rect.top, viewportTop),
        bottom = Math.min(rect.bottom, viewportBottom);
      const delta =
        y < top + 42
          ? -Math.min(14, (top + 42 - y) / 3)
          : y > bottom - 42
            ? Math.min(14, (y - bottom + 42) / 3)
            : 0;
      if (
        delta &&
        ((delta < 0 && ancestor.scrollTop > 0) ||
          (delta > 0 &&
            ancestor.scrollTop < ancestor.scrollHeight - ancestor.clientHeight))
      ) {
        ancestor.scrollTop += delta;
        return;
      }
    }
    const delta =
      y < viewportTop + 42
        ? -Math.min(14, (viewportTop + 42 - y) / 3)
        : y > viewportBottom - 42
          ? Math.min(14, (y - viewportBottom + 42) / 3)
          : 0;
    if (delta) window.scrollBy(0, delta);
  }
  function drawDrag(time = performance.now()) {
    if (!press?.dragging) return;
    autoScroll(press.y);
    const target = dropTarget(press),
      source = find(press.id),
      origin = container.getBoundingClientRect(),
      content = source?.parentId
        ? motion.rect(source)
        : view.dom.getBoundingClientRect();
    line.hidden = !target || target.index === source?.index;
    const destination = motion.destination(target?.index ?? source?.index ?? 0);
    if (target) {
      line.style.top = `${(destination ?? target.y) - origin.top}px`;
      line.style.left = `${content.left - origin.left}px`;
      line.style.width = `${content.width}px`;
    }
    layout();
    motion.follow(press.x, press.y, time);
    dragFrame = requestAnimationFrame(drawDrag);
  }
  function finishPress(drop = false, animate = true) {
    const active = press;
    if (!active) return;
    const target = drop && active.dragging ? dropTarget(active) : null,
      source = find(active.id);
    press = null;
    clearTimeout(holdTimer);
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    line.hidden = true;
    container.classList.remove("cms-is-dragging");
    active.handle.removeAttribute("data-dragging");
    try {
      if (active.handle.hasPointerCapture(active.pointerId))
        active.handle.releasePointerCapture(active.pointerId);
    } catch {
      /* pointer may already be cancelled */
    }
    if (active.dragging || active.longPressed)
      suppressClickUntil = Date.now() + 400;
    const commit = () => {
      if (target && source && source.index !== target.index) {
        moveEntry(source, target.index);
        status.textContent = `블록을 ${target.index + 1}번째로 이동했습니다.`;
      }
    };
    if (active.dragging) motion.finish(commit, animate && !destroyed);
    else commit();
  }

  function startDrag() {
    if (!press || press.longPressed) return;
    press.dragging = true;
    clearTimeout(holdTimer);
    closeMenu();
    options.beforeMenu();
    container.classList.add("cms-is-dragging");
    press.handle.dataset.dragging = "true";
    motionGroup = find(press.id)?.parentId ?? null;
    motion.start(press.id, press.startX, press.startY);
    drawDrag();
  }
  function createHandle(id: string) {
    const handle = element("button", "cms-block-handle");
    handle.type = "button";
    handle.draggable = false;
    handle.dataset.blockId = id;
    handle.setAttribute("aria-haspopup", "menu");
    handle.setAttribute("aria-expanded", "false");
    handle.setAttribute(
      "aria-description",
      "드래그하여 순서 변경. 마우스를 올리거나 길게 누르면 메뉴를 엽니다.",
    );
    handle.append(grip());
    handle.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || press) return;
      if (menuId && menuId !== id) closeMenu();
      clearHover();
      hoverTimer = setTimeout(() => openMenu(id, false, true), 200);
    });
    handle.addEventListener("pointerleave", () => {
      clearTimeout(hoverTimer);
      scheduleClose();
    });
    handle.addEventListener("focus", () => clearHover());
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary || press) return;
      event.preventDefault();
      motion.stopSettling();
      lastPointerType = event.pointerType;
      clearHover();
      closeMenu();
      options.beforeMenu();
      const active = document.activeElement;
      if (active instanceof HTMLElement && view.dom.contains(active))
        active.blur();
      const entry = find(id);
      if (!entry) return;
      selectEntry(entry);
      handle.focus({ preventScroll: true });
      press = {
        id,
        pointerId: event.pointerId,
        type: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
        longPressed: false,
        document: view.state.doc,
        handle,
      };
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        /* detached/synthetic pointer */
      }
      if (event.pointerType !== "mouse")
        holdTimer = setTimeout(() => {
          if (press?.id === id && !press.dragging) {
            press.longPressed = true;
            openMenu(id);
          }
        }, 500);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!press || press.pointerId !== event.pointerId) return;
      press.x = event.clientX;
      press.y = event.clientY;
      if (
        !press.dragging &&
        !press.longPressed &&
        Math.hypot(press.x - press.startX, press.y - press.startY) >
          (press.type === "mouse" ? 6 : 10)
      )
        startDrag();
      if (press.dragging) event.preventDefault();
    });
    handle.addEventListener("pointerup", (event) => {
      if (press?.pointerId === event.pointerId) {
        press.x = event.clientX;
        press.y = event.clientY;
        finishPress(true);
      }
    });
    handle.addEventListener("pointercancel", () => {
      finishPress();
      closeMenu();
    });
    handle.addEventListener("lostpointercapture", () => {
      if (press) finishPress();
    });
    handle.addEventListener("click", (event) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        return;
      }
      if (lastPointerType === "mouse" || event.detail === 0)
        openMenu(id, event.detail === 0);
    });
    handle.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (!press?.dragging) openMenu(id);
    });
    handle.addEventListener("keydown", (event) => {
      if (
        event.key === "Tab" &&
        !event.isComposing &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const entry = find(id);
        if (entry?.parentId) {
          event.preventDefault();
          closeMenu();
          selectEntry(entry);
          listIndent(event.shiftKey)(view.state, view.dispatch, view);
          const next = handles.get(id);
          if (next?.isConnected) next.focus({ preventScroll: true });
          else view.focus();
          return;
        }
      }
      if (
        event.key === "Enter" ||
        event.key === " " ||
        (event.key === "ArrowDown" && !event.altKey)
      ) {
        event.preventDefault();
        openMenu(id, true);
      }
      if (
        event.altKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        event.preventDefault();
        const entry = find(id);
        if (entry) {
          closeMenu();
          moveEntry(entry, entry.index + (event.key === "ArrowUp" ? -1 : 1));
          handles.get(id)?.focus({ preventScroll: true });
        }
      }
    });
    return handle;
  }
  function update() {
    if (destroyed) return;
    if (press && press.document !== view.state.doc) finishPress(false, false);
    if (lastDocument !== view.state.doc) motion.stopSettling();
    lastDocument = view.state.doc;
    const next: Entry[] = [],
      ids = new Set<string>(),
      elements = new Set<HTMLElement>();
    view.state.doc.descendants((node, pos, parent, index) => {
      const topLevel = parent === view.state.doc;
      const isItem =
        node.type.name === "list_item" &&
        ["bullet_list", "ordered_list"].includes(parent?.type.name || "");
      if (!topLevel && !isItem) return;
      const block = view.nodeDOM(pos);
      if (!(block instanceof HTMLElement)) return;
      const id = String(node.attrs.id);
      const listContainer = ["bullet_list", "ordered_list"].includes(
        node.type.name,
      );
      let handle = handles.get(id);
      if (!handle) {
        handle = createHandle(id);
        handles.set(id, handle);
      }
      handle.hidden = listContainer;
      handle.dataset.blockIndex = String(index);
      handle.dataset.handleKind = isItem ? "list-item" : "block";
      handle.setAttribute(
        "aria-label",
        isItem ? `${index + 1}번 목록 항목 핸들` : `${index + 1}번 블록 핸들`,
      );
      next.push({
        id,
        pos,
        parentId: topLevel ? null : String(parent!.attrs.id),
        listContainer,
        index,
        node,
        element: block,
        handle,
      });
      ids.add(id);
      elements.add(block);
    });
    for (const [id, handle] of handles)
      if (!ids.has(id)) {
        handle.remove();
        handles.delete(id);
      }
    next.forEach((entry, index) => {
      if (layer.children[index] !== entry.handle)
        layer.insertBefore(entry.handle, layer.children[index] || null);
    });
    for (const node of observed)
      if (!elements.has(node)) observer?.unobserve(node);
    for (const node of elements)
      if (!observed.has(node)) observer?.observe(node);
    observed = elements;
    entries = next;
    if (menuId && !ids.has(menuId)) closeMenu();
    scheduleLayout();
  }
  function outside(event: PointerEvent) {
    if (
      menu &&
      !menu.contains(event.target as Node) &&
      !layer.contains(event.target as Node)
    )
      closeMenu();
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === "Escape" && (press || menu)) {
      event.preventDefault();
      event.stopPropagation();
      finishPress();
      closeMenu(!!menu?.contains(document.activeElement));
    }
  }
  function blur() {
    finishPress();
    closeMenu();
  }
  function resized() {
    if (press?.dragging) finishPress(false, false);
    motion.stopSettling();
    scheduleLayout();
  }
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", keydown);
  window.addEventListener("blur", blur);
  window.addEventListener("resize", resized);
  window.addEventListener("scroll", scheduleLayout, true);
  viewport?.addEventListener("resize", scheduleLayout);
  viewport?.addEventListener("scroll", scheduleLayout);
  observer?.observe(view.dom);
  update();
  return {
    update,
    close: blur,
    destroy() {
      destroyed = true;
      blur();
      clearHover();
      clearTimeout(holdTimer);
      cancelAnimationFrame(layoutFrame);
      observer?.disconnect();
      motion.destroy();
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", keydown);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", resized);
      window.removeEventListener("scroll", scheduleLayout, true);
      viewport?.removeEventListener("resize", scheduleLayout);
      viewport?.removeEventListener("scroll", scheduleLayout);
      layer.remove();
      line.remove();
      status.remove();
      container.classList.remove("cms-handle-surface");
    },
  };
}
