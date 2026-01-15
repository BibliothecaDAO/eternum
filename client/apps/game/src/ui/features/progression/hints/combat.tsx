import { Headline } from "@/ui/design-system/molecules";
import { configManager } from "@bibliothecadao/eternum";

export const Combat = () => {
  const troopConfig = configManager.getTroopConfig();

  return (
    <div className="space-y-8">
      <Headline>Combat</Headline>

      <section className="space-y-4">
        <h4>Combat System Overview</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Combat in Realms involves managing armies, engaging in battles, raiding structures, and understanding the
            nuances of troop tiers, stamina, and biome effects.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Armies</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Armies consist of a single troop type and tier. Each hex can host only one army. Realms and Villages have
            limits on guard and field armies, which can be increased by upgrading or constructing military buildings.
            The maximum size of an army is{" "}
            {troopConfig.troop_limit_config.explorer_guard_max_troop_count.toLocaleString()}.
          </p>
          <h5>Field Armies</h5>
          <p className="leading-relaxed">
            Field armies are used for exploration, patrolling, defending, and attacking on the world map. They are
            deployed to hexes surrounding their parent Realm. They can attack other armies or structures on adjacent
            hexes.
          </p>
          <h5>Guard Armies</h5>
          <p className="leading-relaxed">
            Guard armies defend structures and do not appear on the world map. They occupy defense slots. When a
            structure is attacked, guard armies are targeted sequentially. If a guard army is destroyed, its slot
            becomes unavailable for reinforcement for{" "}
            {Math.floor(troopConfig.troop_limit_config.guard_resurrection_delay / 3600)} hours. Guard armies can also
            attack adjacent hexes.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Raiding</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Raiding allows field armies to steal resources from adjacent structures without battling guard armies first.
          </p>
          <h5>Requirements</h5>
          <ul className="list-disc pl-6">
            <li>At least {troopConfig.troop_stamina_config.stamina_attack_req} stamina.</li>
            <li>Army must be adjacent to the target structure.</li>
            <li>
              Structure must contain raidable resources (Food, Common Resources, Rare Resources, Ancient Fragments).
            </li>
          </ul>
          <h5>Success Chance</h5>
          <ul className="list-disc pl-6">
            <li>0% if raiding army's damage &lt; 50% of combined guard armies' damage.</li>
            <li>100% if raiding army's damage &gt; 200% of combined guard armies' damage.</li>
            <li>Scales proportionally between 50% and 200%.</li>
            <li>100% (automatic success) if no guard armies are present.</li>
          </ul>
          <h5>Outcomes</h5>
          <p className="leading-relaxed">
            Successful Raid: Resources transferred (limited by carry capacity), both armies suffer reduced casualties,
            raiding army's stamina reduced by {troopConfig.troop_stamina_config.stamina_attack_req}.
          </p>
          <p className="leading-relaxed">
            Failed Raid: No resources stolen, both armies still suffer reduced casualties, raiding army's stamina
            reduced by {troopConfig.troop_stamina_config.stamina_attack_req}.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Damage Calculation</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Damage is the number of casualties dealt. It's calculated based on the number of troops, troop tier,
            stamina, and biome bonuses. Damage is inflicted simultaneously by both sides. Battles can last multiple
            rounds.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Stamina & Biome Effects</h4>
        <div className="space-y-4 text-gray-200">
          <h5>Stamina - Attacking Army</h5>
          <p className="leading-relaxed">
            Requires a minimum of {troopConfig.troop_stamina_config.stamina_attack_req} stamina to attack. Each
            additional stamina point above this grants a 1% damage bonus, up to +30% damage at 60 stamina. If the
            attacking army wins, they gain +30 stamina.
          </p>
          <h5>Stamina - Defending Army</h5>
          <p className="leading-relaxed">
            Incurs a 1% damage reduction for every stamina point below 30 (e.g., -20% damage at 10 stamina). Maximum
            penalty is -30% damage at 0 stamina. Successfully defending does not deplete stamina.
          </p>
          <h5>Biome Combat Effects</h5>
          <p className="leading-relaxed">
            Biome of the defending army affects combat. Armies can gain +30% damage, -30% damage, or no effect.
          </p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Knights:</strong> Excel in forests. Suffer in deserts, beaches, snow.
            </li>
            <li>
              <strong>Crossbowmen:</strong> Benefit from open seas, beaches, snow. Disadvantaged in flat, open terrain.
            </li>
            <li>
              <strong>Paladins:</strong> Dominate open, flat terrain. Hindered in dense forests, open water.
            </li>
            <li>
              <strong>Scorched Biome:</strong> +30% damage to ALL troop types.
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Troop Tiers</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Troops come in three tiers: T1 (basic), T2, and T3 (advanced). Higher tiers offer significantly increased
            combat strength and stamina.
          </p>
          <h5>Production</h5>
          <ul className="list-disc pl-6">
            <li>Two T1 troops combine to produce one T2 troop.</li>
            <li>Two T2 troops combine to produce one T3 troop.</li>
          </ul>
          <p className="leading-relaxed">
            Higher-tier troops are produced in specialized buildings requiring rare resources and lower-tier troops.
          </p>
        </div>
      </section>
    </div>
  );
};

const Strength = ({
  strength,
  strongAgainst,
  weakAgainst,
  advantagePercent,
  disadvantagePercent,
}: {
  strength: number;
  strongAgainst: string;
  weakAgainst: string;
  advantagePercent: number;
  disadvantagePercent: number;
}) => {
  return (
    <div className="flex flex-col">
      <div>
        + {advantagePercent}% vs {strongAgainst}
      </div>
      <div>
        - {disadvantagePercent}% vs {weakAgainst}
      </div>
    </div>
  );
};
