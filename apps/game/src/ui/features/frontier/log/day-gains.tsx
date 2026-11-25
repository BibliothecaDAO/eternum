import "./day-gains.css";

import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { ASPECT_PAGE_WORDS, ESSENCE, LABOR } from "@/ui/design-system/kit/words";
import { gloryAmount, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatShort } from "@bibliothecadao/types";

export type DayGainsReading = { essence: number | undefined; labor: number | undefined; glory: number | undefined };

const GLORY_MODELS = ["RaceMember"] as const;

export const DayGains = ({ gains }: { gains: DayGainsReading }) => (
  <div data-day-gains className="day-gains">
    <Gain total="essence" icon="essence" value={signed(gains.essence)} name={ESSENCE} />
    <Gain total="labor" icon="labor" value={signed(gains.labor)} name={LABOR} />
    <Gain total="glory" icon="crown" value={formatShort(gains.glory)} name={ASPECT_PAGE_WORDS.glory} />
  </div>
);

export const useGloryHeld = (realm: NativeRows["Structure"] | null): number | undefined => {
  const facts = useNativeFacts(GLORY_MODELS);
  if (!realm) return undefined;
  const member = facts.store.requireOrAbsent("RaceMember", { game_id: realm.game_id, entity_id: realm.entity_id });
  return member.known ? gloryAmount(member.known.glory) : undefined;
};

const signed = (value: number | undefined) => formatShort(value, { signed: true });

const Gain = ({ total, icon, value, name }: { total: string; icon: IconMeaning; value: string; name: string }) => (
  <span data-total={total} role="img" aria-label={`${name} ${value}`} className="day-gains__gain">
    <Icon name={icon} size={30} />
    <b>{value}</b>
    <span>{name}</span>
  </span>
);
