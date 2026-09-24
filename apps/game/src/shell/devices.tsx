import { useCallback, useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { listOpenShards, openKnownShards } from "@/runtime/world/shards";
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import {
  getOrCreateDeviceKey,
  readAccountDevices,
  revokeDeviceEverywhere,
  type DeviceShard,
  type DeviceShardFailure,
} from "@bibliothecadao/eternum";

import { shortAddress } from "./format";
import { useRealmsPlayer } from "./herald";
import { GhostButton, PanelTitle } from "./kit";

/** One device key and the shards where it signs for the player's account. */
interface Device {
  key: string;
  shards: DeviceShard[];
}

interface DeviceList {
  devices: Device[];
  /** Shards that could not be opened or read: the list is partial, and says where. */
  failures: DeviceShardFailure[];
}

/**
 * The account's devices across every shard this client knows, read from each shard's device events at the player's one
 * address: the directory lists only shards whose accounts share our guardian and class.
 */
async function readDevices(address: string): Promise<DeviceList> {
  const unopened = await openKnownShards();
  const shards = listOpenShards().map((shard) => ({ ...shard, provider: getCachedRpcProvider(shard.rpcUrl) }));
  const { devices, failures } = await readAccountDevices(address, shards);
  return {
    devices: [...devices].map(([key, signsOn]) => ({ key, shards: signsOn })),
    failures: [...unopened.map(({ url, error }) => ({ shard: url, error })), ...failures],
  };
}

const describeFailures = (verb: string, failures: DeviceShardFailure[]) =>
  failures.map(({ shard, error }) => `${verb} on ${shard}: ${error.message}`);

export const DevicesPanel = ({ realmsId }: { realmsId: string }) => {
  const thisDevice = getOrCreateDeviceKey(localStorage).publicKey;
  const address = useRealmsPlayer();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const load = useCallback(
    (removalErrors: string[] = []) => {
      if (!address) return;
      readDevices(address).then(
        ({ devices, failures }) => {
          setDevices(devices);
          setErrors([...removalErrors, ...describeFailures("Not read", failures)]);
        },
        (cause: unknown) => setErrors([cause instanceof Error ? cause.message : "Devices could not be read."]),
      );
    },
    [address],
  );
  useEffect(load, [load]);

  const revoke = async (device: Device) => {
    setPending(device.key);
    setErrors([]);
    const failures = await revokeDeviceEverywhere({
      shards: device.shards,
      realmsId,
      device: getOrCreateDeviceKey(localStorage),
      deviceKey: device.key,
      approve: identityClient.approveDeviceChange,
    });
    setPending(null);
    load(describeFailures("Not removed", failures));
  };

  return (
    <div>
      <PanelTitle>Devices</PanelTitle>
      {devices === null && errors.length === 0 ? (
        <div className="text-[13px] text-gold/60">Reading devices…</div>
      ) : null}
      <div className="space-y-2">
        {devices?.map((device) => (
          <div
            key={device.key}
            className="flex items-center justify-between gap-2.5 rounded-lg border border-gold/20 bg-black/40 px-3 py-2.5 text-[13px]"
          >
            <span className="font-mono text-[12px]">
              {shortAddress(device.key)}
              {BigInt(device.key) === BigInt(thisDevice) ? (
                <span className="ml-2 text-gold/60">this device</span>
              ) : null}
            </span>
            {BigInt(device.key) === BigInt(thisDevice) ? null : (
              <GhostButton disabled={pending !== null} onClick={() => void revoke(device)}>
                {pending === device.key ? "Removing…" : "Remove"}
              </GhostButton>
            )}
          </div>
        ))}
      </div>
      {errors.map((message) => (
        <div key={message} className="mt-2 text-[12.5px] text-danger">
          {message}
        </div>
      ))}
    </div>
  );
};
