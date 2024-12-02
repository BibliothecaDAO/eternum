import useUIStore from "@/hooks/store/useUIStore";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const buildFoodSteps: StepOptions[] = [
  {
    title: "Food",
    text: "Wheat and Fish are the lifeblood of your people and your economy.",
    classes: "!top-1/4",
    buttons: [StepButton.next],
  },
  {
    title: "Food Production",
    text: "Unlike other resources, food can be produced without consuming any other materials, making it your most sustainable resource.",
    classes: "!top-1/4",
    buttons: [StepButton.next],
  },
  {
    title: "Food Usage",
    text: "Food is essential for many activities: constructing buildings, crafting resources, and sustaining your armies on their campaigns.",
    classes: "!top-1/4",
    buttons: [StepButton.next],
  },
  {
    title: "Construction",
    text: "Open the Construction menu to start building your first food production facility.",
    attachTo: {
      element: ".construction-selector",
      on: "right",
    },
    advanceOn: {
      selector: ".construction-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Food Buildings",
    text: "You can build either a Farm for wheat production or a Fishing Village for fish. Both are excellent sources of food for your civilization.",
    attachTo: {
      element: ".economy-selector",
      on: "right",
    },
    beforeShowPromise: function () {
      const closeAllPopups = useUIStore.getState().closeAllPopups;
      closeAllPopups();

      return waitForElement(".economy-selector");
    },
    canClickTarget: false,
    buttons: [
      {
        text: "Prev",
        action: function () {
          const setLeftNavigationView = useUIStore.getState().setLeftNavigationView;
          setLeftNavigationView(LeftView.None);

          return this.back();
        },
      },
      StepButton.next,
    ],
  },
  {
    title: "Building Bonus",
    text: "Farms also give a 10% production bonus to any adjacent buildings. Think carefully before placing your buildings!",
    attachTo: {
      element: ".farm-card-selector",
      on: "right",
    },
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Select Building",
    text: "Now click on either a Farm or Fishing Village to begin placement.",
    attachTo: {
      element: ".economy-selector",
      on: "bottom-start",
    },
    advanceOn: {
      selector: ".economy-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Place Building",
    text: "Choose a location for your building by left-clicking on any available hex. To adjust your view, use the mouse wheel to zoom. You can cancel placement with either right-click or ESC key.",
    classes: "!top-1/4",
    beforeShowPromise: function () {
      const overlay = document.querySelector(".shepherd-modal-overlay-container");
      if (overlay) {
        (overlay as HTMLElement).style.display = "none";
      }

      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.prev, StepButton.finish],
  },
];
