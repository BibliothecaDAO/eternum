import { frontierSeasonOnePreset } from "../../../../config/source/frontier/season-one";
import { nativeOathConstants as oaths } from "../schema/balance.gen";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { writeFileSync } from "node:fs";

const write = (name: string, felts: string[]) =>
  writeFileSync(new URL(`../tests/fixtures/${name}`, import.meta.url), felts.join("\n") + "\n");
write("oath-deep-loss.txt", oathDeepLossVectors());
write("oath-prizes.txt", oathPrizeVectors());
write("oath-stamina.txt", oathStaminaVectors());
write("oath-fight.txt", oathFightVectors());
write(
  "oath-pass-stamina.txt",
  [0, oaths.PASS_STAMINA / 2, oaths.PASS_STAMINA, oaths.PASS_STAMINA * 2].flatMap((deficit) =>
    [deficit, Math.min(deficit, oaths.PASS_STAMINA)].map(String),
  ),
);

function oathPrizeVectors(): string[] {
  const bit = (oath: number) => 1 << (oath - 1);
  const amount = 1_003n * BigInt(RESOURCE_PRECISION) + 7n;
  const sets = [
    0,
    bit(oaths.DETECTION),
    bit(oaths.BRILLIANCE),
    bit(oaths.RAGE),
    bit(oaths.DETECTION) | bit(oaths.BRILLIANCE) | bit(oaths.RAGE),
    bit(oaths.POWER),
  ];
  return sets.flatMap((held) => {
    const percent = (oath: number, value: number) => ((held & bit(oath)) !== 0 ? value : 100);
    return [frontierSeasonOnePreset.discovery.emptyRevealLimit, oaths.DETECTION_EMPTY_REVEAL_LIMIT - 1].flatMap(
      (base) =>
        [
          held,
          base,
          (held & bit(oaths.DETECTION)) !== 0 ? Math.min(base, oaths.DETECTION_EMPTY_REVEAL_LIMIT) : base,
          amount,
          (amount * BigInt(percent(oaths.BRILLIANCE, oaths.BRILLIANCE_PAY_PERCENT))) / 100n,
          (amount * BigInt(percent(oaths.RAGE, oaths.RAGE_PAY_PERCENT))) / 100n,
        ].map(String),
    );
  });
}

function oathStaminaVectors(): string[] {
  const bit = (oath: number) => 1 << (oath - 1);
  const sets = [
    0,
    bit(oaths.ANGER),
    bit(oaths.TITANS),
    bit(oaths.ENLIGHTENMENT),
    bit(oaths.FOX),
    bit(oaths.ANGER) | bit(oaths.TITANS) | bit(oaths.ENLIGHTENMENT) | bit(oaths.FOX),
    bit(oaths.POWER),
  ];
  const hourTicks = 30;
  return sets.flatMap((held) => {
    const holds = (oath: number) => (held & bit(oath)) !== 0;
    const regen = holds(oaths.ENLIGHTENMENT) ? oaths.ENLIGHTENMENT_REGEN_BPS : 10_000;
    return [
      [30, 20],
      [10, 10],
    ].flatMap(([attack, explore]) =>
      [
        held,
        attack,
        holds(oaths.ANGER) ? Math.min(attack!, oaths.ANGER_ATTACK_STAMINA) : attack,
        explore,
        holds(oaths.FOX) ? Math.floor((explore! * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100) : explore,
        holds(oaths.TITANS) ? oaths.TITANS_STAMINA : 0,
        regen,
        Math.floor((hourTicks * regen) / 10_000),
      ].map(String),
    );
  });
}

function oathFightVectors(): string[] {
  const bit = (oath: number) => 1 << (oath - 1);
  const amount = 1_003n * BigInt(RESOURCE_PRECISION) + 7n;
  const sets = [
    0,
    bit(oaths.SKILL),
    bit(oaths.FURY),
    bit(oaths.PERFECTION),
    bit(oaths.RAGE) | bit(oaths.PERFECTION),
    bit(oaths.SKILL) | bit(oaths.FURY) | bit(oaths.PERFECTION),
    bit(oaths.POWER),
  ];
  return sets.flatMap((held) => {
    const holds = (oath: number) => (held & bit(oath)) !== 0;
    return [
      [oaths.SKILL_BELOW_STAMINA - 1, 30, 1_000, 860],
      [oaths.SKILL_BELOW_STAMINA, 20, 1_000, 850],
    ].flatMap(([bar, cost, before, after]) => {
      const skill = holds(oaths.SKILL) && bar! < oaths.SKILL_BELOW_STAMINA ? 100 + oaths.SKILL_DAMAGE_PERCENT : 100;
      const clean = (before! - after!) * 100 < before! * oaths.PERFECTION_LOSS_PERCENT;
      const raged = holds(oaths.RAGE) ? (amount * BigInt(oaths.RAGE_PAY_PERCENT)) / 100n : amount;
      return [
        held,
        bar,
        (BigInt(skill) << 64n) / 100n,
        cost,
        holds(oaths.FURY) ? Math.floor((cost! * oaths.FURY_REFUND_PERCENT) / 100) : 0,
        before,
        after,
        clean ? 1 : 0,
        amount,
        clean && holds(oaths.PERFECTION) ? (raged * BigInt(oaths.PERFECTION_PAY_PERCENT)) / 100n : raged,
      ].map(String);
    });
  });
}

function oathDeepLossVectors(): string[] {
  const precision = BigInt(RESOURCE_PRECISION);
  const base = BigInt(frontierSeasonOnePreset.deep.lossPerTick) * precision;
  const vitriol = BigInt(oaths.VITRIOL_LOSS_PER_TICK) * precision;
  const mask = 1 << (oaths.VITRIOL - 1);
  const power = 1 << (oaths.POWER - 1);
  const troops = 1000n * precision;
  const cases: [number, bigint, bigint, bigint][] = [
    [0, troops, 2n, base],
    [mask, troops, 2n, vitriol],
    [mask | power, troops, 2n, vitriol],
    [power, troops, 2n, base],
    [mask, vitriol + 1n, 1n, vitriol],
    [mask, vitriol, 1n, vitriol],
    [mask, troops, 0n, vitriol],
    [mask, troops, (troops + vitriol - 1n) / vitriol, vitriol],
  ];
  return cases.flatMap(([held, count, ticks, loss]) => {
    const remaining = count - ticks * loss;
    return [held, base, count, ticks, loss, remaining > 0n ? remaining : 0n].map(String);
  });
}
