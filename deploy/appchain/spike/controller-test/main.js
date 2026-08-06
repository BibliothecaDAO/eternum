// M0 checklist C — Controller login + session execution on the spike chain.
// Standalone because the eternum client hardwires local -> predeployed
// accounts; this isolates "does the keychain accept a self-hosted katana with
// a bespoke chain id" from all game code.
import Controller from "@cartridge/controller";
import { RpcProvider } from "starknet";

const CHAIN_ID = "0x57505f5245414c4d535f444556"; // WP_REALMS_DEV
// The hosted keychain iframe (https://x.cartridge.gg) cannot fetch
// http://localhost under Chrome's Local Network Access rules -> "No chainId".
// Pass a public https tunnel for the RPC via ?rpc=, e.g.
//   cloudflared tunnel --url http://localhost:5050
//   http://localhost:5173/?rpc=https://xxx.trycloudflare.com
const RPC_URL = new URLSearchParams(location.search).get("rpc") ?? "http://localhost:5050";
// katana dev fee token (predeployed ETH) — a universal target for a trivial
// session call: transfer(self, 0).
const FEE_TOKEN = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

const logEl = document.getElementById("log");
const log = (m) => { logEl.textContent += m + "\n"; console.log(m); };

const controller = new Controller({
  chains: [{ rpcUrl: RPC_URL }],
  defaultChainId: CHAIN_ID,
  policies: {
    contracts: {
      [FEE_TOKEN]: {
        methods: [{ name: "Transfer", entrypoint: "transfer" }],
      },
    },
  },
});

let account;

document.getElementById("connect").onclick = async () => {
  try {
    account = await controller.connect();
    log(`connected: ${account.address}`);
    log(`username:  ${await controller.username()}`);
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    log(`node chain id: ${await provider.getChainId()} (expect ${CHAIN_ID})`);
    const cls = await provider.getClassHashAt(account.address).catch(() => null);
    log(cls ? `account deployed, class ${cls}` : "account NOT deployed on chain (check --cartridge.controllers)");
    document.getElementById("execute").disabled = false;
  } catch (e) {
    log(`connect failed: ${e.message ?? e}`);
  }
};

document.getElementById("execute").onclick = async () => {
  try {
    // Covered by the session policy above -> should route through the katana
    // paymaster as an outside-execution with NO wallet popup. A popup here
    // means the session was not created for this chain.
    const res = await account.execute([
      {
        contractAddress: FEE_TOKEN,
        entrypoint: "transfer",
        calldata: [account.address, "0x0", "0x0"],
      },
    ]);
    log(`tx: ${res.transaction_hash}`);
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const receipt = await provider.waitForTransaction(res.transaction_hash);
    log(`status: ${receipt.statusReceipt ?? JSON.stringify(receipt.execution_status ?? receipt)}`);
    log("now check: docker logs spike_katana_1 | grep -i outside  (paymaster relay evidence)");
  } catch (e) {
    log(`execute failed: ${e.message ?? e}`);
  }
};
