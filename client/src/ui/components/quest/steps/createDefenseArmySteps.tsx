import useUIStore from "@/hooks/store/useUIStore";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const createDefenseArmySteps: StepOptions[] = [
  {
    title: "Realm Defense",
    text: "Your realm is always at risk. Assign it a defensive army for protection.",
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      useUIStore.getState().closeAllPopups();
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Claim",
    text: "A realm without defenses can be claimed by anyone instantly!",
    attachTo: {
      element: ".defensive-army-selector",
      on: "bottom",
    },
    classes: "mt-5",
    buttons: [StepButton.next],
  },

  {
    title: "Construction",
    text: "Open the Construction menu.",
    attachTo: {
      element: ".construction-selector",
      on: "right-start",
    },
    classes: "ml-5",
    advanceOn: {
      selector: ".construction-selector",
      event: "click",
    },
    buttons: [],
  },
  {
    title: "Tab Navigation",
    text: "Open the Military section",
    attachTo: {
      element: ".military-tab-selector",
      on: "right-start",
    },
    advanceOn: {
      selector: ".military-tab-selector",
      event: "click",
    },
    beforeShowPromise: function () {
      return waitForElement(".military-tab-selector");
    },
    classes: "ml-5",
    buttons: [],
  },
  {
    title: "Buildings",
    text: "You are limited to three movable armies and one protecting army, stationed on your Realm.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "bottom",
    },
    beforeShowPromise: function () {
      return waitForElement(".construction-panel-selector");
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.next],
  },
  {
    title: "Buildings",
    text: "Each military building you construct increases your max movable armies by +1, up to +3.",
    attachTo: {
      element: ".construction-panel-selector",
      on: "bottom",
    },
    beforeShowPromise: function () {
      return waitForElement(".construction-panel-selector");
    },
    canClickTarget: false,
    classes: "mt-5",
    buttons: [StepButton.next],
  },
  {
    title: "Barracks",
    text: "Knights are well-rounded units, balanced in both offense and defense",
    attachTo: {
      element: ".barracks-card-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.next],
  },
  {
    title: "Archery Range",
    text: "Crossbowmen require less food on their travels and weight less.",
    attachTo: {
      element: ".archery-card-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.next],
  },
  {
    title: "Stables",
    text: "Paladins have increased stamina, allowing them to cover more ground at once.",
    attachTo: {
      element: ".stable-card-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.next],
  },

  {
    title: "Military Menu",
    text: "Open the Military menu",
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
    title: "Defense Army",
    text: "Create a Defense army.",
    attachTo: {
      element: ".defense-army-selector",
      on: "top",
    },
    advanceOn: {
      selector: ".defense-army-selector",
      event: "click",
    },
    beforeShowPromise: function () {
      return waitForElement(".defense-army-selector");
    },
    showOn: () => {
      const showStep = document.querySelector(".defensive-army-selector");
      return !Boolean(showStep);
    },
    classes: "-mt-5",
    buttons: [],
  },
  {
    title: "Army Managemenet",
    text: "Monitor your army's stamina and inventory.",
    attachTo: {
      element: ".defensive-army-selector",
      on: "bottom",
    },
    beforeShowPromise: function () {
      return waitForElement(".defensive-army-selector");
    },
    canClickTarget: false,
    classes: "mt-5",
    buttons: [StepButton.next],
  },
  {
    title: "Edit",
    text: "Click the edit icon.",
    attachTo: {
      element: ".defensive-army-edit-selector",
      on: "top",
    },
    beforeShowPromise: function () {
      return waitForElement(".defensive-army-edit-selector");
    },
    advanceOn: {
      selector: ".defensive-army-edit-selector",
      event: "click",
    },
    classes: "-mt-5",
    buttons: [],
  },
  {
    title: "Assign Troops",
    text: "Assign troops to your defensive army.",
    attachTo: {
      element: ".defensive-army-selector",
      on: "top",
    },
    beforeShowPromise: function () {
      return waitForElement(".defensive-army-selector");
    },
    classes: "-mt-5",
    buttons: [StepButton.finish],
  },
];
