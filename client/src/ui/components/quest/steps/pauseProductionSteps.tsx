import useUIStore from "@/hooks/store/useUIStore";
import { BUILDINGS_CENTER } from "@/three/scenes/constants";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const pauseProductionSteps: StepOptions[] = [
  {
    title: "Production",
    text: "Buildings automatically start producing once built.",
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Pause",
    text: "To manage your resources, pausing a production building can be essential.",
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Details",
    text: "Click here.",
    attachTo: {
      element: ".entity-details-selector",
      on: "right",
    },
    classes: "ml-5",
    beforeShowPromise: function () {
      const selectedBuildingHex = useUIStore.getState().selectedBuildingHex;
      const setSelectedBuildingHex = useUIStore.getState().setSelectedBuildingHex;
      setSelectedBuildingHex({ ...selectedBuildingHex, innerCol: BUILDINGS_CENTER[0], innerRow: BUILDINGS_CENTER[1] });
      return new Promise<void>((resolve) => resolve());
    },
    advanceOn: {
      selector: ".entity-details-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Realm Overview",
    text: "Your realm's details are displayed here.",
    attachTo: {
      element: ".building-entity-details-selector",
      on: "right",
    },
    classes: "ml-5",
    beforeShowPromise: function () {
      return waitForElement(".building-entity-details-selector");
    },
    canClickTarget: false,
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
    title: "Buildings Management",
    text: "Open the buildings tab",
    attachTo: {
      element: ".buildings-tab-selector",
      on: "right",
    },
    classes: "ml-5",
    advanceOn: {
      selector: ".buildings-tab-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Production Control",
    text: "Monitor all production buildings. Each one can be managed individually.",
    attachTo: {
      element: ".buildings-selector",
      on: "right",
    },
    classes: "ml-5",
    canClickTarget: false,
    beforeShowPromise: function () {
      return waitForElement(".buildings-selector");
    },
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Pause Production",
    text: "Click the pause button to stop its production and resource consumption.",
    attachTo: {
      element: ".pause-building-button-selector",
      on: "bottom",
    },
    classes: "mt-5",
    advanceOn: {
      selector: ".pause-building-button-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Storage Waste",
    text: "When a resource reaches its storage limit, any additional production of it will be lost.",
    attachTo: {
      element: ".storehouse-selector",
      on: "right",
    },
    classes: "ml-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Resource Efficiency",
    text: "If any input resource runs out, others will still be consumed without producing. Pause to prevent waste!",
    attachTo: {
      element: ".storehouse-selector",
      on: "right",
    },
    classes: "ml-5",
    buttons: [StepButton.prev, StepButton.complete],
  },
];
