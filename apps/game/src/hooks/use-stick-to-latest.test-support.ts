/** Each message row's height, and every list's box, in the layout below. */
export const ROW_PX = 40;
const BOX_PX = 200;

/**
 * A browser's scrolling for chat lists, in jsdom, which lays nothing out: every list's box is BOX_PX tall and holds its
 * rows (`li`) at ROW_PX each, its scroll position clamps to what scrolls, as a browser's does, and a box never resizes.
 * Returns the way to undo it.
 */
export const layOutChatLists = () => {
  const positions = new WeakMap<Element, number>();
  const contentHeight = (element: Element) => element.querySelectorAll("li").length * ROW_PX;
  const furthest = (element: Element) => Math.max(0, contentHeight(element) - BOX_PX);
  const descriptors = (["scrollHeight", "clientHeight", "scrollTop"] as const).map(
    (name) => [name, Object.getOwnPropertyDescriptor(Element.prototype, name)] as const,
  );
  Object.defineProperties(Element.prototype, {
    scrollHeight: {
      configurable: true,
      get(this: Element) {
        return contentHeight(this);
      },
    },
    clientHeight: { configurable: true, get: () => BOX_PX },
    scrollTop: {
      configurable: true,
      get(this: Element) {
        return Math.min(positions.get(this) ?? 0, furthest(this));
      },
      set(this: Element, top: number) {
        positions.set(this, Math.max(0, Math.min(top, furthest(this))));
      },
    },
  });
  const resizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  return () => {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
    }
    globalThis.ResizeObserver = resizeObserver;
  };
};

/** The list's scroll position, and the furthest it goes: where the latest message shows. */
export const scrollOf = (list: Element) => ({ top: list.scrollTop, latest: list.scrollHeight - list.clientHeight });

/** The reader scrolls the list to `top`, as a wheel or a finger does: the position moves, and the list hears it. */
export const scrollTo = (list: Element, top: number) => {
  list.scrollTop = top;
  list.dispatchEvent(new Event("scroll"));
};
