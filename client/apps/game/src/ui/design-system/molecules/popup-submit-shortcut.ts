import type React from "react";

type PopupShortcutOptions = {
  onClose?: () => void;
  onSubmit?: () => void;
  submitOnEnter?: boolean;
  isSubmitDisabled?: boolean;
};

const POPUP_SUBMIT_IGNORE_SELECTOR =
  "button,a,select,textarea,[contenteditable=''],[contenteditable='true'],[role='textbox'][aria-multiline='true']";

const isModifiedEnterKey = (event: React.KeyboardEvent<HTMLElement>) =>
  event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

const isComposingInput = (event: React.KeyboardEvent<HTMLElement>) => event.nativeEvent.isComposing;

const shouldIgnorePopupSubmitTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest(POPUP_SUBMIT_IGNORE_SELECTOR) !== null;

const shouldSubmitPopupOnEnter = (
  event: React.KeyboardEvent<HTMLElement>,
  options: Pick<PopupShortcutOptions, "onSubmit" | "submitOnEnter" | "isSubmitDisabled">,
) => {
  if (!options.submitOnEnter || !options.onSubmit || options.isSubmitDisabled) {
    return false;
  }

  if (event.defaultPrevented || event.key !== "Enter" || isModifiedEnterKey(event) || isComposingInput(event)) {
    return false;
  }

  return !shouldIgnorePopupSubmitTarget(event.target);
};

export const handlePopupShortcutKeyDown = (event: React.KeyboardEvent<HTMLElement>, options: PopupShortcutOptions) => {
  if (event.key === "Escape") {
    options.onClose?.();
    return;
  }

  if (!shouldSubmitPopupOnEnter(event, options)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  options.onSubmit?.();
};
