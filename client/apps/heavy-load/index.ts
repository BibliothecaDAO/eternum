import { EternumProvider, getContractByName, NAMESPACE } from "@bibliothecadao/eternum";
import { getSeasonAddresses } from "@contracts";
import { Account, RpcProvider, uint256 } from "starknet";
import manifest from "../../../contracts/game/manifest_local.json";

const provider = new RpcProvider({ nodeUrl: "http://localhost:5050" });
const response = await provider.fetch("dev_predeployedAccounts");

const addresses = getSeasonAddresses("local");

const accounts = ((await response.json()) as unknown as { result: { address: string; privateKey: string }[] }).result;
const realmDojoContractAddress = getContractByName(manifest, `${NAMESPACE}-realm_systems`);

let realmId = 90;
while (true) {
  for (const account of accounts as { address: string; privateKey: string }[]) {
    const accountObject = new Account(provider, account.address, account.privateKey);
    const transaction = await accountObject.execute([
      {
        contractAddress: addresses.realms,
        entrypoint: "mint",
        calldata: [uint256.bnToUint256(realmId)],
      },
      {
        contractAddress: addresses.seasonPass,
        entrypoint: "set_approval_for_all",
        calldata: [realmDojoContractAddress, true],
      },
      {
        contractAddress: addresses.seasonPass,
        entrypoint: "mint",
        calldata: [account.address, uint256.bnToUint256(realmId)],
      },
      {
        contractAddress: realmDojoContractAddress,
        entrypoint: "create",
        calldata: [account.address, realmId, account.address],
      },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 700));
    console.log(transaction.transaction_hash);

    const eternumProvider = new EternumProvider(manifest, "http://localhost:5050");
    const response = await fetch("http://localhost:8080/graphql", {
      method: "POST",
      body: JSON.stringify({
        query: `
		query {
		s1EternumOwnerModels(where:{address: "${account.address}"}) {
			edges {
			node {
				entity_id
			}
			}
		}
		}
      `,
      }),
    });

    const json = await response.json();
    console.log(json);
    let realm_entity_id = (json as any).data.s1EternumOwnerModels.edges[0].node.entity_id;
    await eternumProvider.claim_quest({
      quest_ids: [1, 2, 3, 4, 5, 6, 7, 8],
      receiver_id: realm_entity_id,
      signer: accountObject as any,
    });

    realmId++;
  }
}
