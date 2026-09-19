import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CallData, RpcProvider, uint256 } from "starknet";
import { ResourcesIds } from "@bibliothecadao/types";
import type { NativeCommand } from "../../../../packages/provider/src/native-command";
import { buildNativePreset } from "../config/native-preset";
import { loadEnvironmentConfiguration } from "../config/config-loader";
import { buildNativeGameParams, buildNativePresetRegistration, registerNativePreset } from "../registrar/native-preset";
import { createRegistrarGame } from "../registrar/calls";
import { createMadaraAccount } from "../shared/madara-account";
import { waitForSuccess } from "../shared/declare";
import {
  admissionFor,
  commandArguments,
  readFixture,
  signedRequest,
} from "../../../../deploy/athanor/randomness/native-intent";
import { createNativeTicketSubmission } from "../../../../packages/provider/src/native-ticket";
import { nativeExecutionOutcomes, requireNativeExecutionOutcome } from "../../../../packages/provider/src/native-batch";
import { NativeDecoder } from "../../../../apps/herald/src/native/decoder";

const fixturePath = process.env.NATIVE_PRESET_LAB_FIXTURE;

// This gate creates an isolated game using the actual registrar/deployer definition on the isolated candidate chain.
test.skipIf(!fixturePath)(
  "deployer Eternum preset registers tokens and executes a deposit and withdrawal",
  async () => {
    const manifestPath = process.env.NATIVE_WORLD_MANIFEST;
    const admissionUrl = process.env.ADMISSION_URL;
    if (!manifestPath || !admissionUrl) throw new Error("Native lab manifest and admission URL are required");
    if (new URL(admissionUrl).hostname !== "127.0.0.1")
      throw new Error("Preset integration requires a loopback admission service");
    const fixture = readFixture(fixturePath!);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const provider = new RpcProvider({ nodeUrl: fixture.rpc });
    const adminAddress = process.env.DEPLOYER_ACCOUNT_ADDRESS;
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!adminAddress || !privateKey) throw new Error("Isolated deployer credentials are required");
    const admin = createMadaraAccount(provider, adminAddress, privateKey);
    const actor = createMadaraAccount(provider, fixture.actor, privateKey);
    const registry = manifest.native.domains.registry.address;
    const bridge = manifest.native.domains.bridge.address;
    const config = loadEnvironmentConfiguration("madara.eternum");
    const definition = buildNativePreset(config);
    const stoneToken = definition.economy.withdrawals
      .unwrap()
      ?.tokens.find(({ resource_type }) => resource_type === ResourcesIds.Stone)?.token;
    if (!stoneToken) throw new Error("Configured Stone token is required");
    const [next] = await provider.callContract({ contractAddress: registry, entrypoint: "next_game_id" });
    const presetId = 1000 + Number(BigInt(next));
    await registerNativePreset(actor, presetId, buildNativePresetRegistration(config, presetId, manifestPath));
    const block = await provider.getBlock("latest");
    const params = buildNativeGameParams(config, {
      gameName: `preset-bridge-${presetId}`,
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
    const submit = createNativeTicketSubmission(admissionUrl);
    try {
      const execute = async (command: NativeCommand) => {
        const admission = await admissionFor(provider, fixture);
        const { action: _action, ...request } = signedRequest(
          fixture,
          admission,
          commandArguments(fixture, command),
          privateKey,
        );
        const { transaction_hash: transactionHash, order } = await submit(request);
        await waitForSuccess(admin, transactionHash);
        const receipt = await provider.getTransactionReceipt(transactionHash);
        if (!("events" in receipt)) throw new Error("Missing receipt events");
        const outcomes = nativeExecutionOutcomes(receipt.events, fixture.execution.address);
        const outcome = requireNativeExecutionOutcome(outcomes, {
          gameId: fixture.game,
          actor: fixture.actor,
          nonce: admission[3],
          order: order.toString(),
        });
        console.log(JSON.stringify({ action: command.kind, game: fixture.game, transactionHash, outcome }));
        expect(outcome.status).toBe("SUCCEEDED");
        return receipt.events
          .filter((event) => decoder.owns(event.from_address))
          .map((event, index) =>
            decoder.decode({
              ...event,
              block_number: "block_number" in receipt ? receipt.block_number : null,
              transaction_hash: transactionHash,
              transaction_index: 0,
              event_index: index,
            }),
          );
      };
      const rows = await execute({
        kind: "SettleSeason",
        value: {
          name: "0x627269646765",
          selected_realm: { kind: "Some", value: 3 },
        },
      });
      const home = rows.find((row) => row.kind === "set" && row.model.name === "Structure");
      if (!home || home.kind !== "set") throw new Error("Settlement emitted no structure");
      const structureId = Number(home.key.entity_id);
      const registered = await provider.callContract({
        contractAddress: bridge,
        entrypoint: "resource_token",
        calldata: [fixture.game, ResourcesIds.Stone],
      });
      expect(BigInt(registered[0])).toBe(BigInt(stoneToken));
      const funding = await admin.execute({
        contractAddress: stoneToken,
        entrypoint: "transfer",
        calldata: CallData.compile({ recipient: fixture.actor, amount: uint256.bnToUint256(10n ** 18n) }),
      });
      await waitForSuccess(admin, funding.transaction_hash);
      const approval = await actor.execute({
        contractAddress: stoneToken,
        entrypoint: "approve",
        calldata: CallData.compile({ spender: bridge, amount: uint256.bnToUint256(10n ** 18n) }),
      });
      await waitForSuccess(admin, approval.transaction_hash);
      const depositRows = await execute({
        kind: "DepositResource",
        value: {
          structure_id: structureId,
          resource_type: ResourcesIds.Stone,
          amount: 10n ** 18n,
          client_fee_recipient: "0x0",
        },
      });
      // At zero completed hyperstructures: retain 25%, charge three platform fees of 2.5%; realms pay no village fee.
      expect(
        depositRows.some(
          (row) =>
            row.kind === "set" &&
            row.model.name === "ResourceArrival" &&
            (row.value.resources as { resource_type: number; amount: bigint }[]).some(
              (resource) =>
                Number(resource.resource_type) === ResourcesIds.Stone && BigInt(resource.amount) === 231_250_000n,
            ),
        ),
      ).toBe(true);
      const arrival = depositRows.find((row) => row.kind === "set" && row.model.name === "ResourceArrival");
      if (!arrival || arrival.kind !== "set") throw new Error("Deposit emitted no arrival");
      const interval = Number(definition.rules.tick_config.delivery_tick_in_seconds);
      const availableAt = (Number(arrival.key.day) * 48 + Number(arrival.key.slot)) * interval;
      const deadline = Date.now() + (interval + 30) * 1_000;
      while ((await provider.getBlock("latest")).timestamp < availableAt) {
        if (Date.now() >= deadline) throw new Error("Chain did not reach the deposit arrival tick");
        await Bun.sleep(2_000);
      }
      const offloaded = await execute({
        kind: "OffloadArrival",
        value: {
          entity_id: structureId,
          day: BigInt(arrival.key.day),
          slot: Number(arrival.key.slot),
          resource_count: 1,
        },
      });
      expect(offloaded.some((row) => row.kind === "delete" && row.model.name === "ResourceArrival")).toBe(true);
      const recipient = "0x777";
      const balance = async () => {
        const [low, high] = await provider.callContract({
          contractAddress: stoneToken,
          entrypoint: "balanceOf",
          calldata: [recipient],
        });
        return uint256.uint256ToBN({ low, high });
      };
      const before = await balance();
      await execute({
        kind: "WithdrawResource",
        value: {
          structure_id: structureId,
          resource_type: ResourcesIds.Stone,
          amount: 100_000_000n,
          recipient,
          client_fee_recipient: "0x0",
        },
      });
      expect((await balance()) - before).toBe(23_125_000_000_000_000n);
    } finally {
      submit.dispose();
    }
  },
  360_000,
);
