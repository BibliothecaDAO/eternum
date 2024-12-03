import useUIStore from "@/hooks/store/useUIStore";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const createDefenseArmySteps: StepOptions[] = [
  {
    title: "Realm Defense",
    text: "Your realm is always at risk. Learn how to create a defensive army to protect it.",
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
    title: "Create Defense Army",
    text: "Click here to create a new defensive army for your realm. Without a defensive army, anyone can claim your realm for free!",
    attachTo: {
      element: ".defense-army-selector",
      on: "top",
    },
    classes: "-mt-5",
    beforeShowPromise: function () {
      return waitForElement(".defense-army-selector");
    },
    advanceOn: {
      selector: ".defense-army-selector",
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
    text: "There are three troop types: Paladins, Crossbowmen, and Knights. Paladins have more max energy, and Crossbowmen use less food while traveling.",
    attachTo: {
      element: ".attacking-army-selector",
      on: "bottom",
    },
    classes: "mt-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Assign Troops",
    text: "Assign troops to your defensive army. Troops can be traded and transferred like any other resource, but once assigned, they cannot be reverted back.",
    attachTo: {
      element: ".defensive-army-edit-selector",
      on: "top",
    },
    classes: "-mt-5",
    beforeShowPromise: function () {
      return waitForElement(".defensive-army-edit-selector");
    },
    buttons: [StepButton.prev, StepButton.finish],
  },
];
