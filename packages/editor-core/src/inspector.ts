export type InspectorMode = "inline" | "popover";
interface InspectorOptions {
  container: HTMLElement;
  externalHost?: HTMLElement;
  mode: InspectorMode;
  getBlockRect: () => DOMRect | undefined;
  returnFocus: () => void;
}
/** Owns its content node so switching placement never remounts the editor or React's host. */
export function createInspector(options: InspectorOptions) {
  let mode = options.mode;
  let anchor: "toolbar" | "block" = "toolbar";
  let opened = false;
  const content = document.createElement("aside");
  content.className = "cms-inspector";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "cms-tool cms-settings-trigger";
  trigger.textContent = "블록 설정";
  trigger.setAttribute("aria-label", "블록 설정");
  trigger.setAttribute("aria-expanded", "false");
  const panel = document.createElement("div");
  panel.className = "cms-block-settings";
  panel.setAttribute("popover", "auto");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "블록 설정");
  panel.setAttribute("aria-modal", "false");
  const header = document.createElement("div");
  header.className = "cms-settings-header";
  const title = document.createElement("strong");
  title.textContent = "블록 설정";
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "cms-tool";
  dismiss.textContent = "×";
  dismiss.setAttribute("aria-label", "설정 닫기");
  header.append(title, dismiss);
  panel.append(header);
  options.container.append(panel);
  const viewport = window.visualViewport;
  const isOpen = () => opened && panel.matches(":popover-open");
  function position() {
    if (!isOpen()) return;
    const block =
      anchor === "block" || !trigger.isConnected
        ? options.getBlockRect()
        : undefined;
    const source = block || trigger.getBoundingClientRect();
    const rect = {
      left: source.left,
      right: source.right,
      top: source.top,
      bottom: block ? source.top + 32 : source.bottom,
    };
    const left = viewport?.offsetLeft || 0,
      top = viewport?.offsetTop || 0,
      width = viewport?.width || innerWidth,
      height = viewport?.height || innerHeight;
    const bottom = top + height,
      below = bottom - rect.bottom - 16,
      above = rect.top - top - 16,
      down = below >= 320 || below >= above;
    panel.style.width = `${Math.min(320, width - 16)}px`;
    panel.style.maxHeight = `${Math.min(520, height - 16, Math.max(120, down ? below : above))}px`;
    const bounds = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(left + 8, Math.min(rect.right - bounds.width, left + width - bounds.width - 8))}px`;
    panel.style.top = `${Math.max(top + 8, Math.min(down ? rect.bottom + 8 : rect.top - bounds.height - 8, bottom - bounds.height - 8))}px`;
  }
  function stopTracking() {
    window.removeEventListener("resize", position);
    window.removeEventListener("scroll", position, true);
    viewport?.removeEventListener("resize", position);
    viewport?.removeEventListener("scroll", position);
    trigger.setAttribute("aria-expanded", "false");
  }
  function close(restoreFocus = false) {
    if (isOpen()) panel.hidePopover();
    opened = false;
    stopTracking();
    if (restoreFocus) options.returnFocus();
  }
  function open(source: "toolbar" | "block" = "toolbar") {
    anchor = source;
    if (mode === "inline") {
      content.scrollIntoView({ block: "nearest" });
      content
        .querySelector<HTMLElement>(
          "input:not(:disabled),textarea,select,button",
        )
        ?.focus({ preventScroll: true });
      return;
    }
    panel.append(content);
    if (!isOpen()) {
      panel.showPopover();
      opened = true;
    }
    trigger.setAttribute("aria-expanded", "true");
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    viewport?.addEventListener("resize", position);
    viewport?.addEventListener("scroll", position);
    content
      .querySelector<HTMLElement>("input:not(:disabled),textarea,select,button")
      ?.focus({ preventScroll: true });
  }
  function setMode(next: InspectorMode) {
    close();
    mode = next;
    if (next === "inline")
      (options.externalHost || options.container).append(content);
    else panel.append(content);
  }
  trigger.addEventListener("mousedown", (e) => e.preventDefault());
  trigger.addEventListener("click", () => {
    if (isOpen()) close(true);
    else open();
  });
  dismiss.addEventListener("click", () => close(true));
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  });
  panel.addEventListener("toggle", (event) => {
    if ((event as ToggleEvent).newState === "closed") {
      opened = false;
      stopTracking();
    }
  });
  setMode(mode);
  return {
    content,
    trigger,
    open,
    close,
    setMode,
    refresh: position,
    destroy() {
      close();
      content.remove();
      panel.remove();
      trigger.remove();
    },
  };
}
