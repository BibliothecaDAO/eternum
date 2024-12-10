import useUIStore from "@/hooks/store/useUIStore";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const buildFoodSteps: StepOptions[] = [
  {
    title: "Construction",
    text: "Open the Construction menu.",
    attachTo: {
      element: ".construction-selector",
      on: "right-start",
    },
    advanceOn: {
      selector: ".construction-selector",
      event: "click",
    },
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      useUIStore.getState().closeAllPopups();
      return new Promise<void>((resolve) => resolve());
    },
    classes: "ml-5",
    buttons: [],
  },

  {
    title: "Buildings",
    text: "Various types of buildings are available to you.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "right",
    },
    beforeShowPromise: function () {
      return waitForElement(".construction-panel-selector");
    },
    canClickTarget: false,
    classes: "ml-5",
    buttons: [StepButton.next],
  },

  {
    title: "Building Types",
    text: "Buildings are organized by type - Resource, Economy and Military.",
    attachTo: {
      element: ".construction-tabs-selector",
      on: "right-start",
    },
    canClickTarget: false,
    classes: "ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Farm",
    text: () => {
      const wheatIcon = document.createElement("img");
      wheatIcon.src = "/images/resources/254.png";
      wheatIcon.className = "w-8 h-8 inline-block mx-1";
      wheatIcon.title = "Wheat";

      const container = document.createElement("div");
      container.innerHTML = `Produces ${wheatIcon.outerHTML} and provides a 10% production bonus to adjacent buildings `;

      return container.innerHTML;
    },
    attachTo: {
      element: ".farm-card-selector",
      on: "right",
    },
    canClickTarget: false,
    classes: "ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Fishing Village",
    text: () => {
      const fishIcon = document.createElement("img");
      fishIcon.src = "/images/resources/255.png";
      fishIcon.className = "w-8 h-8 inline-block mx-1";
      fishIcon.title = "Fish";

      const container = document.createElement("div");
      container.innerHTML = `Provides a steady supply of ${fishIcon.outerHTML}`;

      return container.innerHTML;
    },
    attachTo: {
      element: ".fish-card-selector",
      on: "right",
    },
    canClickTarget: false,
    classes: "ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Market",
    text: "Produces Donkeys. More on that later.",
    attachTo: {
      element: ".market-card-selector",
      on: "right",
    },
    classes: "ml-5",
    canClickTarget: false,
    buttons: [StepButton.next],
  },
  {
    title: "Worker's Hut",
    text: "Increases your population capacity.",
    attachTo: {
      element: ".workers-hut-card-selector",
      on: "right",
    },
    canClickTarget: false,
    classes: "ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Population",
    text: "Constructing buildings requires available population.",
    attachTo: {
      element: ".population-selector",
      on: "right-start",
    },
    classes: "ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Storehouse",
    text: "Increases your storage limit.",
    attachTo: {
      element: ".storehouse-card-selector",
      on: "right",
    },
    canClickTarget: false,
    classes: "ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Important",
    text: "Each resource has its own individual storage limit.",
    attachTo: {
      element: ".storehouse-selector",
      on: "right-start",
    },
    classes: "ml-5 shepherd-warning",
    buttons: [StepButton.next],
  },
  {
    title: "Choose Your Food Source",
    text: "Select either a Farm or Fishing Village.",
    attachTo: {
      element: ".farm-card-selector",
      on: "top",
    },
    extraHighlights: [".fish-card-selector"],
    advanceOn: {
      selector: ".economy-selector",
      event: "click",
    },
    classes: "-mt-5",
    buttons: [],
  },
  {
    title: "Place Building",
    text: `
      <div class="flex flex-col">
        <span>Left-click to confirm</span>
        <span>Mouse-wheel to zoom</span>
        <span>Right-click or ESC to cancel.</span>
      </div>`,
    classes: "!left-3/4 !top-1/4",
    attachTo: {
      element: ".world-selector",
    },
    highlightClass: "allow-modal-click",
    buttons: [StepButton.next],
  },
  {
    title: "Resource Balance",
    text: "Open the menu.",
    attachTo: {
      element: ".resource-table-selector",
      on: "left-start",
    },
    advanceOn: {
      selector: ".resource-table-selector",
      event: "click",
    },
    classes: "-ml-5",
    buttons: [],
  },
  {
    title: "Production",
    text: "Follow production rates in real-time.",
    attachTo: {
      element: ".entity-resource-table-selector",
      on: "left",
    },
    beforeShowPromise: function () {
      return waitForElement(".entity-resource-table-selector");
    },
    classes: "-ml-5",
    buttons: [StepButton.finish],
  },
];
