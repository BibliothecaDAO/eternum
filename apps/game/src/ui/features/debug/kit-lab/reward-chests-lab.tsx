import { Link } from "react-router-dom";
import { Icon } from "@/ui/design-system/icon";
import { rewardChestMeaning } from "@/ui/design-system/domain-icon-meaning";
import { REWARD_WORDS } from "@/ui/design-system/kit/words";

export function RewardChestsLab() {
  return (
    <main className="h-full overflow-auto bg-kit-ground p-6 text-kit-cream" data-reward-chests>
      <h1 className="font-ui text-title">Reward chests keep their rank</h1>
      <p>The map crate stays on the map. Rewards use the approved five chest tiers, sealed and opened.</p>
      <p>Before: the crate in titles and buttons. After: the same reward tier as the large artwork.</p>
      <div className="my-4 flex flex-wrap gap-4">
        {(["reward-pending", "reward-sealed", "reward-opening", "reward-lords"] as const).map((state) => (
          <Link key={state} to={`/lab/app/${state}/results/0x5245414c4d53-7?capture=1`}>
            {state}
          </Link>
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((band) => (
        <section key={band} data-reward-band={band} className="mb-6 border-t border-kit-line pt-4">
          <h2>{REWARD_WORDS.band[band]}</h2>
          <div className="flex flex-wrap gap-6">
            <div>
              <p>Before · title / button</p>
              <Icon name="chest" size={26} />
              <Icon name="chest" size={22} />
            </div>
            <div>
              <p>After · title / button</p>
              <Icon name={rewardChestMeaning(band)} size={26} />
              <Icon name={rewardChestMeaning(band)} size={22} />
            </div>
            <div>
              <p>Sealed · 176 px</p>
              <Icon name={rewardChestMeaning(band)} size={176} />
            </div>
            <div>
              <p>Opening · 192 px</p>
              <Icon name={rewardChestMeaning(band, true)} size={192} />
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}
