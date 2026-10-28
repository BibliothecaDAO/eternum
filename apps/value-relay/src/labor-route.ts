import { Effect, Schema } from "effect";
import type { LaborClaim, LaborGrant, RelayEffect } from "./ports";
import { playerRequest, readPlayerBody, PlayerRequestError, type PlayerIdentity } from "./player-request";

const LaborRequest = Schema.Struct({
  gameId: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 0xffffffff }))),
  home: Schema.String.pipe(Schema.check(Schema.isPattern(/^(0x[0-9a-fA-F]{1,16}|[0-9]{1,20})$/))),
});
interface LaborRoute extends PlayerIdentity {
  chainId: string;
  currentDay(gameId: number): RelayEffect<number>;
  grant(claim: LaborClaim): Promise<LaborGrant>;
}
export const handleLaborRequest = (request: Request, dependencies: LaborRoute): Promise<Response> =>
  playerRequest(request, dependencies, async (player) => {
    const body = await readPlayerBody(
      request,
      Schema.decodeUnknownSync(LaborRequest, { onExcessProperty: "error" }),
      "invalid_labor_request",
    );
    if (BigInt(body.home) === 0n || BigInt(body.home) > 0xffffffffffffffffn)
      throw new PlayerRequestError(400, "unsupported_home_width");
    const day = await Effect.runPromise(dependencies.currentDay(body.gameId));
    try {
      const grant = await dependencies.grant({ ...body, ...player, day, chainId: dependencies.chainId });
      return { day, grant };
    } catch {
      throw new PlayerRequestError(409, "labor_grant_refused");
    }
  });
