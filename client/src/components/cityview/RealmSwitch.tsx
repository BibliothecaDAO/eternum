import clsx from "clsx";
import React, {
  ComponentPropsWithRef,
  useEffect,
  useMemo,
  useState,
} from "react";
import CircleButton from "../../elements/CircleButton";
import { OrderIcon } from "../../elements/OrderIcon";
import { Badge } from "../../elements/Badge";
import { RealmBadge } from "../../elements/RealmBadge";
import { Link, useLocation } from "wouter";
import useRealmStore from "../../hooks/store/useRealmStore";
import { orderNameDict } from "../../constants/orders";
import realmsNames from "../../geodata/realms.json";
import useUIStore from "../../hooks/store/useUIStore";
import { getRealm } from "./realm/SettleRealmComponent";
import { soundSelector, useUiSounds } from "../../hooks/useUISound";

type RealmSwitchProps = {} & ComponentPropsWithRef<"div">;

type Realm = {
  id: number;
  realmId: number;
  name: string;
  order: string;
};

export const RealmSwitch = ({ className }: RealmSwitchProps) => {
  const [showRealms, setShowRealms] = useState(false);
  const [yourRealms, setYourRealms] = useState<Realm[]>([]);

  const {
    realmEntityId,
    realmId,
    setRealmId,
    setRealmEntityId,
    realmEntityIds,
  } = useRealmStore();

  const moveCameraToRealmView = useUIStore(
    (state) => state.moveCameraToRealmView,
  );

  const setIsLoadingScreenEnabled = useUIStore(
    (state) => state.setIsLoadingScreenEnabled,
  );

  const [location, setLocation] = useLocation();

  const realm = useMemo(
    () => (realmId ? getRealm(realmId) : undefined),
    [realmId],
  );

  const realms = useMemo(() => {
    const fetchedYourRealms: Realm[] = [];
    realmEntityIds.forEach(({ realmEntityId, realmId }) => {
      const realm = getRealm(realmId);
      const name = realmsNames.features[realm.realm_id - 1].name;
      fetchedYourRealms.push({
        id: realmEntityId,
        realmId: realm.realm_id,
        name,
        order: orderNameDict[realm.order],
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
      {/* IDK why, but tailwind cant handle dynamic custom classes if they wasnt used before */}
      <div className="hidden bg-order-power bg-order-giants bg-order-titans bg-order-brilliance bg-order-skill bg-order-perfection bg-order-twins bg-order-reflection bg-order-detection bg-order-fox bg-order-vitriol bg-order-enlightenment bg-order-protection bg-order-fury bg-order-rage bg-order-anger fill-order-power fill-order-giants fill-order-titans fill-order-brilliance fill-order-skill fill-order-perfection fill-order-twins fill-order-reflection fill-order-detection fill-order-fox fill-order-vitriol fill-order-enlightenment fill-order-protection fill-order-fury fill-order-rage fill-order-anger stroke-order-power stroke-order-giants stroke-order-titans stroke-order-brilliance stroke-order-skill stroke-order-perfection stroke-order-twins stroke-order-reflection stroke-order-detection stroke-order-fox stroke-order-vitriol stroke-order-enlightenment stroke-order-protection stroke-order-fury stroke-order-rage stroke-order-anger"></div>
      <CircleButton
        className={`bg-order-${orderName} text-white`}
        size="md"
        onClick={() => setShowRealms(!showRealms)}
      >
        <OrderIcon order={orderName.toString()} size="xs" color="white" />
      </CircleButton>
      <div
        className={clsx(
          "flex items-center ml-2 space-x-2 w-auto transition-all duration-300 overflow-hidden rounded-xl",
          showRealms ? "max-w-[500px]" : "max-w-0",
        )}
      >
        {yourRealms.map((realm, index) => (
          // TODO: could not click on realm switch with the link
          <div
            key={realm.id}
            onClick={() => {
              setIsLoadingScreenEnabled(true);
              setTimeout(() => {
                if (location.includes(`/realm`)) {
                  setIsLoadingScreenEnabled(false);
                }
                setLocation(`/realm/${realm.id}`);
                setRealmEntityId(realm.id);
                setRealmId(realm.realmId);
                moveCameraToRealmView();
              }, 500);
            }}
          >
            <RealmBadge
              key={realm.id}
              realm={realm}
              active={realmEntityId === realm.id}
            />
          </div>
        ))}
      </div>
      {!showRealms && (
        <Badge
          size="lg"
          className="absolute top-0 right-0 translate-x-1 -translate-y-2 text-xxs text-brown"
        >
          {yourRealms.length}
        </Badge>
      )}
    </div>
  );
};
