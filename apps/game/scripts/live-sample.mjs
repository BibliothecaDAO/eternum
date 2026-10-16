/**
 * What a first-time viewer meets on a game screen at rest, sampled in the page: every control and every line of text
 * that is drawn, inside the viewport, not clipped by a box and not covered, grouped by its region (the nearest ancestor
 * with an aria-label or role=dialog, or a header, aside, nav or section). The map's own labels are not counted.
 *
 * - **Drawn**: it and every ancestor are displayed and visible, at more than 5% opacity together.
 * - **Covered**: the topmost element at its centre is something else; the map canvas covers it unless the element lets
 *   clicks through (pointer-events: none), since the canvas is then what the page reports beneath it. A partial cover
 *   that leaves the centre free is not seen.
 * - **Class**: `visible`, or `scroll` when a scrolling box clips it.
 * - **Primary**: a control with the filled gold face, the app's press-me style.
 *
 * A reader can still merge a label with its value by hand; the totals here are the sampler's own, the same before and
 * after a change.
 */
export const LIVE_SAMPLE = `(() => {
  const CONTROL = "button, a[href], input, select, textarea, [role=button], [role=switch], [role=tab]";
  const drawn = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") return false;
    let opacity = 1;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const sa = getComputedStyle(a);
      if (sa.display === "none") return false;
      opacity *= Number(sa.opacity);
    }
    return opacity > 0.05;
  };
  const inView = (r) => r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  const clipped = (el, r) => {
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX === "visible" && s.overflowY === "visible") continue;
      const b = a.getBoundingClientRect();
      if (x < b.left || x > b.right || y < b.top || y > b.bottom) return /(auto|scroll)/.test(s.overflowY + s.overflowX) ? "scroll" : "hidden";
    }
    return null;
  };
  const covered = (el, r) => {
    const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
    const hit = document.elementFromPoint(x, y);
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return false;
    return hit.tagName !== "CANVAS" || getComputedStyle(el).pointerEvents !== "none";
  };
  const region = (el) => {
    const a = el.closest("[aria-label], [role=dialog], header, aside, nav, section");
    return a ? (a.getAttribute("aria-label") || a.getAttribute("role") || a.tagName.toLowerCase()) : "(page)";
  };
  const isGold = (el) => {
    const s = getComputedStyle(el);
    return el.classList.contains("frontier-primary") || /rgb\\((2[2-5]\\d), (1[6-9]\\d|2[0-1]\\d), ([3-9]\\d|1[0-2]\\d)\\)/.test(s.backgroundImage + " " + s.backgroundColor);
  };
  const classOf = (el) => {
    if (!drawn(el)) return null;
    const r = el.getBoundingClientRect();
    const clip = clipped(el, r);
    if (clip === "hidden") return null;
    return clip === "scroll" ? "scroll" : !inView(r) || covered(el, r) ? null : "visible";
  };
  const words = (text) => text.trim().replace(/\\s+/g, " ").slice(0, 50);
  const items = [];
  for (const el of document.querySelectorAll(CONTROL)) {
    const cls = classOf(el);
    if (cls) items.push({ region: region(el), cls, kind: "control", gold: isGold(el), text: words(el.getAttribute("aria-label") || el.innerText || el.title || "") });
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    const text = walker.currentNode.textContent.trim();
    if (!text || !el || el.closest(CONTROL) || el.closest("#labelrenderer")) continue;
    const cls = classOf(el);
    if (cls) items.push({ region: region(el), cls, kind: "text", gold: false, text: words(text) });
  }
  return { url: location.pathname + location.search, viewport: innerWidth + "x" + innerHeight, items };
})()`;

/** A sample's totals: what is visible and what scrolls, the regions holding something visible, the gold controls. */
export const sampleTotals = (items) => {
  const visible = items.filter((item) => item.cls === "visible");
  return {
    visible: visible.length,
    scroll: items.filter((item) => item.cls === "scroll").length,
    groups: new Set(visible.map((item) => item.region)).size,
    primary: visible.filter((item) => item.kind === "control" && item.gold).length,
  };
};
