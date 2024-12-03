import useUIStore from "@/hooks/store/useUIStore";
import { BUILDINGS_CENTER } from "@/three/scenes/constants";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";

export const pauseProductionSteps: StepOptions[] = [
  {
    title: "Production",
    text: "Your buildings automatically produce resources over time. Let's learn how to manage your production efficiently.",
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Building Details",
    text: "First, let's check your building information. Click the Details tab to continue.",
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
    title: "Building Information",
    text: "This panel shows you everything you need to know about your selected building, including its production rates and resource requirements.",
    attachTo: {
      element: ".building-entity-details-selector",
      on: "right",
    },
    classes: "ml-5",
    canClickTarget: false,
    beforeShowPromise: function () {
      return waitForElement(".building-entity-details-selector");
    },
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Your Realm Overview",
    text: "Your realm's details are displayed here, including its current level, available upgrades, and production capacity.",
    attachTo: {
      element: ".building-entity-details-selector",
      on: "right",
    },
    classes: "ml-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
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
    text: "Here you can see all your active production buildings. Each one can be managed individually.",
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
    title: "Storage Limits",
    text: "Your storehouse can hold a limited amount of each resource, measured by weight (Kg). Plan your storage capacity carefully!",
    attachTo: {
      element: ".storehouse-selector",
      on: "right",
    },
    classes: "ml-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Storage Management",
    text: "When your storage is full, any additional resources produced will be lost. Keep an eye on your storage levels!",
    attachTo: {
      element: ".storehouse-selector",
      on: "right",
    },
    classes: "ml-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Resource Efficiency",
    text: "Pro tip: Production requires all three input resources. If one runs out, the other two will still be consumed without producing anything. Pause production to prevent wasting resources!",
    attachTo: {
      element: ".storehouse-selector",
      on: "right",
    },
    classes: "ml-5",
    buttons: [StepButton.prev, StepButton.complete],
  },
];
