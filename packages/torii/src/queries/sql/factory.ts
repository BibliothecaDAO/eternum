// Factory indexer SQL queries (shared)

export const FACTORY_QUERIES = {
  WORLD_CONTRACTS_BY_PADDED_NAME: (paddedName: string) =>
    `SELECT contract_address, contract_selector, name FROM [wf-WorldContract] WHERE name = "${paddedName}" LIMIT 1000;`,

  WORLD_DEPLOYED_BY_PADDED_NAME: (paddedName: string) =>
    `SELECT * FROM [wf-WorldDeployed] WHERE name = "${paddedName}" LIMIT 1;`,
} as const;

