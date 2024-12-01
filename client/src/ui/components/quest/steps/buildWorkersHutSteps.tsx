import { configManager } from "@/dojo/setup";
import useUIStore from "@/hooks/store/useUIStore";
import { BuildingType } from "@bibliothecadao/eternum";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const buildWorkersHutSteps: StepOptions[] = [
  {
    title: "Population Management",
    text: `Each building takes up population in your realm. Your realm starts with a population of ${configManager.getBasePopulationCapacity()}. Build worker huts to extend your population capacity by ${
      configManager.getBuildingPopConfig(BuildingType.WorkersHut).capacity
    }.`,
    buttons: [StepButton.next],
  },
  {
    title: "Population Overview",
    text: "Monitor your realm's population capacity and usage here",
    attachTo: {
      element: ".population-selector",
      on: "auto",
    },
    beforeShowPromise: function () {
      return waitForElement(".population-selector");
    },
    buttons: [StepButton.prev, StepButton.next],
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
    buttons: [StepButton.prev],
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
    buttons: [StepButton.prev],
  },
  {
    title: "Build It",
    text: "Place your Workers Hut on any available hex. Use right-click to cancel",
    beforeShowPromise: function () {
      const overlay = document.querySelector(".shepherd-modal-overlay-container");
      if (overlay) {
        (overlay as HTMLElement).style.display = "none";
      }
      const closeAllPopups = useUIStore.getState().closeAllPopups;
      closeAllPopups();

      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.prev, StepButton.finish],
  },
];
