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
      useUIStore.getState().closeAllPopups();
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Pause",
    text: "To manage your resources, pausing a production building can be essential.",
    buttons: [StepButton.next],
  },
  {
    title: "Details",
    text: "Open the Details menu.",
    attachTo: {
      element: ".entity-details-selector",
      on: "right-start",
    },

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
    classes: "ml-5",
    buttons: [],
  },
  {
    title: "Realm Overview",
    text: "Your realm's details are displayed here.",
    attachTo: {
      element: ".building-entity-details-selector",
      on: "right",
    },
    beforeShowPromise: function () {
      return waitForElement(".building-entity-details-selector");
    },
    canClickTarget: false,
    classes: "ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Buildings Management",
    text: "Open the  buildings section.",
    attachTo: {
      element: ".buildings-tab-selector",
      on: "right-start",
    },
    advanceOn: {
      selector: ".buildings-tab-selector",
      event: "click",
    },
    classes: "ml-5",
    buttons: [],
  },
  {
    title: "Production Control",
    text: "Monitor all production buildings. Each one can be managed individually.",
    attachTo: {
      element: ".buildings-selector",
      on: "right",
    },
    beforeShowPromise: function () {
      return waitForElement(".buildings-selector");
    },
    canClickTarget: false,
    classes: "ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Economy Buildings",
    text: "Open the Economy section.",
    attachTo: {
      element: ".economy-building-selector",
      on: "bottom",
    },
    advanceOn: {
      selector: ".economy-building-selector",
      event: "click",
    },
    canClickTarget: true,
    classes: "mt-5",
    buttons: [],
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
    beforeShowPromise: function () {
      return waitForElement(".pause-building-button-selector");
    },
    buttons: [],
  },
  {
    title: "Important",
    text: "When a resource reaches its storage limit, any additional production of it will be lost.",
    attachTo: {
      element: ".storehouse-selector",
      on: "right-start",
    },
    classes: "ml-5 shepherd-warning",
    buttons: [StepButton.next],
  },
  {
    title: "Important",
    text: "If any input resource runs out, others will still be consumed without producing. Pause to prevent waste!",
    attachTo: {
      element: ".storehouse-selector",
      on: "right-start",
    },
    classes: "ml-5 shepherd-warning",
    buttons: [StepButton.finish],
  },
];
