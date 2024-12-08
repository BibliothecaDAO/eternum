import useUIStore from "@/hooks/store/useUIStore";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const buildResourceSteps: StepOptions[] = [
  {
    title: "Construction",
    text: "Open the Construction menu",
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
    title: "Tab Navigation",
    text: "Open the Resource section.",
    attachTo: {
      element: ".resource-tab-selector",
      on: "right-start",
    },
    advanceOn: {
      selector: ".resource-tab-selector",
      event: "click",
    },
    beforeShowPromise: function () {
      return waitForElement(".resource-tab-selector");
    },
    classes: "ml-5",
    buttons: [],
  },
  {
    title: "Resources",
    text: "Each realm has access to a set of resources it can produce.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "right",
    },
    classes: "ml-5",
    canClickTarget: false,
    beforeShowPromise: function () {
      return waitForElement(".construction-panel-selector");
    },
    buttons: [StepButton.next],
  },
  {
    title: "Important",
    text: "Producing resources requires consuming others in the process.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "right",
    },
    classes: "ml-5 shepherd-warning",
    canClickTarget: false,
    buttons: [StepButton.next],
  },
  {
    title: "Consumption",
    text: "For example, a Wood producing facility will consume Coal, Stone, and Wheat.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "right",
    },
    classes: "ml-5",
    canClickTarget: false,
    buttons: [StepButton.next],
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
    buttons: [StepButton.next],
  },
  {
    title: "Important",
    text: "Missing resources won't stop other materials from being consumed !",
    attachTo: {
      element: ".entity-resource-table-selector",
      on: "left",
    },
    classes: "-ml-5 shepherd-warning",
    buttons: [StepButton.finish],
  },
];
