import useUIStore from "@/hooks/store/useUIStore";
import { StepOptions } from "shepherd.js";
import { waitForElement } from "./utils";

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
    buttons: [
      {
        text: "Next",
        action: function () {
          return this.next();
        },
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
      },
    ],
  },
  {
    title: "Build It",
    text: "Place your Market on any available hex. Use right-click to cancel",
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
      },
      {
        text: "Finish",
        action: function () {
          return this.complete();
        },
      },
    ],
  },
];
