import useUIStore from "@/hooks/store/useUIStore";
import { BUILDINGS_CENTER } from "@/three/scenes/constants";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const pauseProductionSteps: StepOptions[] = [
  {
    title: "Pause Production",
    text: "Resource facilities will produce resources automatically. Learn how to pause production to stop resource consumption.",
    buttons: [StepButton.next],
  },

  {
    title: "Details tab",
    text: "Open the details tab",
    attachTo: {
      element: ".entity-details-selector",
      on: "right",
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
    buttons: [StepButton.prev],
  },

  {
    title: "buildings buildings",
    text: "Open the buildings tab",
    attachTo: {
      element: ".buildings-tab-selector",
      on: "right",
    },
    advanceOn: {
      selector: ".buildings-tab-selector",
      event: "click",
    },

    beforeShowPromise: function () {
      return waitForElement(".buildings-tab-selector");
    },

    buttons: [StepButton.prev],
  },

  {
    title: "Pause Production",
    text: "Click the pause button to stop resource production and consumption",
    attachTo: {
      element: ".buildings-selector",
    },
    beforeShowPromise: function () {
      return waitForElement(".buildings-selector");
    },
    buttons: [StepButton.prev, StepButton.next],
  },

  {
    title: "Pause Production",
    text: "Click the pause button to stop resource production and consumption",
    attachTo: {
      element: ".pause-building-button-selector",
      on: "bottom",
    },
    advanceOn: {
      selector: ".pause-building-button-selector",
      event: "click",
    },
    buttons: [
      StepButton.prev,
      //   {
      //     text: "Finish",
      //     action: function () {
      //       return this.complete();
      //     },
      //
      //   },
    ],
  },
];
