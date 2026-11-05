import { type RefObject, useEffect } from "react";

import { useSheetCloses } from "./sheet-closes";

/**
 * A layer that opens over the page, whichever surface draws it (AppModalLayer in the app, HudModalLayer in the HUD):
 * everything outside it inert while it is mounted, the keyboard's focus held in it (taken as it opens, Tab and Shift+Tab
 * going round its controls, given back to what opened it once it closes), and `onClose` on Escape or the system back.
 */
export const useModalLayer = (layer: RefObject<HTMLElement | null>, onClose: () => void) => {
  useSheetCloses(onClose);
  useInertOutside(layer);
  useFocusHeld(layer);
};

/** What takes the keyboard's focus in a layer, in its order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The layer holds the keyboard's focus while it is mounted: it takes it as it opens (its dialog, unless a control in
 * it already took it, a field that focuses itself), Tab and Shift+Tab go round its controls without leaving it, and the
 * control that opened it has it back once it closes.
 */
const useFocusHeld = (layer: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const element = layer.current;
    if (!element) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = element.querySelector<HTMLElement>('[role="dialog"]') ?? element;
    if (!element.contains(document.activeElement)) {
      if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
      dialog.focus({ preventScroll: true });
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const active = document.activeElement;
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return event.preventDefault();
      const inside = active instanceof HTMLElement && element.contains(active);
      const wrapsBack = event.shiftKey && (!inside || active === first || active === dialog);
      const wrapsOn = !event.shiftKey && (!inside || active === last);
      if (!wrapsBack && !wrapsOn) return;
      event.preventDefault();
      (wrapsBack ? last : first).focus();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [layer]);
};

/** Makes everything outside the layer inert while it is mounted: its siblings, and its ancestors' up to the body. */
const useInertOutside = (layer: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const made: Element[] = [];
    for (let node = layer.current; node?.parentElement && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || sibling.hasAttribute("inert")) continue;
        sibling.setAttribute("inert", "");
        made.push(sibling);
      }
    }
    return () => made.forEach((element) => element.removeAttribute("inert"));
  }, [layer]);
};
