import { describe, expect, test } from "vitest";
import { buildWorldConfigForFactory } from "./world-config-builder";

const BASE_CONFIG = {
  factory_address: "0xbase",
  dev: { mode: { on: false } },
  season: {
    startMainAt: 0,
    startSettlingAt: 0,
    durationSeconds: 3600,
    bridgeCloseAfterEndSeconds: 1800,
    pointRegistrationCloseAfterEndSeconds: 1200,
  },
  blitz: {
    mode: { on: true },
    registration: {
      fee_amount: BigInt(1),
      fee_token: "0xtoken",
      fee_recipient: "0xrecipient",
      registration_count_max: 30,
      registration_delay_seconds: 60,
      registration_period_seconds: 600,
    },
  },
  settlement: {
    center: 0,
    base_distance: 70,
    subsequent_distance: 4,
    single_realm_mode: false,
  },
  mmr: {
    enabled: false,
  },
  trade: {
    maxCount: 10,
  },
  battle: {
    delaySeconds: 30,
    graceTickCount: 4,
    graceTickCountHyp: 8,
  },
  agent: {
    max_current_count: 20,
    max_lifetime_count: 200,
  },
};

describe("buildWorldConfigForFactory", () => {
  test("applies expanded M1 overrides and parses numeric fields", () => {
    const result = buildWorldConfigForFactory({
      baseConfig: BASE_CONFIG,
      defaults: {
        factoryAddress: "0xfactory",
        devModeOn: false,
        mmrEnabledOn: false,
        durationHours: 1,
        baseDurationMinutes: 0,
        defaultBlitzRegistration: {
          amount: "0.25",
          precision: 18,
          token: "0xdefaulttoken",
        },
      },
      overrides: {
        startMainAt: 1_700_000_000,
        startSettlingAt: 1_699_999_000,
        durationHours: "2",
        durationMinutes: "15",
        devModeOn: true,
        mmrEnabled: true,
        factoryAddress: "0xoverridefactory",
        singleRealmMode: true,
        blitzFeeAmount: "1.5",
        blitzFeePrecision: "18",
        blitzFeeToken: "0xfee",
        blitzFeeRecipient: "0xfeesink",
        registrationCountMax: "64",
        registrationDelaySeconds: "90",
        registrationPeriodSeconds: "1200",
        seasonBridgeCloseAfterEndSeconds: "3600",
        seasonPointRegistrationCloseAfterEndSeconds: "4000",
        settlementCenter: "10",
        settlementBaseDistance: "55",
        settlementSubsequentDistance: "6",
        tradeMaxCount: "25",
        battleGraceTickCount: "20",
        battleGraceTickCountHyp: "40",
        battleDelaySeconds: "80",
        agentMaxCurrentCount: "99",
        agentMaxLifetimeCount: "999",
      },
    });

    const dev = result.dev;
    const mmr = result.mmr;
    const season = result.season;
    const blitzRegistration = result.blitz?.registration;
    const settlement = result.settlement;
    const trade = result.trade;
    const battle = result.battle;
    const agent = result.agent;

    if (!dev?.mode || !mmr || !season || !blitzRegistration || !settlement || !trade || !battle || !agent) {
      throw new Error("Expected all config sections to be defined");
    }

    expect(result.factory_address).toBe("0xoverridefactory");
    expect(dev.mode.on).toBe(true);
    expect(mmr.enabled).toBe(true);
    expect(season.startMainAt).toBe(1_700_000_000);
    expect(season.startSettlingAt).toBe(1_699_999_000);
    expect(season.durationSeconds).toBe(8100);
    expect(season.bridgeCloseAfterEndSeconds).toBe(3600);
    expect(season.pointRegistrationCloseAfterEndSeconds).toBe(4000);
    expect(blitzRegistration.fee_amount).toBe(BigInt("1500000000000000000"));
    expect(blitzRegistration.fee_token).toBe("0xfee");
    expect(blitzRegistration.fee_recipient).toBe("0xfeesink");
    expect(blitzRegistration.registration_count_max).toBe(64);
    expect(blitzRegistration.registration_delay_seconds).toBe(90);
    expect(blitzRegistration.registration_period_seconds).toBe(1200);
    expect(settlement.single_realm_mode).toBe(true);
    expect(settlement.center).toBe(10);
    expect(settlement.base_distance).toBe(55);
    expect(settlement.subsequent_distance).toBe(6);
    expect(trade.maxCount).toBe(25);
    expect(battle.graceTickCount).toBe(20);
    expect(battle.graceTickCountHyp).toBe(40);
    expect(battle.delaySeconds).toBe(80);
    expect(agent.max_current_count).toBe(99);
    expect(agent.max_lifetime_count).toBe(999);
  });

  test("uses defaults when optional overrides are not set", () => {
    const result = buildWorldConfigForFactory({
      baseConfig: BASE_CONFIG,
      defaults: {
        factoryAddress: "0xfactory",
        devModeOn: true,
        mmrEnabledOn: false,
        durationHours: 3,
        baseDurationMinutes: 5,
        defaultBlitzRegistration: {
          amount: "0.000000000000001",
          precision: 18,
          token: "0xdefaulttoken",
        },
      },
      overrides: {},
    });

    const dev = result.dev;
    const mmr = result.mmr;
    const season = result.season;
    const blitzRegistration = result.blitz?.registration;

    if (!dev?.mode || !mmr || !season || !blitzRegistration) {
      throw new Error("Expected default config sections to be defined");
    }

    expect(result.factory_address).toBe("0xfactory");
    expect(dev.mode.on).toBe(true);
    expect(mmr.enabled).toBe(false);
    expect(season.durationSeconds).toBe(11100);
    expect(blitzRegistration.fee_amount).toBe(BigInt("1000"));
    expect(blitzRegistration.fee_token).toBe("0xdefaulttoken");
  });

  test("throws for invalid numeric inputs", () => {
    expect(() =>
      buildWorldConfigForFactory({
        baseConfig: BASE_CONFIG,
        defaults: {
          factoryAddress: "0xfactory",
          devModeOn: true,
          mmrEnabledOn: false,
          durationHours: 1,
          baseDurationMinutes: 0,
          defaultBlitzRegistration: {
            amount: "1",
            precision: 18,
            token: "0xdefaulttoken",
          },
        },
        overrides: {
          durationMinutes: "99",
        },
      }),
    ).toThrow("Duration minutes must be between 0 and 59");

    expect(() =>
      buildWorldConfigForFactory({
        baseConfig: BASE_CONFIG,
        defaults: {
          factoryAddress: "0xfactory",
          devModeOn: true,
          mmrEnabledOn: false,
          durationHours: 1,
          baseDurationMinutes: 0,
          defaultBlitzRegistration: {
            amount: "1",
            precision: 18,
            token: "0xdefaulttoken",
          },
        },
        overrides: {
          registrationCountMax: "-2",
        },
      }),
    ).toThrow("Registration count max must be a non-negative number");
  });
});
