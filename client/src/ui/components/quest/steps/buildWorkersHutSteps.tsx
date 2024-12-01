import { configManager } from "@/dojo/setup";
import useUIStore from "@/hooks/store/useUIStore";
import { BuildingType } from "@bibliothecadao/eternum";
import { StepOptions } from "shepherd.js";
import { STYLES, waitForElement } from "./utils";

export const buildWorkersHutSteps: StepOptions[] = [
  {
    title: "Population Management",
    text: `Each building takes up population in your realm. Your realm starts with a population of ${configManager.getBasePopulationCapacity()}. Build worker huts to extend your population capacity by ${
      configManager.getBuildingPopConfig(BuildingType.WorkersHut).capacity
    }.`,
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
    title: "Population Overview",
    text: "Monitor your realm's population capacity and usage here",
    attachTo: {
      element: ".population-selector",
      on: "center",
    },
    beforeShowPromise: function () {
      return waitForElement(".population-selector");
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
        text: "Next",
        action: function () {
          return this.next();
        },
        classes: STYLES.defaultButton,
      },
    ],
  },
  {
    title: "Construction Menu",
    text: "Open the construction menu to build a Workers Hut",
    attachTo: {
      element: ".construction-selector",
      on: "bottom",
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
    title: "Select Workers Hut",
    text: "Select the Workers Hut building to increase your population capacity",
    attachTo: {
      element: ".workershut-card-selector",
      on: "bottom",
    },
    beforeShowPromise: function () {
      const closeAllPopups = useUIStore.getState().closeAllPopups;
      closeAllPopups();

      return waitForElement(".workershut-card-selector");
    },
    advanceOn: {
      selector: ".workershut-card-selector",
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
    title: "Build It",
    text: "Place your Workers Hut on any available hex. Use right-click to cancel",
    classes: STYLES.defaultStepPlacement,
    beforeShowPromise: function () {
      const overlay = document.querySelector(".shepherd-modal-overlay-container");
      if (overlay) {
        (overlay as HTMLElement).style.display = "none";
      }
      const closeAllPopups = useUIStore.getState().closeAllPopups;
      closeAllPopups();

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
