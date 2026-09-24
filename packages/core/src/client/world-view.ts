/** The part of a shard's schema that names what the deployed Games contract exposes. */
interface WorldViewSchema {
  domains: { season?: { contract: string; entrypoints: readonly { name: string }[] } };
}

/**
 * The one way off-chain code names a view it calls on the world address. Logic classes' entrypoints are reached only
 * through Games, so a view the Games contract does not expose would fail on a real shard while a test fixture that
 * forwards logic classes passes; this refuses it by name wherever it is called, test or shard.
 */
export const worldView = <Name extends string>(schema: WorldViewSchema, name: Name): Name => {
  const games = schema.domains.season;
  if (games?.contract !== "Games") throw new Error("Schema has no Games contract");
  if (!games.entrypoints.some((entrypoint) => entrypoint.name === name))
    throw new Error(`World view ${name} is not exposed by the Games contract`);
  return name;
};
