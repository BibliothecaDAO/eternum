/** Whether a key press belongs to the control it was typed in: a field, a button, a link, or anything inside a dialog. */
export const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="textbox"],[role="dialog"]') !== null;
