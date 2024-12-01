import useUIStore from "@/hooks/store/useUIStore";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const travelSteps: StepOptions[] = [
  {
    title: "World Navigation",
    text:
      // (
      //   <div className="space-y-4">
      //     <p>
      "          Move your army across the world map using two methods: travel and explore.",
    //     </p>
    //     <ExplorationTable />
    //   </div>
    // ),
    buttons: [StepButton.next],
  },
  {
    title: "Navigation Controls",
    text: "Use these controls to navigate the world map",
    attachTo: {
      element: ".world-navigation-selector",
      on: "auto",
    },
    beforeShowPromise: function () {
      return waitForElement(".world-navigation-selector");
    },
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Eternum Cycle",
    text: "Keep track of the current Eternum cycle and its effects on the world",
    attachTo: {
      element: ".cycle-selector",
      on: "auto",
    },
    beforeShowPromise: function () {
      return waitForElement(".cycle-selector");
    },
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "View Toggle",
    text: "Switch between world view and realm view using this button",
    attachTo: {
      element: ".map-button-selector",
      on: "auto",
    },
    beforeShowPromise: function () {
      return waitForElement(".map-button-selector");
    },
    advanceOn: {
      selector: ".map-button-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Army Controls",
    text:
      // (
      //   <p>
      "Left click on your army or the tile under it to select it. Press Esc",
    //     <strong>
    //       <span className="border border-gold px-1">Esc</span>
    //     </strong>{" "}
    //     to cancel any action.
    //   </p>
    // ),
    attachTo: {
      element: ".world-selector",
      on: "auto",
    },
    beforeShowPromise: function () {
      const closeAllPopups = useUIStore.getState().closeAllPopups;
      closeAllPopups();
      return waitForElement(".world-selector");
    },
    buttons: [StepButton.prev, StepButton.finish],
  },
];
