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
      useUIStore.getState().closeAllPopups();
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
    buttons: [StepButton.next],
  },
  {
    title: "Claim your reward",
    text: () => {
      const wheatIcon = document.createElement("img");
      wheatIcon.src = "/images/resources/254.png";
      wheatIcon.className = "w-8 h-8 inline-block mx-1";
      wheatIcon.title = "Wheat";

      const fishIcon = document.createElement("img");
      fishIcon.src = "/images/resources/255.png";
      fishIcon.className = "w-8 h-8 inline-block mx-1";
      fishIcon.title = "Fish";

      const container = document.createElement("div");
      container.innerHTML = `Claim your gift: free ${wheatIcon.outerHTML} and ${fishIcon.outerHTML}`;

      return container.innerHTML;
    },
    attachTo: {
      element: ".claim-selector",
      on: "bottom",
    },
    advanceOn: {
      selector: ".claim-selector",
      event: "click",
    },
    classes: "mt-5",
    buttons: [],
  },

  {
    title: "Resource Balance",
    text: "Open the Balance menu.",
    attachTo: {
      element: ".resource-table-selector",
      on: "left-start",
    },
    advanceOn: {
      selector: ".resource-table-selector",
      event: "click",
    },
    classes: "-ml-5",
    buttons: [],
  },

  {
    title: "Resources",
    text: () => {
      const wheatIcon = document.createElement("img");
      wheatIcon.src = "/images/resources/254.png";
      wheatIcon.className = "w-8 h-8 inline-block mx-1";
      wheatIcon.title = "Wheat";

      const fishIcon = document.createElement("img");
      fishIcon.src = "/images/resources/255.png";
      fishIcon.className = "w-8 h-8 inline-block mx-1";
      fishIcon.title = "Fish";

      const container = document.createElement("div");
      container.innerHTML = `${wheatIcon.outerHTML} and ${fishIcon.outerHTML} are the lifeblood of your economy.`;

      return container.innerHTML;
    },
    attachTo: {
      element: ".entity-resource-table-selector",
      on: "left",
    },
    beforeShowPromise: function () {
      return waitForElement(".entity-resource-table-selector");
    },
    classes: "-ml-5",
    buttons: [StepButton.next],
  },

  {
    title: "Social",
    text: "Forge alliances, create or join a Tribe.",
    attachTo: {
      element: ".social-selector",
      on: "bottom",
    },
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      return new Promise<void>((resolve) => resolve());
    },
    canClickTarget: false,
    classes: "mt-5",
    buttons: [StepButton.next],
  },
  {
    title: "Join our Discord",
    text: "Join the community for game tips, friendly chat, and more!",
    attachTo: {
      element: ".discord-selector",
      on: "bottom",
    },
    classes: "mt-5",
    buttons: [StepButton.next],
  },
  {
    title: "Settings",
    text: "Customize your game experience.",
    attachTo: {
      element: ".settings-selector",
      on: "bottom",
    },
    canClickTarget: false,
    classes: "mt-5",
    buttons: [StepButton.next],
  },
  {
    title: "Continue Your Journey",
    text: "Complete more quests and discover everything Eternum has to offer!",
    attachTo: {
      element: ".tutorial-selector",
      on: "bottom",
    },
    canClickTarget: false,
    classes: "mt-5",
    buttons: [StepButton.finish],
  },
];
