import useUIStore from "@/hooks/store/useUIStore";
import { StepOptions } from "shepherd.js";
import { waitForElement } from "./utils";

export const buildFoodSteps: StepOptions[] = [
  {
    title: "Food",
    text: "Wheat and Fish are the lifeblood of your people.",
    buttons: [
      {
        text: "Next",
        action: function () {
          return this.next();
        },
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
      },
    ],
  },

  {
    title: "Food Buildings",
    text: "Select a Farm or a Fishing Village. ",
    attachTo: {
      element: ".economy-selector",
    },

    advanceOn: {
      selector: ".economy-selector",
      event: "click",
    },

    beforeShowPromise: function () {
      const closeAllPopups = useUIStore.getState().closeAllPopups;
      closeAllPopups();

      return waitForElement(".economy-selector");
    },

    buttons: [
      {
        text: "Prev",
        action: function () {
          return this.back();
        },
      },
    ],
  },

  {
    title: "Build it",
    text: "Place your building on any available hex. use right-click to cancel",

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
      },
      {
        text: "Finish",
        action: function () {
          return this.complete();
        },
      },
    ],
  },
  // advance on click
  // open quest log
  // claim rewards
];
