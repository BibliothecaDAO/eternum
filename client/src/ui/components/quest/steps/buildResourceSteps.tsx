import useUIStore from "@/hooks/store/useUIStore";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";

export const buildResourceSteps: StepOptions[] = [
  {
    title: "Build a Resource Facility",
    text: "Eternum thrives on resources. Construct resource facilities to harvest them efficiently.",
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Construction tab",
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
    title: "Resource Production",
    text: "Your Realm comes with access to specific resources.",
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
    title: "Resource Consumption",
    text: "Producing resources requires consuming others. For example, producing wood consumes coal, stone, and wheat.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Resource Acquisition",
    text: "Need resources you can't produce? You can trade with other Realms or acquire them through military conquest.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Strategic Choices",
    text: "Decide which resources to focus on to align with your long-term strategy.",
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
    text: "Left-click any hex to place your building. Remember: mouse wheel to zoom, right-click or ESC to cancel.",
    classes: "!left-3/4 !top-1/4",
    attachTo: {
      element: ".world-selector",
    },
    highlightClass: "allow-modal-click",
    buttons: [StepButton.prev, StepButton.finish],
  },
];
