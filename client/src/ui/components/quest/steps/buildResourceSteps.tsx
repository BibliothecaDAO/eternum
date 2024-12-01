import { StepOptions } from "shepherd.js";
import { STYLES, waitForElement } from "./utils";
import useUIStore from "@/hooks/store/useUIStore";

export const buildResourceSteps: StepOptions[] = [
  {
    title: "Build a Resource Facility",
    text: "Eternum thrives on resources. Construct resource facilities to harvest them efficiently.",
    // text: `<div class="space-y-2">
    //     <div>Eternum thrives on resources. Construct resource facilities to harvest them efficiently.</div>
    //     <div>For each farm next to your resource facility you gain a <span class="font-bold text-order-brilliance">10%</span> boost in production.</div>
    //   </div>`,

    classes: STYLES.defaultStepPlacement,
    buttons: [
      {
        text: "Next",
        action: function () {
          return this.next();
        },
        classes: STYLES.defaultButton,
      },
    ],
  },

  {
    title: "Construction tab",
    text: "Open the construction menu",
    attachTo: {
      element: ".construction-selector",
      on: "right",
    },
    advanceOn: {
      selector: ".construction-selector",
      event: "click",
    },
    buttons: [
      {
        text: "Prev",
        action: function () {
          return this.back();
        },
        classes: STYLES.defaultButton,
      },
    ],
  },

  {
    title: "Resource buildings",
    text: "Open the Resources tab",
    attachTo: {
      element: ".resource-tab-selector",
      on: "right",
    },
    advanceOn: {
      selector: ".resource-tab-selector",
      event: "click",
    },

    beforeShowPromise: function () {
      return waitForElement(".resource-tab-selector");
    },

    buttons: [
      {
        text: "Prev",
        action: function () {
          return this.back();
        },
        classes: STYLES.defaultButton,
      },
    ],
  },

  {
    title: "Resources Buildings",
    text: "Select a Resource Facility",
    attachTo: {
      element: ".resource-cards-selector",
    },

    classes: STYLES.defaultStepPlacement,

    advanceOn: {
      selector: ".resource-cards-selector",
      event: "click",
    },

    beforeShowPromise: function () {
      const closeAllPopups = useUIStore.getState().closeAllPopups;
      closeAllPopups();

      return waitForElement(".resource-cards-selector");
    },

    buttons: [
      {
        text: "Prev",
        action: function () {
          return this.back();
        },
        classes: STYLES.defaultButton,
      },
    ],
  },

  {
    title: "Build it",
    text: "Place your building on any available hex. use right-click to cancel",
    classes: STYLES.defaultStepPlacement,

    beforeShowPromise: function () {
      const overlay = document.querySelector(".shepherd-modal-overlay-container");
      if (overlay) {
        (overlay as HTMLElement).style.display = "none";
      }

      return new Promise<void>((resolve) => resolve());
    },

    buttons: [
      {
        text: "Prev",
        action: function () {
          return this.back();
        },
        classes: STYLES.defaultButton,
      },
      {
        text: "Finish",
        action: function () {
          return this.complete();
        },
        classes: STYLES.defaultButton,
      },
    ],
  },
];
