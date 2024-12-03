import useUIStore from "@/hooks/store/useUIStore";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";

export const buildFoodSteps: StepOptions[] = [
  {
    title: "Food",
    text: "Wheat and Fish are the lifeblood of your people and your economy.",
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Food Production",
    text: "Unlike other resources, food can be produced without consuming any other materials, making it your most sustainable resource.",
    buttons: [StepButton.next],
  },
  {
    title: "Food Usage",
    text: "Food is essential for many activities: constructing buildings, crafting resources, and sustaining your armies on their campaigns.",
    buttons: [StepButton.next],
  },
  {
    title: "Construction",
    text: "Open the Construction menu.",
    attachTo: {
      element: ".construction-selector",
      on: "right",
    },
    classes: "ml-5",
    advanceOn: {
      selector: ".construction-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Construction Panel",
    text: "Let's explore the Construction Panel, where you can build various buildings.",
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
    title: "Building Categories",
    text: "Buildings are organized by type - Resources, Economy and Military.",
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
    text: "Farms produce wheat and provide a 10% bonus to adjacent buildings.",
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
    text: "Fishing Villages provide a steady supply of fish.",
    attachTo: {
      element: ".fish-card-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Choose Your Food Source",
    text: "Select either a Farm or Fishing Village. More economic buildings will unlock as you progress.",
    attachTo: {
      element: ".economy-selector",
      on: "bottom",
    },
    classes: "mt-5",
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
    text: "Choose a location for your building by left-clicking on any available hex. To adjust your view, use the mouse wheel to zoom. You can cancel placement with either right-click or ESC key.",
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
      StepButton.finish,
    ],
  },
];
