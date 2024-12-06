import { StepOptions } from "shepherd.js";
import { StepButton } from "./utils";

export const travelSteps: StepOptions[] = [
  {
    title: "World View",
    text: "Click here.",
    attachTo: {
      element: ".map-button-selector",
      on: "auto",
    },
    advanceOn: {
      selector: ".map-button-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Stamina",
    text: "Traveling and Exploring use up the army's stamina, and consumes food.",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Eternum Cycle",
    text: "Every cycle, all armies' stamina regenerates for a small amount.",
    attachTo: {
      element: ".cycle-selector",
      on: "auto",
    },
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Explore",
    text: "Exploring undiscovered hexes rewards resources to your army, and possibly uncover hidden Fragment Mines.",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Travel",
    text: "Traveling grants no reward, but its stamina and food costs are reduced.",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Map Controls",
    text: "To move the camera, use left-click and drag, or use WASD keys.",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Army Controls",
    text: "Select your army with left-click.",
    attachTo: {
      element: ".world-selector",
      on: "auto",
    },
    classes: "!left-3/4 !top-1/4",
    buttons: [
      // StepButton.finish,
      StepButton.prev,
      {
        text: "Finish (Reloads the page)",
        action: function () {
          window.location.reload(); // Temp fix
        },
      },
    ],
  },
];
