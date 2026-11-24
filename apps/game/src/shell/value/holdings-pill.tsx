import { ANCIENT_SEAL, FRAGMENTS, formatShort } from "@bibliothecadao/types";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { Icon } from "@/ui/design-system/icon";

import { type DirectoryGame, useDirectory } from "../herald";
import { chooseRehearsal, chooseSeason } from "../season-pick";

type Holdings = { fragments: number; ancientSeal: boolean };

export const holdingsOf = (games: readonly DirectoryGame[]): Holdings | null => {
  const season = chooseSeason(games, true);
  const testnet = chooseRehearsal(games, true);
  const played = [season, testnet].find((game) => game?.status === "Live") ?? season ?? testnet;
  const state = played?.player_state;
  if (!state || state.fragments === null) return null;
  return { fragments: state.fragments, ancientSeal: state.ancient_seal };
};

const HoldingsAmount = () => {
  const directory = useDirectory();
  const holdings = holdingsOf(directory.data?.games ?? []);
  if (!holdings) return null;
  const amount = formatShort(holdings.fragments);
  return (
    <span
      className="app-bar__balance"
      data-fragments-balance
      aria-label={[`${amount} ${FRAGMENTS}`, holdings.ancientSeal ? ANCIENT_SEAL : null].filter(Boolean).join(", ")}
    >
      {holdings.ancientSeal && <Icon name="final-seal" size={18} />}
      <Icon name="fragment" size={18} />
      <span>{amount}</span>
    </span>
  );
};

export const HoldingsPill = () => {
  const { session } = useIdentitySession();
  if (!session) return null;
  return <HoldingsAmount />;
};
