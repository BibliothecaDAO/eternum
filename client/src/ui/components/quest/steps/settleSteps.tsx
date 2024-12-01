import useUIStore from "@/hooks/store/useUIStore";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { STYLES, waitForElement } from "./utils";

export const settleSteps: StepOptions[] = [
  {
    title: "Welcome to Eternum",
    text: "The gods have blessed you with food to begin your journey",
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
    title: "Claim Resources",
    text: "Claim your resources.",
    classes: STYLES.defaultStepPlacement,
    attachTo: {
      element: ".claim-selector",
    },
    advanceOn: {
      selector: ".claim-selector",
      event: "click",
    },
    showOn: function () {
      const element = document.querySelector(".claim-selector");
      return Boolean(element);
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
    title: "Resource Management",
    text: "View your resources here.",
    attachTo: {
      element: ".resource-table-selector",
      on: "bottom",
    },
    advanceOn: {
      selector: ".resource-table-selector",
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
    title: "Resource Management",
    text: "Here you can see all your available resources and their production rates.",
    attachTo: {
      element: ".entity-resource-table-selector",
      on: "top-end",
    },
    beforeShowPromise: function () {
      return waitForElement(".entity-resource-table-selector");
    },
    buttons: [
      {
        text: "Prev",
        action: function () {
          const setRightNavigationView = useUIStore.getState().setRightNavigationView;
          setRightNavigationView(RightView.None);

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
