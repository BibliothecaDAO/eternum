import { Data } from "effect";

/** A JSON-RPC read against mainnet failed (network, node, or revert on a view). */
export class RpcError extends Data.TaggedError("RpcError")<{
  readonly call: string;
  readonly cause: unknown;
}> {}

/** A value-plane contract has no mainnet address yet (pre-B.1 deploy). */
export class ValuePlaneNotDeployed extends Data.TaggedError("ValuePlaneNotDeployed")<{
  readonly contract: string;
}> {}

/** A boundary payload did not match its schema. Loud by design — never a silent zero. */
export class BoundaryDecodeError extends Data.TaggedError("BoundaryDecodeError")<{
  readonly boundary: string;
  readonly cause: unknown;
}> {}

/** No injected Starknet wallet was found in the page. */
export class NoWalletFound extends Data.TaggedError("NoWalletFound")<object> {}

/** The wallet refused or failed a connect / sign / execute request. */
export class WalletRequestFailed extends Data.TaggedError("WalletRequestFailed")<{
  readonly action: "connect" | "sign" | "execute";
  readonly cause: unknown;
}> {}

/** An action that needs a connected wallet ran without one. */
export class WalletNotConnected extends Data.TaggedError("WalletNotConnected")<object> {}

/** A submitted transaction was rejected or reverted on chain. */
export class TransactionFailed extends Data.TaggedError("TransactionFailed")<{
  readonly transactionHash: string;
  readonly cause: unknown;
}> {}

/** Herald did not answer or answered with an error status. */
export class HeraldUnreachable extends Data.TaggedError("HeraldUnreachable")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

/** The identity API did not answer or answered with an unexpected status. */
export class IdentityUnreachable extends Data.TaggedError("IdentityUnreachable")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

/** The identity API refused the request for lack of a session. */
export class Unauthorized extends Data.TaggedError("Unauthorized")<object> {}

/** The requested display name is already claimed (case-insensitively). */
export class NameTaken extends Data.TaggedError("NameTaken")<{ readonly name: string }> {}

/** The requested display name does not satisfy the name rules. */
export class NameInvalid extends Data.TaggedError("NameInvalid")<{
  readonly name: string;
  readonly reason: string;
}> {}
