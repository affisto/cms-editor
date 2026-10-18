interface Block {
  id: string;
  element: HTMLElement;
  handle: HTMLElement;
}
interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
interface Options {
  container: HTMLElement;
  root: HTMLElement;
  blocks: () => Block[];
  relayout: () => void;
}
const easing = "cubic-bezier(0.22, 0.8, 0.25, 1)";
/** Compositor-only previews keep hit testing stable and never mutate editable DOM attributes. */
export function createDragMotion(options: Options) {
  const preference =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  const reduced = () => preference?.matches || false;
  let sourceId: string | null = null,
    base: Map<string, Box> | null = null,
    settled: Map<string, Box> | null = null,
    ghost: HTMLElement | null = null;
  let point = { x: 0, y: 0 },
    grab = { x: 0, y: 0 },
    listInset = 0,
    lastTime = 0,
    lastTarget = -1;
  const preview = new Map<HTMLElement, Animation>(),
    opacity: Animation[] = [],
    settling = new Set<Animation>();
  function capture() {
    const root = options.root.getBoundingClientRect();
    return new Map(
      options.blocks().map((block) => {
        const r = block.element.getBoundingClientRect();
        return [
          block.id,
          {
            left: r.left - root.left,
            top: r.top - root.top,
            width: r.width,
            height: r.height,
          },
        ];
      }),
    );
  }
  function rect(block: Block): DOMRect {
    const box = (base || settled)?.get(block.id);
    if (!box) return block.element.getBoundingClientRect();
    const root = options.root.getBoundingClientRect();
    return new DOMRect(
      root.left + box.left,
      root.top + box.top,
      box.width,
      box.height,
    );
  }
  function stopSettling() {
    for (const animation of settling) {
      animation.onfinish = null;
      animation.cancel();
    }
    settling.clear();
    settled = null;
  }
  function clearPreview() {
    for (const animation of preview.values()) animation.cancel();
    preview.clear();
    for (const animation of opacity) animation.cancel();
    opacity.length = 0;
    base = null;
    lastTarget = -1;
  }
  function start(id: string, x: number, y: number) {
    stopSettling();
    clearPreview();
    sourceId = id;
    const source = options.blocks().find((block) => block.id === id);
    if (!source) return;
    base = capture();
    const bounds = rect(source);
    listInset = source.element.tagName === "LI" ? 25 : 0;
    point = { x: bounds.left - listInset, y: bounds.top };
    grab = { x: bounds.left - listInset - x, y: bounds.top - y };
    lastTime = performance.now();
    ghost = document.createElement("div");
    ghost.className = "cms-drag-preview cms-content";
    ghost.setAttribute("popover", "manual");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    ghost.style.width = `${bounds.width + listInset}px`;
    const clone = source.element.cloneNode(true) as HTMLElement;
    clone.classList.add("cms-drag-clone");
    const originalControls = source.element.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input,textarea,select");
    clone
      .querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input,textarea,select")
      .forEach((control, index) => {
        control.value = originalControls[index].value;
        if (control instanceof HTMLInputElement)
          control.checked = (
            originalControls[index] as HTMLInputElement
          ).checked;
      });
    for (const node of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
      node.removeAttribute("id");
      node.removeAttribute("name");
      node.removeAttribute("contenteditable");
      node.removeAttribute("tabindex");
      node.classList.remove("ProseMirror-selectednode");
    }
    const parentList = source.element.parentElement;
    if (
      source.element.tagName === "LI" &&
      parentList &&
      /^(UL|OL)$/.test(parentList.tagName)
    ) {
      const list = document.createElement(parentList.tagName.toLowerCase());
      list.style.margin = "0";
      list.style.paddingLeft = "25px";
      if (parentList instanceof HTMLOListElement)
        list.setAttribute(
          "start",
          String(
            parentList.start +
              Array.from(parentList.children).indexOf(source.element),
          ),
        );
      list.append(clone);
      ghost.append(list);
    } else ghost.append(clone);
    options.container.append(ghost);
    ghost.showPopover();
    for (const node of [source.element, source.handle])
      opacity.push(
        node.animate([{ opacity: 0 }, { opacity: 0 }], {
          duration: 0,
          fill: "both",
        }),
      );
    if (!reduced())
      ghost.animate([{ opacity: 0 }, { opacity: 0.96 }], {
        duration: 120,
        easing,
      });
  }
  function shift(node: HTMLElement, offset: number) {
    const from = getComputedStyle(node).translate;
    preview.get(node)?.cancel();
    preview.set(
      node,
      node.animate([{ translate: from }, { translate: `0px ${offset}px` }], {
        duration: reduced() ? 0 : 180,
        easing,
        fill: "both",
      }),
    );
  }
  function destination(index: number) {
    if (!base || !sourceId) return null;
    const blocks = options.blocks(),
      source = blocks.find((block) => block.id === sourceId);
    if (!source) return null;
    const reordered = blocks.filter((block) => block.id !== sourceId);
    reordered.splice(index, 0, source);
    const gaps = blocks
      .slice(1)
      .map(
        (block, i) =>
          base!.get(block.id)!.top -
          base!.get(blocks[i].id)!.top -
          base!.get(blocks[i].id)!.height,
      );
    let top = base.get(blocks[0].id)!.top,
      sourceTop = top;
    for (let i = 0; i < reordered.length; i++) {
      const block = reordered[i],
        original = base.get(block.id)!;
      if (index !== lastTarget) {
        shift(block.element, top - original.top);
        shift(block.handle, top - original.top);
      }
      if (block.id === sourceId) sourceTop = top;
      top += original.height + (gaps[i] || 0);
    }
    lastTarget = index;
    return options.root.getBoundingClientRect().top + sourceTop;
  }
  function follow(x: number, y: number, time: number) {
    if (!ghost) return;
    const width = ghost.offsetWidth,
      height = Math.min(ghost.offsetHeight, innerHeight - 16);
    const desired = {
      x: Math.max(8, Math.min(x + grab.x + 3, innerWidth - width - 8)),
      y: Math.max(8, Math.min(y + grab.y - 4, innerHeight - height - 8)),
    };
    const delta = Math.min(64, Math.max(1, time - lastTime));
    lastTime = time;
    const blend = reduced() ? 1 : 1 - Math.exp(-delta / 42);
    point.x += (desired.x - point.x) * blend;
    point.y += (desired.y - point.y) * blend;
    ghost.style.transform = `translate3d(${point.x}px,${point.y}px,0) scale(${reduced() ? 1 : 1.012})`;
  }
  function finish(commit: () => void, animate = true) {
    const blocks = options.blocks(),
      before = new Map(
        blocks.map((block) => [
          block.id,
          {
            node: block.element.getBoundingClientRect(),
            handle: block.handle.getBoundingClientRect(),
          },
        ]),
      );
    if (sourceId && ghost) {
      const old = before.get(sourceId);
      if (old) {
        const box = ghost.getBoundingClientRect(),
          node = rect(blocks.find((block) => block.id === sourceId)!);
        old.handle = new DOMRect(
          box.left + listInset + (old.handle.left - old.node.left),
          box.top + (old.handle.top - old.node.top),
          old.handle.width,
          old.handle.height,
        );
        old.node = new DOMRect(
          box.left + listInset,
          box.top,
          node.width,
          node.height,
        );
      }
    }
    const moving = sourceId;
    ghost?.remove();
    ghost = null;
    clearPreview();
    sourceId = null;
    commit();
    options.relayout();
    if (!animate || reduced() || !moving) return;
    settled = capture();
    const track = (animation: Animation) => {
      settling.add(animation);
      animation.onfinish = () => {
        settling.delete(animation);
        if (!settling.size) {
          settled = null;
          options.relayout();
        }
      };
    };
    for (const block of options.blocks()) {
      const previous = before.get(block.id);
      if (!previous) continue;
      for (const [node, old] of [
        [block.element, previous.node],
        [block.handle, previous.handle],
      ] as const) {
        const target = node.getBoundingClientRect(),
          dx = old.left - target.left,
          dy = old.top - target.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && block.id !== moving)
          continue;
        const start: Keyframe = { translate: `${dx}px ${dy}px` },
          end: Keyframe = { translate: "0px 0px" };
        if (block.id === moving && node === block.element) {
          start.scale = "1.012";
          end.scale = "1";
          start.opacity = 0.96;
          end.opacity = getComputedStyle(node).opacity;
          start.boxShadow = "0 10px 26px var(--color-shadow, var(--cms-line))";
          end.boxShadow = getComputedStyle(node).boxShadow;
        }
        track(node.animate([start, end], { duration: 220, easing }));
      }
    }
    if (!settling.size) settled = null;
  }
  return {
    start,
    rect,
    destination,
    follow,
    finish,
    stopSettling,
    destroy() {
      ghost?.remove();
      ghost = null;
      clearPreview();
      stopSettling();
    },
  };
}
