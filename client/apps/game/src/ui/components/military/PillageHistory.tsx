import { ClientComponents } from "@/dojo/createClientComponents";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import TwitterShareButton from "@/ui/elements/TwitterShareButton";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { divideByPrecision, formatNumber, formatResources, formatTime } from "@/ui/utils/utils";
import { BattleSide, ID, Resource, resources } from "@bibliothecadao/eternum";
import { ComponentValue, defineQuery, getComponentValue, HasValue, isComponentUpdate } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { env } from "../../../../env";
import { TroopDisplay } from "./TroopChip";

type PillageEvent = ComponentValue<ClientComponents["events"]["BattlePillageData"]["schema"]>;

const PillageHistoryItem = ({ addressName, history }: { addressName: string; history: PillageEvent }) => {
  const {
    setup: {
      account: { account },
    },
  } = useDojo();

  const isSuccess = history.winner === BattleSide[BattleSide.Attack];
  const formattedResources = useMemo(() => formatResources(history.pillaged_resources), [history.pillaged_resources]);

  const { getPlayerAddressFromEntity, getAddressNameFromEntity } = useEntitiesUtils();

  const attackerIsPlayer = useMemo(
    () => getPlayerAddressFromEntity(history.pillager_army_entity_id) === BigInt(account.address),
    [getPlayerAddressFromEntity, history.pillager_army_entity_id, account.address],
  );

  const twitterText = useMemo(() => {
    if (isSuccess && formattedResources.length > 0 && attackerIsPlayer) {
      return formatSocialText(twitterTemplates.pillage, {
        enemyName: getAddressNameFromEntity(history.pillaged_structure_entity_id) || "Unknown",
        addressName,
        resources: formattedResources
          .map(
            (pillagedResource) =>
              `${formatNumber(divideByPrecision(pillagedResource.amount), 0)} ${resources.find(
                (resource) => resource.id === pillagedResource.resourceId,
              )?.trait}`,
          )
          .join(", "),
        url: env.VITE_SOCIAL_LINK,
      });
    }
  }, [isSuccess, addressName]);
  return (
    <div className="group relative bg-gold/20 hover:bg-gold/10 rounded-lg p-4 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`text-base font-semibold uppercase tracking-wider ${isSuccess ? "text-green" : "text-red"}`}>
          {isSuccess ? "Successful Raid" : "Failed Raid"}
        </div>
        {twitterText && <TwitterShareButton text={twitterText} buttonSize={"xs"} />}
        <div className={`text-gold/80 font-medium ${attackerIsPlayer ? "font-bold" : ""}`}>
          {attackerIsPlayer ? "You" : `by: ${addressName}`}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-4">
        {/* Stolen Resources */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-semibold mb-2 text-gold/90">Stolen Resources</div>
          <div className="flex flex-wrap gap-2 justify-center min-h-[60px] items-center">
            {formattedResources.length > 0 ? (
              formattedResources.map((resource: Resource) => (
                <ResourceCost
                  size="sm"
                  textSize="xs"
                  key={resource.resourceId}
                  resourceId={resource.resourceId}
                  amount={divideByPrecision(resource.amount)}
                />
              ))
            ) : (
              <span className="text-gold/60 text-sm">None</span>
            )}
          </div>
        </div>

        {/* Pillager Troops Lost */}
        <div className="flex flex-col">
          <div className="text-xs font-semibold mb-2 text-gold/90">Pillagers</div>
          <TroopDisplay
            troops={history.attacker_lost_troops}
            className="origin-top-left"
            negative
            iconSize="sm"
            direction="column"
          />
        </div>

        {/* Structure Troops Lost */}
        <div className="flex flex-col">
          <div className="text-xs font-semibold mb-2 text-gold/90">Structure</div>
          <TroopDisplay
            troops={history.structure_lost_troops}
            className="origin-top-left"
            negative
            iconSize="sm"
            direction="column"
          />
        </div>

        {/* Destroyed Building */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-semibold mb-2 text-gold/90">Destroyed Building</div>
          <div className="flex flex-wrap gap-2 justify-center min-h-[60px] items-center">
            <div className="text-center text-sm text-gold/80">
              {history.destroyed_building_category.replace(/([A-Z])/g, " $1").trim()}
            </div>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="absolute bottom-2 right-4 text-xs text-gold/60 italic">
        {`${formatTime(Date.now() / 1000 - history.timestamp)} ago`}
      </div>
    </div>
  );
};

export const PillageHistory = ({ structureId }: { structureId: ID }) => {
  const {
    setup: {
      components: { events },
    },
  } = useDojo();

  const [pillageHistory, setPillageHistory] = useState<PillageEvent[]>([]);
  const { getAddressNameFromEntity } = useEntitiesUtils();

  useEffect(() => {
    const query = defineQuery([HasValue(events.BattlePillageData, { pillaged_structure_entity_id: structureId })], {
      runOnInit: true,
    });

    const subscription = query.update$.subscribe((update) => {
      if (isComponentUpdate(update, events.BattlePillageData)) {
        const event = getComponentValue(events.BattlePillageData, update.entity);
        setPillageHistory((prev) => [event!, ...prev]);
      }
    });

    return () => subscription.unsubscribe();
  }, [events.BattlePillageData, structureId]);

  return (
    <div className="p-1 h-full">
      <div className="overflow-auto h-full">
        <div className="overflow-scroll-y grid grid-cols-1 gap-4">
          {pillageHistory
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20)
            .map((history, index) => {
              const addressName = getAddressNameFromEntity(history.pillager_army_entity_id);
              return <PillageHistoryItem key={index} addressName={addressName || ""} history={history} />;
            })}
        </div>
      </div>
    </div>
  );
};
