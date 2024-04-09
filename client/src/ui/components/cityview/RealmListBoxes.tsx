import clsx from "clsx";
import { ComponentPropsWithRef, useEffect, useMemo, useState } from "react";
import realmHexPositions from "@/data/geodata/hex/realmHexPositions.json";
import { RealmBadge } from "../../elements/RealmBadge";
import { useLocation } from "wouter";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { orderNameDict } from "@bibliothecadao/eternum";
import realmsNames from "../../../data/geodata/realms.json";
import useUIStore from "../../../hooks/store/useUIStore";
import { getRealm } from "../../utils/realms";
import { useDojo } from "../../../hooks/context/DojoContext";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useEntityQuery } from "@dojoengine/react";
import { soundSelector, useUiSounds } from "../../../hooks/useUISound";
import { HexPositions } from "@/ui/utils/utils";

type RealmSwitchProps = {} & ComponentPropsWithRef<"div">;

// TODO: Remove
export type RealmBubble = {
  id: bigint;
  realmId: bigint;
  name: string;
  order: string;
  position: { x: number; y: number };
};

export const RealmListBoxes = ({ className }: RealmSwitchProps) => {
  const {
    account: { account },
    setup: {
      components: { Realm, Owner },
    },
  } = useDojo();

  const realmPositions = realmHexPositions as HexPositions;
  const [showRealms, setShowRealms] = useState(false);
  const [yourRealms, setYourRealms] = useState<RealmBubble[]>([]);

  const { realmEntityId, realmId, setRealmId, setRealmEntityId, realmEntityIds, setRealmEntityIds } = useRealmStore();

  const entityIds = useEntityQuery([Has(Realm), HasValue(Owner, { address: BigInt(account.address) })]);

  // set realm entity ids everytime the entity ids change
  useEffect(() => {
    let realmEntityIds = Array.from(entityIds)
      .map((id) => {
        const realm = getComponentValue(Realm, id);
        if (realm) {
          // const owner = getComponentValue(Owner, id);
          // console.log({ owner });
          return { realmEntityId: realm.entity_id, realmId: realm.realm_id };
        }
      })
      .filter(Boolean)
      .sort((a, b) => Number(a!.realmId) - Number(b!.realmId)) as { realmEntityId: bigint; realmId: bigint }[];

    setRealmEntityIds(realmEntityIds);
  }, [entityIds]);

  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const [location, setLocation] = useLocation();

  const realm = useMemo(() => (realmId ? getRealm(realmId) : undefined), [realmId]);

  const { play: playFly } = useUiSounds(soundSelector.fly);

  useEffect(() => {
    if (location.includes("/map")) {
      setShowRealms(false);
    }
  }, [location]);

  const realms = useMemo(() => {
    const fetchedYourRealms: RealmBubble[] = [];
    realmEntityIds.forEach(({ realmEntityId, realmId }) => {
      const realm = getRealm(realmId);
      if (!realm) return;
      const name = realmsNames.features[Number(realm.realmId) - 1].name;
      fetchedYourRealms.push({
        id: realmEntityId,
        realmId: realm.realmId,
        name,
        order: orderNameDict[realm.order],
        position: realm.position,
      });
    });
    return fetchedYourRealms;
  }, [realmEntityIds, realm]);

  useEffect(() => {
    setYourRealms(realms);
  }, [realms]);

  const orderName = useMemo(() => {
    let realmOrder = realm?.order || 1;
    return orderNameDict[realmOrder];
  }, [realmEntityId, realm]);

  return (
    <div className={clsx("flex", className)}>
      <div className={clsx("flex items-center ml-2 space-x-2 w-auto transition-all duration-300 overflow-hidden ")}>
        {yourRealms.map((realm) => (
          <div
            key={realm.id}
            onClick={() => {
              setIsLoadingScreenEnabled(true);
              setTimeout(() => {
                if (location.includes(`/hex`)) {
                  setIsLoadingScreenEnabled(false);
                }
                setLocation(`/hex?col=${realm.position.x}&row=${realm.position.y}`);
                setRealmEntityId(realm.id);
                setRealmId(realm.realmId);
              }, 300);
            }}
          >
            <RealmBadge key={realm.id} realm={realm} active={realmEntityId === realm.id} />
          </div>
        ))}
      </div>
      {/* {!showRealms && (
        <Badge size="lg" bordered className="absolute top-0 right-0 translate-x-1 -translate-y-2 text-xxs text-brown">
          {yourRealms.length}
        </Badge>
      )} */}
    </div>
  );
};
