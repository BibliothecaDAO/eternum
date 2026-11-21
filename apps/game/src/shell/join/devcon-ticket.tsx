import type { CampaignTicket } from "@realms-world/identity";

import { homeIcon } from "@/ui/design-system/home-icons";
import { Icon } from "@/ui/design-system/icon";
import { AppTicket } from "@/ui/design-system/kit/app-elements";
import { JOIN_WORDS } from "@/ui/design-system/kit/words";

export const DevconTicket = ({ tier }: { tier: CampaignTicket["tier"] }) => {
  const golden = tier === "golden";
  return (
    <AppTicket
      face={golden ? "golden" : "opened"}
      art={<Icon name={homeIcon(golden ? "devcon-golden" : "devcon", 0)} size={128} />}
      line={golden ? JOIN_WORDS.goldenLine : JOIN_WORDS.realm}
      stub={golden ? JOIN_WORDS.goldenStub : JOIN_WORDS.stub}
    />
  );
};
