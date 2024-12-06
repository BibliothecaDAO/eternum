import useUIStore from "@/hooks/store/useUIStore";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const buildResourceSteps: StepOptions[] = [
  {
    title: "Construction",
    text: "Open the construction menu",
    attachTo: {
      element: ".construction-selector",
      on: "right",
    },
    classes: "ml-5",
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
    title: "Resource buildings",
    text: "Open the Resources tab",
    attachTo: {
      element: ".resource-tab-selector",
      on: "right",
    },
    classes: "ml-5",
    modalOverlayOpeningPadding: 10,
    advanceOn: {
      selector: ".resource-tab-selector",
      event: "click",
    },
    beforeShowPromise: function () {
      useUIStore.getState().closeAllPopups();
      return waitForElement(".resource-tab-selector");
    },
    buttons: [
      {
        text: "Prev",
        action: function () {
          useUIStore.getState().setLeftNavigationView(LeftView.None);
          return this.back();
        },
      },
    ],
  },
  {
    title: "Resources",
    text: "Each realm has access to a set of resources it can produce.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    beforeShowPromise: function () {
      return waitForElement(".construction-panel-selector");
    },
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Consumption",
    text: "Producing resources requires consuming others in the process.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Consumption",
    text: "For example, a Wood producing facility will consume Coal, Stone, and Wheat.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Resources Buildings",
    text: "Select a Resource Facility.",
    attachTo: {
      element: ".resource-cards-selector",
      on: "bottom",
    },
    classes: "mt-5",
    advanceOn: {
      selector: ".resource-cards-selector",
      event: "click",
    },
    beforeShowPromise: function () {
      const closeAllPopups = useUIStore.getState().closeAllPopups;
      closeAllPopups();
      return waitForElement(".resource-cards-selector");
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
    buttons: [StepButton.prev, StepButton.next],
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
    title: "Consumption",
    text: "Try to keep an eye on your consumption rates.",
    attachTo: {
      element: ".entity-resource-table-selector",
      on: "left",
    },
    beforeShowPromise: function () {
      return waitForElement(".entity-resource-table-selector");
    },
    classes: "-ml-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Warning",
    text: "Missing resources won't stop other materials from being consumed!",
    attachTo: {
      element: ".entity-resource-table-selector",
      on: "left",
    },
    classes: "-ml-5",
    buttons: [StepButton.prev, StepButton.finish],
  },
];
