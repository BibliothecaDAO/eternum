import { useEffect } from "react";

/** Typing in a field, or a key held with a modifier, belongs to the field or the browser, never to the app. */
const isForTheApp = (event: KeyboardEvent): boolean => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return false;
  const target = event.target;
  return !(target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']"));
};

/** A control with the focus answers Enter itself; the screen's step answers it only when nothing else would. */
const isFocusedControl = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest("a, button, summary, [role=button]") !== null;

/** The screen's one step (its primary verb, an AppButton marked `step`), while it can be taken. */
const stepButton = () => document.querySelector<HTMLButtonElement>("[data-role=step] button:enabled");

/**
 * The desktop's key, shown where it acts: Enter takes the screen's step. An open sheet takes Enter first, so the page
 * answers only when nothing is open over it. Escape closes a sheet and nothing else: a page has no Back.
 */
export const useDesktopKeys = () => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isForTheApp(event)) return;
      if (document.querySelector("[role=dialog]")) return;
      if (event.key === "Enter" && !isFocusedControl(event.target)) stepButton()?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
};
