import useUIStore from "@/hooks/store/useUIStore";
import { StepOptions } from "shepherd.js";
import { STYLES, waitForElement } from "./utils";

export const createDefenseArmySteps: StepOptions[] = [
  {
    title: "Realm Defense",
    text: "Your realm is always at risk. Learn how to create a defensive army to protect it.",
    classes: STYLES.defaultStepPlacement,
    buttons: [
      {
        text: "Next",
        action: function () {
          return this.next();
        },
        classes: STYLES.defaultButton,
      },
    ],
  },
  {
    title: "Military Menu",
    text: "Open the military menu to manage your armies",
    attachTo: {
      element: ".military-selector",
      on: "top",
    },
    advanceOn: {
      selector: ".military-selector",
      event: "click",
    },
    buttons: [
      {
        text: "Prev",
        action: function () {
          return this.back();
        },
        classes: STYLES.defaultButton,
      },
    ],
  },
  {
    title: "Create Defense Army",
    text: "Click here to create a new defensive army for your realm",
    attachTo: {
      element: ".defense-army-selector",
      on: "top",
    },
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
          return this.back();
        },
        classes: STYLES.defaultButton,
      },
    ],
  },
  {
    title: "Assign Troops",
    text: "Assign troops to your defensive army. Without troops, enemies can claim your realm for free!",
    attachTo: {
      element: ".defensive-army-selector",
      on: "top",
    },
    beforeShowPromise: function () {
      return waitForElement(".defensive-army-selector");
    },
    buttons: [
      {
        text: "Prev",
        action: function () {
          return this.back();
        },
        classes: STYLES.defaultButton,
      },
      {
        text: "Finish",
        action: function () {
          return this.complete();
        },
        classes: STYLES.defaultButton,
      },
    ],
  },
];
