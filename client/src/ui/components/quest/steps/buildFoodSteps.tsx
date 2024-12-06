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
      on: "right",
    },
    classes: "ml-5 requires-interaction",
    advanceOn: {
      selector: ".construction-selector",
      event: "click",
    },
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.prev],
  },

  {
    title: "Buildings",
    text: "Various types of buildings are available to you.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "right",
    },
    classes: "ml-5",
    canClickTarget: false,
    beforeShowPromise: function () {
      useUIStore.getState().closeAllPopups();
      return waitForElement(".construction-panel-selector");
    },
    buttons: [
      {
        text: "Prev",
        action: function () {
          useUIStore.getState().setLeftNavigationView(LeftView.None);
          return this.back();
        },
      },
      StepButton.next,
    ],
  },

  {
    title: "Building Types",
    text: "Buildings are organized by type - Resource, Economy and Military.",
    attachTo: {
      element: ".construction-tabs-selector",
      on: "right",
    },
    classes: "ml-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Farm",
    text: "Produces Wheat and provides a 10% production bonus to adjacent buildings.",
    attachTo: {
      element: ".farm-card-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Fishing Village",
    text: "Provides a steady supply of Fish.",
    attachTo: {
      element: ".fish-card-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Market",
    text: "Produces Donkeys. More on that later.",
    attachTo: {
      element: ".market-card-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Worker's Hut",
    text: "Increases your population capacity.",
    attachTo: {
      element: ".workers-hut-card-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Population",
    text: "Constructing buildings use up available population.",
    attachTo: {
      element: ".population-selector",
      on: "bottom",
    },
    classes: "mt-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Storehouse",
    text: "Increases your storage limit.",
    attachTo: {
      element: ".storehouse-card-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Storage",
    text: "Each resource has its own individual storage limit.",
    attachTo: {
      element: ".storehouse-selector",
      on: "right",
    },
    classes: "ml-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Choose Your Food Source",
    text: "Select either a Farm or Fishing Village.",
    attachTo: {
      element: ".economy-selector",
      on: "bottom",
    },
    classes: "mt-5 requires-interaction",
    beforeShowPromise: function () {
      return waitForElement(".economy-selector");
    },
    advanceOn: {
      selector: ".economy-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Place Building",
    text: "Left-click to confirm, mouse wheel to zoom, right-click or ESC to cancel.",
    classes: "!left-3/4 !top-1/4",
    attachTo: {
      element: ".world-selector",
    },
    highlightClass: "allow-modal-click",
    buttons: [
      {
        text: "Prev",
        action: function () {
          useUIStore.getState().setLeftNavigationView(LeftView.ConstructionView);
          return this.back();
        },
      },
      StepButton.next,
    ],
  },
  {
    title: "Balance",
    text: "Click here to view your resources.",
    attachTo: {
      element: ".resource-table-selector",
      on: "left",
    },
    advanceOn: {
      selector: ".resource-table-selector",
      event: "click",
    },
    classes: "-ml-5 requires-interaction",
    buttons: [StepButton.prev],
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
    buttons: [StepButton.prev, StepButton.finish],
  },
];
