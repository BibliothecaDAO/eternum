import { useState } from "react";
import { canonicalRealm } from "@bibliothecadao/eternum";

import { useHeldRealms } from "@/hooks/use-holdings";
import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { AppButton, AppEmpty } from "@/ui/design-system/kit/app-elements";
import {
  HELD_REALMS_UNREADABLE,
  NO_HELD_REALMS,
  PROFILE_WORDS,
  TRY_AGAIN,
  WORDS,
  YOUR_REALMS,
  numberedRealm,
} from "@/ui/design-system/kit/words";

import { MARKET } from "../community";
import { ShellWindow } from "../frame/shell-window";

export const HoldingsStrip = () => {
  const { wallet, held } = useHeldRealms();
  const [open, setOpen] = useState(false);
  if (wallet === null) return null;
  return (
    <>
      <div className="app-holdings" role="group" aria-label={PROFILE_WORDS.holdings}>
        <Holding
          icon="realm"
          count={held.isError ? PROFILE_WORDS.unknownCount : held.data?.length}
          label={PROFILE_WORDS.realms}
          onPress={() => setOpen(true)}
        />
      </div>
      {open && <RealmsSheet held={held} onClose={() => setOpen(false)} />}
    </>
  );
};

/** One count: its painting, its number (blank while it is read), its name. */
const Holding = ({
  icon,
  count,
  label,
  onPress,
}: {
  icon: IconMeaning;
  count?: number | string;
  label: string;
  onPress: () => void;
}) => (
  <button type="button" className="app-holdings__item" onClick={onPress}>
    <Icon name={icon} size={44} />
    {count !== undefined && <b className="text-app-strong text-app-ink">{count}</b>}
    <span className="text-app-label text-app-muted">{label}</span>
  </button>
);

export const RealmsStatus = ({ held }: { held: ReturnType<typeof useHeldRealms>["held"] }) => {
  if (held.isError)
    return (
      <AppEmpty
        icon="realm"
        line={HELD_REALMS_UNREADABLE}
        action={
          <AppButton kind="secondary" onClick={() => void held.refetch()}>
            {TRY_AGAIN}
          </AppButton>
        }
      />
    );
  if (held.data?.length === 0) return <AppEmpty icon="realm" line={NO_HELD_REALMS} />;
  return null;
};

/** The linked wallet's Realms, each by its number and name; the Market sells and buys them. */
export const RealmsSheet = ({
  held,
  onClose,
}: {
  held: ReturnType<typeof useHeldRealms>["held"];
  onClose: () => void;
}) => (
  <ShellWindow title={YOUR_REALMS} onClose={onClose}>
    <div className="flex flex-col gap-4">
      {held.isError || held.data?.length === 0 ? (
        <RealmsStatus held={held} />
      ) : (
        <ul className="flex flex-col gap-2" aria-label={YOUR_REALMS}>
          {held.data?.map(({ realmId }) => (
            <li key={realmId} className="flex items-center gap-3 text-app-strong text-app-ink">
              <Icon name="realm" size={36} />
              {numberedRealm(realmId, canonicalRealm(realmId)?.name)}
            </li>
          ))}
        </ul>
      )}
      <AppButton kind="secondary" icon="trade" onClick={() => window.open(MARKET, "_blank", "noopener")}>
        {WORDS.market}
      </AppButton>
    </div>
  </ShellWindow>
);
