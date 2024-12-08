import useUIStore from "@/hooks/store/useUIStore";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const createAttackArmySteps: StepOptions[] = [
  {
    title: "Conquest in Eternum",
    text: "Create an attacking army to conquer your enemies and expand your influence across the realm.",
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      useUIStore.getState().closeAllPopups();
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Military Menu",
    text: "Open the Military menu.",
    attachTo: {
      element: ".military-selector",
      on: "right-start",
    },
    advanceOn: {
      selector: ".military-selector",
      event: "click",
    },
    classes: "ml-5",
    buttons: [],
  },
  {
    title: "Troop Resources",
    text: "Troops can be traded and transferred like any other resource, but once assigned to an army, they cannot be reverted back.",
    attachTo: {
      element: ".military-panel-selector",
      on: "right",
    },
    beforeShowPromise: function () {
      return waitForElement(".military-panel-selector");
    },
    canClickTarget: false,
    classes: "ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Attack Army",
    text: "Create an Attack army.",
    attachTo: {
      element: ".attack-army-selector",
      on: "top",
    },
    beforeShowPromise: function () {
      return waitForElement(".attack-army-selector");
    },
    advanceOn: {
      selector: ".attack-army-selector",
      event: "click",
    },
    showOn: () => {
      const elementExists = document.querySelector(".attacking-army-selector");
      return !elementExists;
    },
    classes: "-mt-5",
    buttons: [],
  },
  {
    title: "Transfer",
    text: "Armies can exchange troops while they are on the same hex.",
    attachTo: {
      element: ".defensive-army-swap-selector",
      on: "bottom",
    },
    canClickTarget: false,
    classes: "mt-5",
    buttons: [StepButton.next],
  },
  {
    title: "Edit",
    text: "Click the edit icon.",
    attachTo: {
      element: ".attacking-army-edit-selector",
      on: "top",
    },
    beforeShowPromise: function () {
      return waitForElement(".attacking-army-edit-selector");
    },
    advanceOn: {
      selector: ".attacking-army-edit-selector",
      event: "click",
    },
    classes: "-mt-5",
    buttons: [],
  },
  {
    title: "Assign Troops",
    text: "Assign troops to your attacking army.",
    attachTo: {
      element: ".attacking-army-selector",
      on: "top",
    },
    beforeShowPromise: function () {
      return waitForElement(".attacking-army-selector");
    },
    classes: "-mt-5",
    buttons: [StepButton.finish],
  },
];
