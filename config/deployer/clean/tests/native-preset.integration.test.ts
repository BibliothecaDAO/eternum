import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CairoOption, CairoOptionVariant, CallData, RpcProvider, uint256 } from "starknet";
import { buildNativePreset } from "../config/native-preset";
import { loadEnvironmentConfiguration } from "../config/config-loader";
import { buildNativeGameParams, buildNativePresetRegistration, registerNativePreset } from "../registrar/native-preset";
import { createRegistrarGame } from "../registrar/calls";
import { createMadaraAccount } from "../shared/madara-account";
import { waitForSuccess } from "../shared/declare";
import { fixtureAdmin } from "../../../../deploy/madara-rand/fixture-admin";
import {
  admissionFor,
  commandArguments,
  readFixture,
  signedRequest,
  waitForOutcome,
} from "../../../../deploy/madara-rand/native-intent";
import { NativeDecoder } from "../../../../apps/herald/src/native/decoder";

const fixturePath = process.env.NATIVE_PRESET_LAB_FIXTURE;
const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

// This gate creates an isolated game using the actual registrar/deployer definition on the laptop chain.
test.skipIf(!fixturePath)(
  "deployer Eternum preset registers tokens and executes a deposit and withdrawal",
  async () => {
    const manifestPath = process.env.NATIVE_WORLD_MANIFEST;
    const admissionUrl = process.env.ADMISSION_URL;
    if (!manifestPath || !admissionUrl) throw new Error("Native lab manifest and admission URL are required");
    if (new URL(admissionUrl).hostname !== "127.0.0.1") throw new Error("Preset integration is laptop only");
    const fixture = readFixture(fixturePath!);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const provider = new RpcProvider({ nodeUrl: fixture.rpc });
    const admin = fixtureAdmin(provider);
    const actor = createMadaraAccount(provider, fixture.actor, "0x3039");
    const registry = manifest.native.domains.registry.address;
    const bridge = manifest.native.domains.bridge.address;
    const config = loadEnvironmentConfiguration("madara.eternum");
    config.faith!.reward_token = STRK;
    config.setup!.addresses.resources = { Stone: [2, STRK] };
    config.setup!.addresses.lords = STRK;
    const [next] = await provider.callContract({ contractAddress: registry, entrypoint: "next_game_id" });
    const presetId = 1000 + Number(BigInt(next));
    const definition = buildNativePreset(config);
    await registerNativePreset(actor, presetId, buildNativePresetRegistration(config, presetId, manifestPath));
    const block = await provider.getBlock("latest");
    const params = buildNativeGameParams(config, {
      gameName: "preset-bridge-check",
      presetId,
      startMainAt: block.timestamp,
      durationSeconds: 86400,
      devModeOn: true,
      singleRealmMode: true,
      twoPlayerMode: false,
      useMapOverride: false,
    });
    params.start_settling_at = block.timestamp;
    params.registration_start = block.timestamp - 1;
    const created = await createRegistrarGame(actor, params, manifest, undefined, definition);
    if (!created.gameId) throw new Error("Registrar returned no game id");
    fixture.game = `0x${BigInt(created.gameId).toString(16)}`;
    const decoder = new NativeDecoder(manifest);
    const execute = async (variant: string, value: object) => {
      const admission = await admissionFor(provider, fixture);
      const { action, ...request } = signedRequest(fixture, admission, commandArguments(fixture, variant, value));
      const response = await fetch(`${admissionUrl}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(await response.text());
      const outcome = await waitForOutcome(provider, fixture, `${admissionUrl}/actions`, action);
      await waitForSuccess(admin, outcome.transactionHash);
      expect(BigInt(outcome.status)).toBe(1n);
      const receipt = await provider.getTransactionReceipt(outcome.transactionHash);
      if (!("events" in receipt)) throw new Error("Missing receipt events");
      console.log(JSON.stringify({ action: variant, game: fixture.game, transactionHash: outcome.transactionHash }));
      return receipt.events
        .filter((event) => decoder.owns(event.from_address))
        .map((event, index) =>
          decoder.decode({
            ...event,
            block_number: "block_number" in receipt ? receipt.block_number : null,
            transaction_hash: outcome.transactionHash,
            transaction_index: 0,
            event_index: index,
          }),
        );
    };
    const rows = await execute("SettleSeason", {
      name: "0x627269646765",
      selected_realm: new CairoOption(CairoOptionVariant.Some, 3),
    });
    const home = rows.find((row) => row.kind === "set" && row.model.name === "Structure");
    if (!home || home.kind !== "set") throw new Error("Settlement emitted no structure");
    const structureId = Number(home.key.entity_id);
    const registered = await provider.callContract({
      contractAddress: bridge,
      entrypoint: "resource_token",
      calldata: [fixture.game, 2],
    });
    expect(BigInt(registered[0])).toBe(BigInt(STRK));
    const funding = await admin.execute({
      contractAddress: STRK,
      entrypoint: "transfer",
      calldata: CallData.compile({ recipient: fixture.actor, amount: uint256.bnToUint256(10n ** 18n) }),
    });
    await waitForSuccess(admin, funding.transaction_hash);
    const approval = await actor.execute({
      contractAddress: STRK,
      entrypoint: "approve",
      calldata: CallData.compile({ spender: bridge, amount: uint256.bnToUint256(10n ** 18n) }),
    });
    await waitForSuccess(admin, approval.transaction_hash);
    const depositRows = await execute("DepositResource", {
      structure_id: structureId,
      resource_type: 2,
      amount: uint256.bnToUint256(10n ** 18n),
      client_fee_recipient: "0x0",
    });
    // At zero completed hyperstructures: retain 25%, charge three platform fees of 2.5%; realms pay no village fee.
    expect(
      depositRows.some(
        (row) =>
          row.kind === "set" &&
          row.model.name === "ResourceArrival" &&
          (row.value.resources as { resource_type: number; amount: bigint }[]).some(
            (resource) => Number(resource.resource_type) === 2 && BigInt(resource.amount) === 231_250_000n,
          ),
      ),
    ).toBe(true);
    const recipient = "0x777";
    const balance = async () => {
      const [low, high] = await provider.callContract({
        contractAddress: STRK,
        entrypoint: "balanceOf",
        calldata: [recipient],
      });
      return uint256.uint256ToBN({ low, high });
    };
    const before = await balance();
    await execute("WithdrawResource", {
      structure_id: structureId,
      resource_type: 2,
      amount: 100_000_000n,
      recipient,
      client_fee_recipient: "0x0",
    });
    expect((await balance()) - before).toBe(23_125_000_000_000_000n);
  },
  120_000,
);
