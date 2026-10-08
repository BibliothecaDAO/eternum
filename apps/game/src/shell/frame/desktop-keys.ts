import { useEffect } from "react";
import { type To, useNavigate } from "react-router-dom";

/** Typing in a field, or a key held with a modifier, belongs to the field or the browser, never to the app. */
const isForTheApp = (event: KeyboardEvent): boolean => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return false;
  const target = event.target;
  return !(target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']"));
};

/**
 * The desktop's keys: 1–4 open the four places, Esc leads Back. An open sheet takes Esc first (it closes itself), so
 * Back answers only when nothing is open over the page.
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
      if (event.key === "Escape" && back !== undefined && !document.querySelector("[role=dialog]")) navigate(back);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, places, back]);
};
