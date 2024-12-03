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
    title: "Create Attack Army",
    text: "Click here to create a new attacking army to conquer the map. Troops can be exchanged between armies on the same hex.",
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
    title: "Troop Types",
    text: "You can view your armies here.   ",
    attachTo: {
      element: ".attacking-army-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    beforeShowPromise: function () {
      return waitForElement(".attacking-army-selector");
    },
    buttons: [StepButton.next],
  },
  {
    title: "Assign Troops",
    text: "Assign troops to your attacking army. Troops can be traded and transferred like any other resource, but once assigned, they cannot be reverted back.",
    attachTo: {
      element: ".attacking-army-edit-selector",
      on: "bottom",
    },
    classes: "mt-5",
    advanceOn: {
      selector: ".attacking-army-edit-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Troop Types",
    text: "There are three troop types: Paladins, Crossbowmen, and Knights. Paladins have more max energy, and Crossbowmen use less food while traveling.",
    attachTo: {
      element: ".attacking-army-selector",
      on: "right",
    },
    classes: "ml-5",
    // beforeShowPromise: function () {
    //   return waitForElement(".attacking-army-selector");
    // },
    buttons: [StepButton.prev, StepButton.next],
  },
];
