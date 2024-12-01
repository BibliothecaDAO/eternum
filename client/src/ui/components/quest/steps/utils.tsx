export const STYLES = {
  defaultStepPlacement: "!top-20 !left-0 !-translate-y-0",
  defaultButton:
    "bg-gold/20 hover:bg-gold/30 border border-gold/40 rounded transition-colors duration-200 text-gold cursor-fancy",
};

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
