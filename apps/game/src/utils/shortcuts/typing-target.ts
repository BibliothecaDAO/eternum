/** A field takes every key typed into it. */
const FIELD = 'input,textarea,select,[contenteditable="true"],[role="textbox"]';

/** A control takes the keys that press it: Enter, and Space. */
const CONTROL =
  'button,a,summary,[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="radio"],[role="switch"],[role="menuitem"],[role="option"]';
const PRESS_KEYS = new Set(["Enter", " "]);

/**
 * Whether a key belongs to what has the keyboard, never to a shortcut: anything typed into a field, or the Enter or
 * Space that presses a focused button, link or tab. Every other key on a control stays a shortcut, so the HUD's keys
 * keep working after a click.
 */
export const isKeyForFocused = (event: KeyboardEvent): boolean => {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return (
    target.closest(FIELD) !== null ||
    (target instanceof HTMLElement && target.isContentEditable) ||
    (PRESS_KEYS.has(event.key) && target.closest(CONTROL) !== null)
  );
};

/** Whether a key belongs to what has the keyboard, or to the open dialog it was pressed in: Enter there is never the map's. */
export const isKeyForSurface = (event: KeyboardEvent): boolean =>
  isKeyForFocused(event) || (event.target instanceof Element && event.target.closest('[role="dialog"]') !== null);
