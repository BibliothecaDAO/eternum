import { StepOptionsButton } from "shepherd.js";

export const StepButton: Record<string, StepOptionsButton> = {
  next: {
    text: "Next",
    action: function () {
      return this.next();
    },
  },
  prev: {
    text: "Prev",
    action: function () {
      return this.back();
    },
  },
  finish: {
    text: "Finish",
    action: function () {
      return this.complete();
    },
  },
} as const;

export const waitForElement = (selector: string, delay: number = 300): Promise<void> => {
  return new Promise((resolve) => {
    const overlay = document.querySelector(".shepherd-modal-overlay-container");
    if (overlay) {
      (overlay as HTMLElement).style.display = "none";
    }

    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        setTimeout(() => {
          if (overlay) {
            (overlay as HTMLElement).style.display = "";
          }
          resolve();
        }, delay);
      } else {
        setTimeout(checkElement, 100);
      }
    };
    checkElement();
  });
};
