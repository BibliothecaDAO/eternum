import useUIStore from "@/hooks/store/useUIStore";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const createTradeSteps: StepOptions[] = [
  {
    title: "The Lords Market",
    text: "Welcome to trading - the heart of Eternum's economy!",
    beforeShowPromise: function () {
      useUIStore.getState().setRightNavigationView(RightView.None);
      useUIStore.getState().setLeftNavigationView(LeftView.None);
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Trade Menu",
    text: "Click here to open trading.",
    attachTo: {
      element: ".trade-selector",
      on: "right",
    },
    classes: "ml-5",
    advanceOn: {
      selector: ".trade-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Marketplace",
    text: "Buy, sell, and swap resources with players or the AMM.",
    classes: "!top-1/4",
    beforeShowPromise: function () {
      return waitForElement(".market-modal-selector");
    },
    buttons: [
      {
        text: "Prev",
        action: function () {
          useUIStore.getState().toggleModal(null);
          return this.back();
        },
      },
      StepButton.next,
    ],
  },
  {
    title: "Realm Selection",
    text: "Switch between your realms to manage their trades.",
    attachTo: {
      element: ".market-realm-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Resource Overview",
    text: "Track resources and compare best prices: Buy Orders, Sell Orders, and AMM.",
    attachTo: {
      element: ".market-resource-bar-selector",
      on: "right",
    },
    classes: "ml-5",
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Market Orders",
    text: "View all active player buy and sell orders here.",
    attachTo: {
      element: ".order-book-selector",
      on: "left",
    },
    classes: "-ml-5",
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },

  {
    title: "Buy",
    text: "Spend Lords to get resources.",
    attachTo: {
      element: ".order-create-buy-selector",
      on: "top",
    },
    classes: "-mt-5",
    scrollTo: true,
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Sell",
    text: "Or sell your resources to gain Lords.",
    attachTo: {
      element: ".order-create-sell-selector",
      on: "top",
    },
    classes: "-mt-5",
    scrollTo: true,
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Transportation Cost",
    text: "All resource movements cost Donkeys based on total weight. No donkeys = No trading !",
    attachTo: {
      element: ".donkeys-used-selector",
      on: "top",
    },
    classes: "-mt-5",
    scrollTo: true,
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Place Your First Order",
    text: "Select a resource, check the AMM price, then create your order!",
    attachTo: {
      element: ".order-book-selector",
      on: "top",
    },
    classes: "-mt-5",
    extraHighlights: [".market-resource-bar-selector"],
    scrollTo: true,
    buttons: [
      StepButton.prev,
      {
        text: "Skip for now",
        action: function () {
          return this.next();
        },
      },
    ],
  },
  {
    title: "AMM",
    text: "Switch to the AMM tab.",
    attachTo: {
      element: ".amm-tab-selector",
      on: "bottom",
    },
    classes: "mt-5",
    advanceOn: {
      selector: ".amm-tab-selector",
      event: "click",
    },
    scrollTo: true,
    buttons: [StepButton.prev],
  },
  {
    title: "Automated Market Maker",
    text: "Trade instantly with a small fee. Earn rewards by providing liquidity!",
    attachTo: {
      element: ".amm-selector",
      on: "left-start",
    },
    classes: "-ml-5",
    beforeShowPromise: function () {
      return waitForElement(".amm-selector");
    },
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Transfer",
    text: "Switch to the Transfer tab.",
    attachTo: {
      element: ".transfer-tab-selector",
      on: "bottom",
    },
    classes: "mt-5",
    advanceOn: {
      selector: ".transfer-tab-selector",
      event: "click",
    },
    scrollTo: true,
    buttons: [StepButton.prev],
  },
  {
    title: "Transfer Overview",
    text: "Send resources directly to other structures.",
    attachTo: {
      element: ".transfer-selector",
      on: "left-start",
    },
    classes: "-ml-5",
    beforeShowPromise: function () {
      return waitForElement(".transfer-selector");
    },

    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Realm production",
    text: "Switch to the Realm Production tab.",
    attachTo: {
      element: ".realm-production-tab-selector",
      on: "bottom",
    },
    classes: "mt-5",
    advanceOn: {
      selector: ".realm-production-tab-selector",
      event: "click",
    },
    scrollTo: true,
    buttons: [StepButton.prev],
  },
  {
    title: "Resource Production Overview",
    text: "See what each realm produces and consumes to find trading partners.",
    attachTo: {
      element: ".realm-production-selector",
      on: "left-start",
    },
    classes: "-ml-5",
    beforeShowPromise: function () {
      return waitForElement(".transfer-selector");
    },
    canClickTarget: false,
    buttons: [StepButton.prev, StepButton.finish],
  },
];
