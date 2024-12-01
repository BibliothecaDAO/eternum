import { StepOptions } from "shepherd.js";
import { StepButton, waitForElement } from "./utils";

export const createTradeSteps: StepOptions[] = [
  {
    title: "Trading in Eternum",
    text: "Trading is the lifeblood of Eternum. Learn how to create trades to grow your economy.",
    buttons: [StepButton.next],
  },
  {
    title: "Trade Menu",
    text: "Open the trade menu to access the marketplace",
    attachTo: {
      element: ".trade-selector",
      on: "right",
    },
    advanceOn: {
      selector: ".trade-selector",
      event: "click",
    },
    buttons: [StepButton.prev],
  },
  {
    title: "Market Overview",
    text: "This is the marketplace where you can trade resources with other players",
    attachTo: {
      element: ".market-modal-selector",
      on: "top",
    },
    beforeShowPromise: function () {
      return waitForElement(".market-modal-selector");
    },
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Resource Overview",
    text: "Here you can see your available resources for trading",
    attachTo: {
      element: ".market-resource-bar-selector",
      on: "right",
    },
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Trading Options",
    text: "You can buy resources, sell resources, or use the automated market maker (AMM)",
    attachTo: {
      element: ".market-resource-bar-header-selector",
      on: "right",
    },
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Create Order",
    text: "Click here to create a new buy or sell order",
    attachTo: {
      element: ".order-create-buy-selector",
      on: "right",
    },
    scrollTo: true,
    buttons: [StepButton.prev, StepButton.next],
  },
  {
    title: "Order Book",
    text: "View all active buy and sell orders in the order book",
    attachTo: {
      element: ".order-book-selector",
      on: "right",
    },
    buttons: [StepButton.prev, StepButton.finish],
  },
];
