// A phone's on-screen keyboard, staged for the chat proof's keyboard records (an init script, before the page's own):
// the visual viewport a keyboard shrinks, as Android Chrome's does (it overlays the page's foot, the layout unchanged),
// and the keyboard drawn over that foot. `window.__keyboard(px)` opens it that tall; 0 closes it. Closed, the page sees
// the visual viewport a phone's browser gives it.
(() => {
  let keyboard = 0;
  const events = new EventTarget();
  const visual = {
    get width() {
      return document.documentElement.clientWidth;
    },
    get height() {
      return document.documentElement.clientHeight - keyboard;
    },
    offsetTop: 0,
    offsetLeft: 0,
    pageTop: 0,
    pageLeft: 0,
    scale: 1,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  };
  Object.defineProperty(window, "visualViewport", { configurable: true, get: () => visual });
  window.__keyboard = (px) => {
    keyboard = px;
    let drawn = document.getElementById("__staged-keyboard");
    if (!drawn) {
      drawn = document.createElement("div");
      drawn.id = "__staged-keyboard";
      drawn.setAttribute("aria-hidden", "true");
      Object.assign(drawn.style, {
        position: "fixed",
        left: "0",
        right: "0",
        bottom: "0",
        zIndex: "2147483647",
        background: "#2b2f35",
        pointerEvents: "none",
      });
      document.body.append(drawn);
    }
    drawn.style.height = `${px}px`;
    drawn.style.display = px > 0 ? "block" : "none";
    events.dispatchEvent(new Event("resize"));
    return true;
  };
})();
