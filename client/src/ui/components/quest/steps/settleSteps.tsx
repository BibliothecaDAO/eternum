import useUIStore from "@/hooks/store/useUIStore";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const settleSteps: StepOptions[] = [
  {
    title: "Welcome to Eternum",
    text: "The gods have blessed you with food to begin your journey",
    buttons: [StepButton.next],
  },
  {
    title: "Claim Resources",
    text: "Claim your resources.",
    attachTo: {
      element: ".claim-selector",
    },
    advanceOn: {
      selector: ".claim-selector",
      event: "click",
    },
    modalOverlayOpeningPadding: 10,
    showOn: function () {
      const element = document.querySelector(".claim-selector");
      return Boolean(element);
    },
    buttons: [StepButton.prev],
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
    buttons: [StepButton.prev],
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
      },
      StepButton.finish,
    ],
  },
];
