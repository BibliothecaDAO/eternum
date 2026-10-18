import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudNotice, HudRelic, HudRow } from "@/ui/design-system/kit/hud-elements";
import { RelicRecipientType, ResourcesIds } from "@bibliothecadao/types";
import { relicKind, relicLine, relicShortName } from "../relic-words";
import { RelicInfoResult, useRelicMetadata } from "../hooks/use-relic-activation";

/** A held relic: its chip, how many are held, and what it does on hover once the game's relic rules have arrived. */
export const HeldRelic = ({ relicId, held }: { relicId: ResourcesIds; held: string }) => {
  const { relicInfo } = useRelicMetadata(relicId);
  return (
    <HudRelic
      icon={resourceMeaning(relicId)}
      kind={relicKind(relicId)}
      gives={relicShortName(relicId)}
      trail={`×${held}`}
      state="held"
      tip={relicInfo ? relicLine(relicId) : undefined}
    />
  );
};

/** What activating costs in Essence against what its payer holds, and what is missing. */
export const RelicEssenceRequirement = ({
  essenceCost,
  essenceBalance,
  shortfall,
  hasEnoughEssence,
}: {
  essenceCost: number;
  /** Undefined while the balance is unknown. */
  essenceBalance: number | undefined;
  shortfall: string;
  hasEnoughEssence: boolean;
}) => (
  <div className="flex flex-col gap-1">
    <HudRow
      title="Activation cost"
      trail={<span className="tabular-nums">{essenceCost.toLocaleString()} Essence</span>}
    />
    <HudRow
      title="Essence balance"
      trail={
        <span className={hasEnoughEssence ? "tabular-nums text-hud-good" : "tabular-nums text-hud-bad"}>
          {essenceBalance?.toLocaleString() ?? "—"}
        </span>
      }
    />
    {!hasEnoughEssence && <HudNotice tone="bad" line={shortfall} />}
  </div>
);

const recipientWords = (recipientType: RelicRecipientType) =>
  recipientType === RelicRecipientType.Explorer ? "explorers" : "structures";

/** Why this holder cannot activate the relic: it works on the other kind of holder. */
export const RelicIncompatibilityNotice = ({
  relicInfo,
  recipientType,
}: {
  relicInfo: RelicInfoResult;
  recipientType: RelicRecipientType;
}) =>
  relicInfo ? (
    <HudNotice
      tone="bad"
      line={`This relic cannot be activated by ${recipientWords(recipientType)}`}
      why={`${relicInfo.recipientType} relics can only be activated by ${recipientWords(relicInfo.recipientType)}`}
    />
  ) : null;

/** The Essence an activation pays, as its button names it. */
export const essencePrice = (essenceCost: number) => [
  { icon: resourceMeaning(ResourcesIds.Essence), word: "Essence", amount: essenceCost.toLocaleString() },
];
