import { NAMESPACE } from "@bibliothecadao/eternum";
import { getSelectorFromTag } from "@dojoengine/torii-client";

export const CREATE_ORDER_SELECTOR = getSelectorFromTag(`${NAMESPACE}-CreateOrder`);
export const ACCEPT_ORDER_SELECTOR = getSelectorFromTag(`${NAMESPACE}-AcceptOrder`);
export const CANCEL_ORDER_SELECTOR = getSelectorFromTag(`${NAMESPACE}-CancelOrder`);
export const PILLAGE_SELECTOR = getSelectorFromTag(`${NAMESPACE}-PillageEvent`);
export const HYPERSTRUCTURE_FINISHED_SELECTOR = getSelectorFromTag(`${NAMESPACE}-HyperstructureFinished`);
export const HYPERSTRUCTURE_CO_OWNER_CHANGE_SELECTOR = getSelectorFromTag(`${NAMESPACE}-HyperstructureCoOwnersChange`);
