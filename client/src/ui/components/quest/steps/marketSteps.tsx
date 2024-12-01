import { configManager } from "@/dojo/setup";
import useUIStore from "@/hooks/store/useUIStore";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { CapacityConfigCategory, ResourcesIds } from "@bibliothecadao/eternum";
import { StepOptions } from "shepherd.js";
import { STYLES, waitForElement } from "./utils";
import { ResourceWeight } from "../../resources/TravelInfo";

export const marketSteps: StepOptions[] = [
  {
    title: "Markets and Trade",
    text:
      // (
      //   <div>
      //     <div className="mt-2">
      "    Build a market to produce donkeys. Donkeys are a resource used to transport goods.",
    /* </div>
        <div className="flex flex-row mt-2">
          <ResourceIcon size="sm" resource={ResourcesIds[ResourcesIds.Donkey]} />
          <div> Donkeys can transport </div>
          {configManager.getCapacityConfig(CapacityConfigCategory.Donkey) / 1000} kg{" "}
        </div>
        <ResourceWeight className="mt-2" />
      </div>
    ), */
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
    title: "Construction Menu",
    text: "Open the construction menu to build a Market",
    attachTo: {
      element: ".construction-selector",
      on: "bottom",
    },
    advanceOn: {
      selector: ".construction-selector",
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
    title: "Select Market",
    text: "Select the Market building to start producing donkeys for transportation",
    attachTo: {
      element: ".market-card-selector",
      on: "bottom",
    },
    beforeShowPromise: function () {
      const closeAllPopups = useUIStore.getState().closeAllPopups;
      closeAllPopups();
      return waitForElement(".market-card-selector");
    },
    advanceOn: {
      selector: ".market-card-selector",
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
    title: "Build It",
    text: "Place your Market on any available hex. Use right-click to cancel",
    classes: STYLES.defaultStepPlacement,
    beforeShowPromise: function () {
      const overlay = document.querySelector(".shepherd-modal-overlay-container");
      if (overlay) {
        (overlay as HTMLElement).style.display = "none";
      }
      return new Promise<void>((resolve) => resolve());
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
