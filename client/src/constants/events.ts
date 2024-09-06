import { NAMESPACE } from "@bibliothecadao/eternum";
import { getSelectorFromTag } from "@dojoengine/torii-client";

export const CREATE_ORDER_SELECTOR = getSelectorFromTag(`${NAMESPACE}-CreateOrder`);
export const ACCEPT_ORDER_SELECTOR = getSelectorFromTag(`${NAMESPACE}-AcceptOrder`);
export const CANCEL_ORDER_SELECTOR = getSelectorFromTag(`${NAMESPACE}-CancelOrder`);
