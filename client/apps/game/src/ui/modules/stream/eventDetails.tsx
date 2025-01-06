import { ReactComponent as Check } from "@/assets/icons/Check.svg";
import { ReactComponent as Chest } from "@/assets/icons/Chest.svg";
import { ReactComponent as Coins } from "@/assets/icons/Coins.svg";
import { ReactComponent as Combat } from "@/assets/icons/Combat.svg";
import { ReactComponent as Compass } from "@/assets/icons/Compass.svg";
import { ReactComponent as Crown } from "@/assets/icons/Crown.svg";
import { ReactComponent as Burn } from "@/assets/icons/fire.svg";
import { ReactComponent as Scroll } from "@/assets/icons/Scroll.svg";
import { ReactComponent as Sparkles } from "@/assets/icons/Sparkles.svg";
import { ReactComponent as Swap } from "@/assets/icons/Swap.svg";
import { ReactComponent as Wrench } from "@/assets/icons/Wrench.svg";
import { ClientComponents } from "@/dojo/createClientComponents";
import { currencyFormat } from "@/ui/utils/utils";
import { ContractAddress, findResourceById, ID } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { hexToAscii } from "@dojoengine/utils";
import { EventType } from "./types";

export const eventDetails: {
  [key in EventType]: {
    to?: (
      compononentValue: ComponentValue<ClientComponents["events"][key]["schema"]>,
      getAddressFromEntity: (id: ID) => ContractAddress | undefined,
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
  [EventType.MapExplored]: {
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.MapExplored]["schema"]>) => `explored a tile`,
    emoji: <Compass className="w-6 self-center fill-current" />,
    color: "#ED9733",
  },
  [EventType.BattleStart]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.BattleStart]["schema"]>,
      _getAddressFromEntity,
    ) => componentValue.defender,
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.BattleStart]["schema"]>, isPersonal) =>
      `started a battle${isPersonal ? " with you" : ""}`,
    emoji: <Combat className="w-6 self-center fill-current" />,
    color: "#EF9A9A",
  },
  [EventType.BattleJoin]: {
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.BattleJoin]["schema"]>) => `joined a battle`,
    emoji: <Combat className="w-6 self-center fill-current" />,
    color: "#EF9A9A",
  },
  [EventType.BattleLeave]: {
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.BattleLeave]["schema"]>) => "left a battle",
    emoji: <Scroll className="w-6 self-center fill-current" />,
    color: "#90CAF9",
  },
  [EventType.BattleClaim]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.BattleClaim]["schema"]>,
      getAddressFromEntity,
    ) => getAddressFromEntity(componentValue.structure_entity_id),
    getAction: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.BattleClaim]["schema"]>,
      isPersonal,
    ) => `claimed${isPersonal ? " your" : " a"} ${componentValue.structure_type}`,
    emoji: <Chest className="w-6 self-center fill-current" />,
    color: "#FFCC80",
  },
  [EventType.BattlePillage]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.BattlePillage]["schema"]>,
      _getAddressFromEntity,
    ) => componentValue.pillaged_structure_owner,
    getAction: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.BattlePillage]["schema"]>,
      isPersonal,
    ) => `pillaged${isPersonal ? " your" : " a"} ${componentValue.structure_type}`,
    emoji: <Coins className="w-6 self-center fill-current" />,
    color: "#CE93D8",
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
  [EventType.HyperstructureFinished]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.HyperstructureFinished]["schema"]>,
      getAddressFromEntity,
    ) => getAddressFromEntity(componentValue.hyperstructure_entity_id),
    getAction: (
      _: ComponentValue<ClientComponents["events"][EventType.HyperstructureFinished]["schema"]>,
      isPersonal,
    ) => `finished${isPersonal ? " your" : " a"} hyperstructure`,
    emoji: <Sparkles className="w-6 self-center fill-current" />,
    color: "#FFF59D",
  },
  [EventType.HyperstructureContribution]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.HyperstructureContribution]["schema"]>,
      getAddressFromEntity,
    ) => getAddressFromEntity(componentValue.hyperstructure_entity_id),
    getAction: (
      _: ComponentValue<ClientComponents["events"][EventType.HyperstructureContribution]["schema"]>,
      isPersonal,
    ) => `contributed to${isPersonal ? " your" : " a"} hyperstructure`,
    emoji: <Wrench className="w-6 self-center fill-current" />,
    color: "#FFD54F",
  },
  [EventType.AcceptOrder]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.AcceptOrder]["schema"]>,
      getAddressFromEntity,
    ) => getAddressFromEntity(componentValue.maker_id),
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.AcceptOrder]["schema"]>, isPersonal) =>
      `accepted${isPersonal ? " your" : " a"} p2p order`,
    emoji: <Check className="w-6 self-center fill-current" />,
    color: "#C5E1A5",
  },
};
