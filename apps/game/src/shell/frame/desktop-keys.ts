import { useEffect } from "react";
import { type To, useNavigate } from "react-router-dom";

/** Typing in a field, or a key held with a modifier, belongs to the field or the browser, never to the app. */
const isForTheApp = (event: KeyboardEvent): boolean => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return false;
  const target = event.target;
  return !(target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']"));
};

/** A control with the focus answers Enter itself; the screen's step answers it only when nothing else would. */
const isFocusedControl = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest("a, button, summary, [role=button]") !== null;

/** The screen's one step (its primary verb, marked by StepVerb), while it can be taken. */
const stepButton = () => document.querySelector<HTMLButtonElement>("[data-role=step] button:enabled");

/**
 * The desktop's keys: 1–4 open the four places, Esc leads Back, Enter takes the screen's step. An open sheet takes Esc
 * and Enter first, so the page answers only when nothing is open over it.
 */
export const useDesktopKeys = ({ places, back }: { places: readonly string[]; back: To | undefined }) => {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isForTheApp(event)) return;
      const place = Number(event.key);
      if (Number.isInteger(place) && place >= 1 && place <= places.length) {
        navigate(places[place - 1]);
        return;
      }
      if (document.querySelector("[role=dialog]")) return;
      if (event.key === "Escape" && back !== undefined) navigate(back);
      if (event.key === "Enter" && !isFocusedControl(event.target)) stepButton()?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, places, back]);
};
