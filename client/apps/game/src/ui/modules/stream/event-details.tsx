import { ReactComponent as Check } from "@/assets/icons/check.svg";
import { ReactComponent as Crown } from "@/assets/icons/crown.svg";
import { ReactComponent as Burn } from "@/assets/icons/fire.svg";
import { ReactComponent as Swap } from "@/assets/icons/swap.svg";
import { currencyFormat } from "@/ui/utils/utils";
import { ClientComponents, ContractAddress, ID, findResourceById } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { hexToAscii } from "@dojoengine/utils";
import { EventType } from "./types";

export const eventDetails: {
  [key in EventType]: {
    to?: (
      compononentValue: ComponentValue<ClientComponents["events"][key]["schema"]>,
      getAddressFromStructureEntity: (id: ID) => ContractAddress | undefined,
    ) => ContractAddress | undefined;
    getAction: (
      componentValue: ComponentValue<ClientComponents["events"][key]["schema"]>,
      isPersonal?: boolean,
    ) => string;
    emoji: JSX.Element;
    color: string;
  };
} = {
  [EventType.SettleRealm]: {
    getAction: (componentValue: ComponentValue<ClientComponents["events"][EventType.SettleRealm]["schema"]>) =>
      `settled Realm ${hexToAscii("0x" + componentValue.realm_name.toString(16))}`,
    emoji: <Crown className="w-6 self-center fill-current" />,
    color: "#FFAB91",
  },
  [EventType.BurnDonkey]: {
    getAction: (componentValue: ComponentValue<ClientComponents["events"][EventType.BurnDonkey]["schema"]>) =>
      `burnt ${currencyFormat(Number(componentValue.amount), 0)} donkeys`,
    emoji: <Burn className="w-6 self-center fill-current" />,
    color: "#A5D6A7",
  },
  [EventType.Swap]: {
    getAction: (componentValue: ComponentValue<ClientComponents["events"][EventType.Swap]["schema"]>) => {
      const buyAmount = componentValue.buy ? componentValue.lords_amount : componentValue.resource_amount;
      const buyResource = componentValue.buy ? "lords" : findResourceById(componentValue.resource_type)?.trait;

      const sellAmount = componentValue.buy ? componentValue.resource_amount : componentValue.lords_amount;
      const sellResource = componentValue.buy ? findResourceById(componentValue.resource_type)?.trait : "lords";
      return `swapped  ${currencyFormat(Number(sellAmount), 0)} ${sellResource} for ${currencyFormat(
        Number(buyAmount),
        0,
      )} ${buyResource}`;
    },
    emoji: <Swap className="w-6 self-center fill-current" />,
    color: "#80DEEA",
  },
  [EventType.AcceptOrder]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.AcceptOrder]["schema"]>,
      getAddressFromStructureEntity,
    ) => getAddressFromStructureEntity(componentValue.maker_id),
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.AcceptOrder]["schema"]>, isPersonal) =>
      `accepted${isPersonal ? " your" : " a"} p2p order`,
    emoji: <Check className="w-6 self-center fill-current" />,
    color: "#C5E1A5",
  },
};
