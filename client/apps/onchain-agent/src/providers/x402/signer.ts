import { createPublicClient, http, isAddress, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { SignPermit } from "./types.js";

const DEFAULT_PERMIT_TTL_SECONDS = 5 * 60;
const DEFAULT_X402_VERSION = 2;
const ERC2612_NONCES_ABI = parseAbi(["function nonces(address owner) view returns (uint256)"]);

const DEFAULT_RPC_URLS: Record<number, string> = {
	1: "https://ethereum-rpc.publicnode.com",
	8453: "https://mainnet.base.org",
	84532: "https://sepolia.base.org",
};

export interface CreateViemSignerOptions {
	now?: () => number;
	ttlSeconds?: number;
	resolveNonce?: (params: { chainId: number; asset: `0x${string}`; owner: `0x${string}` }) => Promise<string>;
	x402Version?: number;
}

function parseChainId(network: string): number {
	const match = /^eip155:(\d+)$/.exec(network);
	if (!match) {
		throw new Error(`Unsupported x402 network "${network}". Expected CAIP-2 eip155:<chainId>.`);
	}
	return Number.parseInt(match[1], 10);
}

function normalizeUintString(value: string): string {
	try {
		return BigInt(value).toString();
	} catch {
		throw new Error(`Invalid uint value "${value}"`);
	}
}

function rpcUrlForChainId(chainId: number): string {
	const url = DEFAULT_RPC_URLS[chainId];
	if (!url) {
		throw new Error(`No default RPC URL for chainId ${chainId}.`);
	}
	return url;
}

async function resolveErc2612Nonce(params: {
	chainId: number;
	asset: `0x${string}`;
	owner: `0x${string}`;
}): Promise<string> {
	const client = createPublicClient({
		transport: http(rpcUrlForChainId(params.chainId)),
	});
	const nonce = await client.readContract({
		address: params.asset,
		abi: ERC2612_NONCES_ABI,
		functionName: "nonces",
		args: [params.owner],
	});
	return nonce.toString();
}

export function createViemSigner(options: CreateViemSignerOptions = {}): SignPermit {
	const now = options.now ?? (() => Date.now());
	const ttlSeconds = options.ttlSeconds ?? DEFAULT_PERMIT_TTL_SECONDS;
	const resolveNonce = options.resolveNonce ?? resolveErc2612Nonce;
	const x402Version = options.x402Version ?? DEFAULT_X402_VERSION;

	return async ({ privateKey, routerConfig, permitCap }) => {
		const account = privateKeyToAccount(privateKey as `0x${string}`);
		const deadline = Math.floor(now() / 1000) + ttlSeconds;
		const chainId = parseChainId(routerConfig.network);
		const owner = account.address;
		const spender = (routerConfig.facilitatorSigner || routerConfig.payTo).trim();
		if (!isAddress(routerConfig.asset)) {
			throw new Error(`Invalid x402 asset address "${routerConfig.asset}"`);
		}
		if (!isAddress(spender)) {
			throw new Error(`Invalid x402 spender address "${spender}"`);
		}

		const nonce = normalizeUintString(
			await resolveNonce({
				chainId,
				asset: routerConfig.asset,
				owner,
			}),
		);
		const message = {
			owner,
			spender: spender as `0x${string}`,
			value: BigInt(permitCap),
			nonce: BigInt(nonce),
			deadline: BigInt(deadline),
		} as const;
		const signature = await account.signTypedData({
			domain: {
				name: routerConfig.tokenName,
				version: routerConfig.tokenVersion,
				chainId,
				verifyingContract: routerConfig.asset,
			},
			types: {
				Permit: [
					{ name: "owner", type: "address" },
					{ name: "spender", type: "address" },
					{ name: "value", type: "uint256" },
					{ name: "nonce", type: "uint256" },
					{ name: "deadline", type: "uint256" },
				],
			},
			primaryType: "Permit",
			message,
		});
		const paymentPayload = {
			x402Version,
			accepted: {
				scheme: "upto",
				network: routerConfig.network,
				asset: routerConfig.asset,
				payTo: routerConfig.payTo,
				extra: {
					name: routerConfig.tokenName,
					version: routerConfig.tokenVersion,
				},
			},
			payload: {
				authorization: {
					from: owner,
					to: spender,
					value: permitCap,
					nonce,
					validBefore: String(deadline),
				},
				signature,
			},
		};
		const paymentSig = Buffer.from(JSON.stringify(paymentPayload), "utf8").toString("base64");

		return {
			paymentSig,
			deadline,
			maxValue: permitCap,
			nonce,
			network: routerConfig.network,
			asset: routerConfig.asset,
			payTo: routerConfig.payTo,
		};
	};
}

export { DEFAULT_PERMIT_TTL_SECONDS };
