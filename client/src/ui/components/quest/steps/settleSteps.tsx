import useUIStore from "@/hooks/store/useUIStore";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const settleSteps: StepOptions[] = [
  {
    title: "Welcome to Eternum",
    text: "Follow these tutorials to get started on your journey.",
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Quests & Rewards",
    text: "Complete quests to claim valuable resources.",
    attachTo: {
      element: ".tutorial-selector",
      on: "bottom",
    },
    canClickTarget: false,
    classes: "mt-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Claim your reward",
    text: "Click here to receive free Wheat and Fish.",
    attachTo: {
      element: ".claim-selector",
      on: "bottom",
    },
    advanceOn: {
      selector: ".claim-selector",
      event: "click",
    },
    classes: "mt-5 requires-interaction",
    buttons: [StepButton.prev],
  },
  {
    title: "Balance",
    text: "Click here to view your resources.",
    attachTo: {
      element: ".resource-table-selector",
      on: "left",
    },
    advanceOn: {
      selector: ".resource-table-selector",
      event: "click",
    },
    classes: "-ml-5 requires-interaction",
    buttons: [StepButton.prev],
  },
  {
    title: "Resources",
    text: "Fish and Wheat are lifeblood of your people economy.",
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
    title: "Continue Your Journey",
    attachTo: {
      element: ".tutorial-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    text: "Complete more quests and discover everything Eternum has to offer!",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Social",
    text: "Forge alliances, create or join a Tribe.",
    attachTo: {
      element: ".social-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Join our Discord",
    text: "Join the community for game tips, friendly chat, and more!",
    attachTo: {
      element: ".discord-selector",
      on: "bottom",
    },
    classes: "mt-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Settings",
    text: "Customize your game experience.",
    attachTo: {
      element: ".settings-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.finish],
  },
];
