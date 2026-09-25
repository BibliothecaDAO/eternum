import { useAccountStore } from "@/hooks/store/use-account-store";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
import { configManager } from "@bibliothecadao/eternum";
import { useExpeditionRules } from "../frontier-home";
import { replayGuide } from "./guide-seen";

/** Settings' way back to Ysolde: in a Frontier game, one button that starts her guide over. */
export const GuideSettings = () => {
  const rules = useExpeditionRules();
  const player = useAccountStore((state) => state.account?.address ?? null);
  if (!rules || !player) return null;
  return (
    <section className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">Guide</h3>
      <button
        type="button"
        className={HUD_PILL_BUTTON}
        onClick={() => replayGuide(configManager.getActiveGameId(), player)}
      >
        Replay Ysolde's guide
      </button>
    </section>
  );
};
