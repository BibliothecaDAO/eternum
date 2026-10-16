import { GameProvider } from "@/hooks/context/game-context";
import { useDocumentClass } from "@/hooks/use-document-class";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { ArmyDeploymentPicker } from "@/ui/features/military/components/army-deployment-picker";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useEffect, useMemo } from "react";

/**
 * The fixture realm's two states: 420 knights on hand, and none. The second loses its knights once its picker is open,
 * as a realm does, so the picker stays on the knights (the fixture holds only their recipe).
 */
const useFixtureRealms = () => {
  const realms = useMemo(
    () => [
      { label: "420 knights on hand", store: frontierDay().store },
      { label: "No troops on hand", store: frontierDay().store },
    ],
    [],
  );
  useEffect(() => {
    realms[1].store.applyFacts([
      { model: "ResourceBalance", key: "0x8", value: { game_id: 1, entity_id: 7, resource_type: 26, balance: "0" } },
    ] as never);
  }, [realms]);
  return realms;
};

/**
 * Dev only: the shared HUD's "Deploy field army" picker, the real component on the deploy fixture's realm, in the War
 * room skin, at /lab/kit/deploy. The fixture's realm has no map position, so Deploy reads "No free spawn hex."
 */
export const DeployLab = () => {
  useDocumentClass("classic-hud");
  const realms = useFixtureRealms();
  return (
    <div className="flex min-h-screen flex-wrap items-start gap-6 bg-[#0b1418] p-6 text-gold">
      {realms.map(({ label, store }) => (
        <figure key={label} className="space-y-2">
          <figcaption className="text-sm text-gold/60">{label}</figcaption>
          <div data-deploy-lab-picker className={cn(OVERLAY_SURFACE_BASE, "rounded-xl text-gold")}>
            <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
              <ArmyDeploymentPicker structureId={7} isExplorer />
            </GameProvider>
          </div>
        </figure>
      ))}
    </div>
  );
};
