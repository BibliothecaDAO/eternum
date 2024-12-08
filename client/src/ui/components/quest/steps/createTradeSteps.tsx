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
      useUIStore.getState().closeAllPopups();
      return new Promise<void>((resolve) => resolve());
    },
    buttons: [StepButton.next],
  },
  {
    title: "Trade Menu",
    text: "Open the Lord's Market.",
    attachTo: {
      element: ".trade-selector",
      on: "right",
    },
    advanceOn: {
      selector: ".trade-selector",
      event: "click",
    },
    classes: "ml-5",
    buttons: [],
  },
  {
    title: "Marketplace",
    text: "Entirely player driven, set your own prices!",
    beforeShowPromise: function () {
      return waitForElement(".market-modal-selector");
    },
    buttons: [StepButton.next],
  },
  {
    title: "Realm Selection",
    text: "Switch between your realms to manage their trade offers.",
    attachTo: {
      element: ".market-realm-selector",
      on: "bottom",
    },
    classes: "mt-5",
    canClickTarget: false,
    buttons: [StepButton.next],
  },
  {
    title: "Resource Overview",
    text: "Track resources and compare best prices: Buy Orders, Sell Orders, and AMM prices.",
    attachTo: {
      element: ".market-resource-bar-selector",
      on: "right",
    },
    classes: "ml-5",
    buttons: [StepButton.next],
  },

  {
    title: "AMM",
    text: "Open the AMM section.",
    attachTo: {
      element: ".amm-tab-selector",
      on: "bottom",
    },
    advanceOn: {
      selector: ".amm-tab-selector",
      event: "click",
    },
    scrollTo: true,
    classes: "mt-5",
    buttons: [],
  },
  {
    title: "Automated Market Maker",
    text: "Swap resources and $Lords on the AMM.",
    attachTo: {
      element: ".amm-selector",
      on: "left-start",
    },
    beforeShowPromise: function () {
      return waitForElement(".amm-selector");
    },
    canClickTarget: false,
    classes: "-ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Liquidity",
    text: "Prices are dictated by each Resource/$Lords liquidity pool.",
    attachTo: {
      element: ".amm-liquidity-selector",
      on: "left-start",
    },
    scrollTo: true,
    canClickTarget: false,
    classes: "-ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Swap",
    text: "Try setting a few $Lords here.",
    attachTo: {
      element: ".resource-bar-selector",
      on: "left-start",
    },
    scrollTo: true,
    classes: "-ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Fees",
    text: "Click here for a trade overview before confirmation.",
    attachTo: {
      element: ".swap-button-selector",
      on: "left-start",
    },
    advanceOn: {
      selector: ".swap-button-selector",
      event: "click",
    },
    classes: "-ml-5",
    buttons: [],
  },
  {
    title: "Swap Overview",
    text: "Fees are taken on each AMM trade.",
    attachTo: {
      element: ".amm-swap-fee-selector",
      on: "left",
    },
    beforeShowPromise: function () {
      return waitForElement(".amm-swap-fee-selector");
    },
    canClickTarget: false,
    classes: "-ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Swap Overview",
    text: "Donkeys are also needed for transportation.",
    attachTo: {
      element: ".amm-swap-donkey-selector",
      on: "left-start",
    },
    canClickTarget: false,
    classes: "-ml-5",
    buttons: [StepButton.next],
  },
  {
    title: "Close",
    text: "Let's close this for now.",
    attachTo: {
      element: ".amm-swap-confirm-close-selector",
      on: "left-start",
    },
    advanceOn: {
      selector: ".amm-swap-confirm-close-selector",
      event: "click",
    },
    classes: "-ml-5",
    buttons: [],
  },

  {
    title: "Central Bank",
    text: "All AMM trades go through the Central Bank.",
    attachTo: {
      element: ".trade-bank-selector",
      on: "bottom",
    },
    scrollTo: true,
    classes: "mt-5",
    buttons: [StepButton.next],
  },
  {
    title: "Combat",
    text: "While the Central Bank is in Battle, the AMM is disabled.",
    attachTo: {
      element: ".bank-combat-selector",
      on: "bottom",
    },
    classes: "mt-5",
    buttons: [StepButton.next],
  },

  {
    title: "Order Book",
    text: "Click here.",
    attachTo: {
      element: ".orderbook-tab-selector",
      on: "bottom",
    },
    classes: "mt-5",
    advanceOn: {
      selector: ".orderbook-tab-selector",
      event: "click",
    },
    scrollTo: true,
    buttons: [],
  },
  {
    title: "Market Orders",
    text: "View all active player buy and sell orders here.",
    attachTo: {
      element: ".order-book-selector",
      on: "left-start",
    },
    classes: "-ml-5",
    beforeShowPromise: function () {
      return waitForElement(".order-book-selector");
    },
    canClickTarget: false,
    buttons: [StepButton.next],
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
    buttons: [StepButton.next],
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
    buttons: [StepButton.next],
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
    buttons: [StepButton.next],
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
    buttons: [StepButton.finish],
  },
];
