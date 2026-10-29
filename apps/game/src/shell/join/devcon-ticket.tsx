import type { CampaignTicket } from "@realms-world/identity";

import { realmSkinIcon } from "@/three/structures/realm-skins";
import { Icon } from "@/ui/design-system/icon";
import { AppPanel, AppTicket } from "@/ui/design-system/kit/app-elements";
import { JOIN_WORDS } from "@/ui/design-system/kit/words";

import { DEVCON } from "./devcon";

/**
 * A Devcon ticket the account holds, turned over: gold under its rays for a golden one, and what its realm claims each
 * Frontier day. The landing shows it once opened; the player's card shows it again.
 */
export const DevconTicket = ({ tier }: { tier: CampaignTicket["tier"] }) => {
  const golden = tier === "golden";
  return (
    <>
      <AppTicket
        face={golden ? "golden" : "opened"}
        art={<Icon name={realmSkinIcon(golden ? "devcon-golden" : "devcon")} size={128} />}
        line={golden ? JOIN_WORDS.goldenLine : JOIN_WORDS.realm}
        stub={golden ? JOIN_WORDS.goldenStub(DEVCON.golden) : JOIN_WORDS.stub}
      />
      <DailyClaim golden={golden} />
    </>
  );
};

/** What this ticket's realm claims each Frontier day. */
export const DailyClaim = ({ golden }: { golden: boolean }) => {
  const { labor, essence } = DEVCON.claim(golden);
  return (
    <AppPanel className="w-full max-w-[20rem]">
      <ul className="flex flex-col gap-3 text-left text-app-strong text-app-ink">
        <li className="flex items-center gap-3">
          <Icon name="labor" size={32} />
          {JOIN_WORDS.laborEachDay(labor)}
        </li>
        <li className="flex items-center gap-3">
          <Icon name="essence" size={32} />
          {JOIN_WORDS.essenceEachDay(essence)}
        </li>
      </ul>
    </AppPanel>
  );
};
