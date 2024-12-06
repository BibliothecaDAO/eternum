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
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Military Menu",
    text: "Open the military menu to manage your armies",
    attachTo: {
      element: ".military-selector",
      on: "right",
    },
    classes: "ml-5",
    advanceOn: {
      selector: ".military-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Troop Resources",
    text: "Troops can be traded and transferred like any other resource, but once assigned to an army, they cannot be reverted back.",
    attachTo: {
      element: ".military-panel-selector",
      on: "right",
    },
    classes: "ml-5",
    canClickTarget: false,
    beforeShowPromise: function () {
      return waitForElement(".military-panel-selector");
    },
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
    title: "Create Attack Army",
    text: "Click here.",
    attachTo: {
      element: ".attack-army-selector",
      on: "top",
    },
    classes: "-mt-5",
    beforeShowPromise: function () {
      return waitForElement(".attack-army-selector");
    },
    advanceOn: {
      selector: ".attack-army-selector",
      event: "click",
    },
    showOn: () => {
      const showStep = document.querySelector(".attacking-army-selector");
      return !Boolean(showStep);
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
    title: "Transfer",
    text: "Armies can exchange troops while they are on the same hex.",
    attachTo: {
      element: ".defensive-army-swap-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Edit",
    text: "Click the edit icon.",
    attachTo: {
      element: ".attacking-army-edit-selector",
      on: "top",
    },
    classes: "-mt-5",
    beforeShowPromise: function () {
      return waitForElement(".attacking-army-edit-selector");
    },
    advanceOn: {
      selector: ".attacking-army-edit-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Assign Troops",
    text: "Assign troops to your attacking army.",
    attachTo: {
      element: ".attacking-army-selector",
      on: "top",
    },
    classes: "-mt-5",
    beforeShowPromise: function () {
      return waitForElement(".attacking-army-selector");
    },
    buttons: [StepButton.prev, StepButton.finish],
  },
];
