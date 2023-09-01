import { useMemo, useState } from "react";
import { useDojo } from "../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { getEntityIdFromKeys } from "../../utils/utils";

enum EventType {
  MakeOffer,
  AcceptOffer,
  CancelOffer,
  ReceiveResources,
  CreateRealm,
  Trade,
}

export type NotificationType = {
  eventType: EventType;
  keys: string[];
};

export const useNotifications = () => {
  const {
    setup: {
      entityUpdates,
      components: { Status },
    },
  } = useDojo();

  // const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);

  useMemo(() => {
    const subscription = entityUpdates.subscribe((updates) => {
      const notifications = updates
        .map((update) => {
          if (update.componentNames.includes("Trade")) {
            const status = getComponentValue(
              Status,
              getEntityIdFromKeys(
                update.entityKeys!.map((str) => BigInt(str!)),
              ),
            );
            if (status?.value === 0) {
              return {
                eventType: EventType.MakeOffer,
                keys: update.entityKeys,
              };
            } else if (status?.value === 1) {
              return {
                eventType: EventType.AcceptOffer,
                keys: update.entityKeys,
              };
            } else if (status?.value === 2) {
              return {
                eventType: EventType.CancelOffer,
                keys: update.entityKeys,
              };
            }
          }
        })
        .filter(Boolean) as NotificationType[];

      // Remove consecutive duplicates
      const deduplicatedNotifications = notifications.reduce(
        (acc, curr, idx, array) => {
          if (
            idx === 0 ||
            JSON.stringify(curr) !== JSON.stringify(array[idx - 1])
          ) {
            acc.push(curr);
          }
          return acc;
        },
        [] as NotificationType[],
      );

      setNotifications(deduplicatedNotifications);
      // setNotifications(notifications);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Cannot use defineQuery atm because it we don't setComponentValue in the true order of the events. If you click
   * on the Market tab, then we load all the trades, which will trigger these notifications, even if the trades were
   * done a long time ago.
   */
  // const { update$: realmUpdate$ } = useMemo(
  //   () => defineQuery([Has(Realm)]),
  //   [],
  // );

  // useMemo(() => {
  //   realmUpdate$
  //     .pipe(
  //       distinctUntilChanged((a, b) => isEqual(a, b)),
  //       filter((update) => !isEqual(update.value[0], update.value[1])),
  //     )
  //     .subscribe((update) => {
  //       console.log("RealmMUDentityUpdates", update);
  //     });
  // }, []);

  // const { update$: resourceUpdate$ } = useMemo(
  //   () => defineQuery([Has(Resource)]),
  //   [],
  // );

  // useMemo(() => {
  //   resourceUpdate$
  //     .pipe(
  //       distinctUntilChanged((a, b) => isEqual(a, b)),
  //       filter((update) => {
  //         return !isEqual(update.value[0], update.value[1]);
  //       }),
  //     )
  //     .subscribe((update) => {
  //       console.log("ResourceMUDentityUpdates", update);
  //     });
  // }, []);

  // const { update$: tradeUpdate$ } = useMemo(
  //   () =>
  //     defineQuery([
  //       Has(Trade),
  //       HasValue(Trade, {
  //         taker_id: 0,
  //         claimed_by_maker: 0,
  //         claimed_by_taker: 0,
  //       }),
  //     ]),
  //   [],
  // );

  // useMemo(() => {
  //   tradeUpdate$
  //     .pipe(
  //       distinctUntilChanged((a, b) => isEqual(a, b)),
  //       filter((update) => {
  //         return !isEqual(update.value[0], update.value[1]);
  //       }),
  //     )
  //     .subscribe((update) => {
  //       console.log("TradeMUDentityUpdates", update);
  //       setNotifications((notifications) => [
  //         { eventType: EventType.Trade, update },
  //         ...notifications,
  //       ]);
  //     });
  // }, []);

  return {
    notifications,
  };
};
