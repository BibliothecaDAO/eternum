import useUIStore from "@/hooks/store/useUIStore";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";

export const settleSteps: StepOptions[] = [
  {
    title: "Welcome to Eternum",
    text: "Follow these tutorials to quickly learn all the game mechanics and get started on your journey!",
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Join our Discord",
    text: "Join our Discord community for game tips, friendly chat, and more!",
    attachTo: {
      element: ".discord-selector",
      on: "bottom",
    },
    classes: "mt-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Claim your rewards",
    text: "A gift of food from the gods.",
    showOn: function () {
      const element = document.querySelector(".claim-selector");
      return Boolean(element);
    },
    attachTo: {
      element: ".claim-selector",
      on: "right",
    },
    advanceOn: {
      selector: ".claim-selector",
      event: "click",
    },
    classes: "ml-5",
    buttons: [StepButton.prev],
  },
  {
    title: "Balance",
    text: "Let's view your resources. Open the 'Balance' tab.",
    attachTo: {
      element: ".resource-table-selector",
      on: "left",
    },
    advanceOn: {
      selector: ".resource-table-selector",
      event: "click",
    },
    classes: "-ml-5",
    buttons: [StepButton.prev],
  },
  {
    title: "View Resources",
    text: "This panel shows all available resources in your current realm.",
    attachTo: {
      element: ".entity-resource-table-selector",
      on: "left",
    },
    classes: "-ml-5",
    beforeShowPromise: function () {
      return waitForElement(".entity-resource-table-selector");
    },
    buttons: [
      {
        text: "Prev",
        action: function () {
          useUIStore.getState().setRightNavigationView(RightView.None);
          return this.back();
        },
      },
      StepButton.next,
    ],
  },
  {
    title: "Production & Consumption",
    text: "You'll see real-time production and consumption rates for each resource as you progress.",
    attachTo: {
      element: ".entity-resource-table-selector",
      on: "left",
    },
    classes: "-ml-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Continue Your Journey",
    text: "Complete more quests to unlock new features and discover everything Eternum has to offer!",
    buttons: [StepButton.prev, StepButton.finish],
  },
];
