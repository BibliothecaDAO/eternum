import { useMemo, useState } from "react";
import Button from "../../../elements/Button";

import { useDojo } from "../../../DojoContext";
import { getOrderName, orders } from "@bibliothecadao/eternum";
import { soundSelector, useUiSounds } from "../../../hooks/useUISound";
import { getRealm } from "../../../utils/realms";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { OrderIcon } from "../../../elements/OrderIcon";
import { useRealm } from "../../../hooks/helpers/useRealm";
import clsx from "clsx";
import { getPosition, multiplyByPrecision } from "../../../utils/utils";
import { initialResources } from "@bibliothecadao/eternum";
import { BigNumberish } from "starknet";

export const MAX_REALMS = 5;

export const SettleRealmComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(1);

  const {
    setup: {
      systemCalls: { create_realm },
    },
    account: { account, masterAccount },
  } = useDojo();

  const { getNextRealmIdForOrder } = useRealm();

  const { play: playSign } = useUiSounds(soundSelector.sign);

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const chosenOrder = useMemo(
    () => (realmEntityIds.length > 0 ? getRealm(realmEntityIds[0].realmId).order : undefined),
    [account, realmEntityIds],
  );
  const canSettle = realmEntityIds.length < MAX_REALMS;

  const settleRealm = async () => {
    setIsLoading(true);
    // if no realm id latest realm id is 0
    // const realm_id = await getLatestRealmId();

    // take next realm id
    let new_realm_id = getNextRealmIdForOrder(chosenOrder || selectedOrder);
    let realm = getRealm(new_realm_id);
    let position = getPosition(new_realm_id);

    // create array of initial resources
    let resources: BigNumberish[] = [];
    const isDev = import.meta.env.VITE_DEV === "true";
    const dev_multiplier = isDev ? 10 : 1;
    for (let i = 0; i < 22; i++) {
      resources = [...resources, i + 1, multiplyByPrecision(initialResources[i]) * dev_multiplier];
    }
    if (isDev) {
      resources = [...resources, 254, multiplyByPrecision(1000000)];
      resources = [...resources, 255, multiplyByPrecision(1000000)];
    } else {
      resources = [...resources, 254, multiplyByPrecision(7560)];
      resources = [...resources, 255, multiplyByPrecision(2520)];
    }

    await create_realm({
      signer: masterAccount,
      owner: BigInt(account.address),
      ...realm,
      position,
      resources,
    });
    setIsLoading(false);
    playSign();
  };

  const mintMultipleRealms = async (times) => {
    for (let i = 0; i < times; i++) {
      await settleRealm();
    }
  };

  const order_statments = [
    "The Order of Power are one of the oldest orders and fixtures of the history of the realms. They compete by working harder and smarter than everyone else, are natural leaders, and have endless self-confidence. Their confidence can also be their greatest weakness.",
    "The Order of Anger loves the intensity of high strung situations, their emotions welling deep inside to provide fuel for the challenge. They are always seeking conflict and particularly so with the Order of Protection, who despises their constant troublemaking. Their need for confrontation can often be their downfall, as there is always a bigger fish.",
    "The Order of Brilliance believes that true perfection lies in the school of thought. They are renowned for their academies, in which they provide basic education in order to find the most promising minds. In the lifelong pursuit of knowledge they catalog and store the history of the realms and conduct extensive research into mana usage.",
    "The Order of Detection are attuned to empathy. Some use it for good, some use it for manipulation. They can communicate wordlessly. Their leadership hierarchy is through persuasion not physical power, and are masters of propoganda. Their rumors can be enough to change the tides of fate though, as an army location is misreported or a merchant caravan route leaked.",
    "The Order of Enlightenment seeks harmony and peace above all else, instead using their intelligence to help guide the world and those around them. The path to enlightenment is unique to every individual, and this Order wishes to turn swords into plows wherever they go. As skilled diplomats many seek them out for negotiations, their wisdom and countenance more valuble than gold. Although strangers to violence in general, their individual defensive measures can be extreme.",

    "The order of the Fox thrives off of mischief and competition. They can hide, then are sly, they compete with cunning and trickery, not raw strength. The children of the Fox play tricks on other orders, and with age those trucks become increasingly severe.",
    "The Order of Fury values extreme and overwhelming force in all situations. They have a need to dominate, and if they cannot dominate, to destroy it with utter frenzied rage. The Order of Fury has little care for life itself, only the ability to end a life. Their disciples are pitted against each other over years until only the most vicious remain. The nature of the Order ensures competency, but destroys its own power structures constantly due to infighting and assasinations.",
    "The Order of Giants values physical might, not just to crush their foes, but as the backbone of the great constructions in the Realms, their strength making them invaluable to Builders. Their size also makes them vulnerable to faster and smaller opponents and their leaders often win their position through combat prowess, which has led to a culture of poor strategic decisions in preference of displaying their full strength.",

    "The Order of Perfection loves to both appreciate and create beautiful things. They disregard confrontation in favor of creation, appreciation, and protection of art and and refinement of culture. Although often dismissed as just artists and bards, those with intelligence know that the most dangerous creations originate from the Order of Perfection, and hope to never see those creations come to light.",
    "The order of Reflection thrives off of time spent with their own thoughts, believing that interaction with an everchanging Realm dulls their ability to see the ethereal. They’re most often found searching for insights into the past and the future by isolating themselves in the darkness. There are rumors of disturbing rituals to aid in conjuring the visions they seek, and their trade in the less savoury markets banned in some Realms does nothing to dispel these rumors.",
    "The Order of Skill thrives off of constant self-improvement and self-reliance but still prefer to be part of a team. They are energetic and can accomplish any task they set their mind to. They play by the rules and compete based on their own merit. Their need to demonstrate their proficiency can perversely lead to the very opposite, when they show their hand too early in battle or political games.",

    "The Order of Titans are said to have come from the Giants and share many similarities. The people say that the Giants are like earth, and the Titans the metal they find within it. They are strongly attuned to a sense of justice in the world, however their justice can vary greatly. For Titans, going against the Lord or Lady of a realm is an unforgivable sin, they play by the rules to a fault and can be caught up in their own rules by a skilled or less honourable enemy.",
    "The Twins are another one of the oldest orders. Amongst themselves, they tend to morph to the styles and sensibilities of the most dominant member of their order. They move in-sync with one-another and live communally. Amongst other orders, they have an uncanny ability to mimic the mannerisms and patterns of those they choose. They can change personalities as one would change outfits.",
    "The order of Vitriol loves debate and offers their opinions with complete disregard to the feelings of others. From an early age they face ruthless criticism from their teachers, parents, and leaders. They hold both themselves and others to impossible standards.",

    "The Order of Rage was said to be birthed from the Order of Anger, as not all could display their anger without losing their life. Instead, the Order of Rage values an implacable front to hide a deep well of anger. When they reach positions of power, they tend to enact schemes of revenge on those who hurt them, and in doing so often dig a grave for two.",

    "The Order of Protection values stability between the Realms, they wish to build economies to help feed and clothe the destitute. They will often create neutral zones such as Inns whereby adventurers can rest at ease. Their desire to do good can often be their downfall, as not all pay kindness for kindness, especially those of the Dark.",
  ];

  return (
    <>
      <div className="flex flex-col h-min">
        <div className="grid grid-cols-8 gap-2 pt-4">
          {orders.map(({ orderId }) => (
            <div
              key={orderId}
              className={clsx(
                " flex relative group items-center justify-center  w-16 h-16 bg-black rounded-xl border",
                selectedOrder == orderId && !chosenOrder ? "border-gold !cursor-pointer" : "border-transparent",
                chosenOrder && chosenOrder == orderId && "!border-gold",
                chosenOrder && chosenOrder !== orderId && "opacity-30 cursor-not-allowed",
                !chosenOrder && "hover:bg-white/10 cursor-pointer",
              )}
              onClick={() => (!chosenOrder ? setSelectedOrder(orderId) : null)}
            >
              <OrderIcon
                size={"md"}
                withTooltip={!chosenOrder || chosenOrder == orderId}
                order={getOrderName(orderId)}
              ></OrderIcon>
            </div>
          ))}
        </div>
        <div>
          <div className="text-lg mt-2 italic text-gold">{order_statments[selectedOrder - 1]}</div>
        </div>
        <Button
          disabled={!canSettle}
          isLoading={isLoading}
          onClick={() => (!isLoading ? mintMultipleRealms(5) : null)}
          className="mx-auto mt-4 text-xl"
          variant={!isLoading ? "success" : "danger"}
        >
          {!isLoading ? "Settle Empire" : ""}
        </Button>
      </div>
    </>
  );
};

export default SettleRealmComponent;
