const BLITZ_SETTLEMENT_TABLE = "s1_eternum-BlitzSettlement";
const ADDRESS_NAME_TABLE = "s1_eternum-AddressName";

const buildAddressMatchCondition = (columnName: string, playerAddress: string) =>
  `ltrim(lower(CAST(${columnName} AS TEXT)), '0x') = ltrim(lower('${playerAddress}'), '0x')`;

export const buildPlayerBlitzSettlementStatusQuery = (playerAddress: string) => `
  SELECT player
  FROM "${BLITZ_SETTLEMENT_TABLE}"
  WHERE ${buildAddressMatchCondition("player", playerAddress)}
  LIMIT 1;
`;

export const buildPlayerBlitzSettlementSnapshotQuery = (playerAddress: string) => `
  SELECT player, structure_ids
  FROM "${BLITZ_SETTLEMENT_TABLE}"
  WHERE ${buildAddressMatchCondition("player", playerAddress)}
  LIMIT 1;
`;

export const buildSettledBlitzPlayersQuery = () => `
  SELECT DISTINCT player
  FROM "${BLITZ_SETTLEMENT_TABLE}";
`;

export const buildSettledBlitzPlayersWithNamesQuery = () => `
  SELECT DISTINCT settlements.player AS player, names.name AS name
  FROM "${BLITZ_SETTLEMENT_TABLE}" settlements
  LEFT JOIN "${ADDRESS_NAME_TABLE}" names
    ON settlements.player = names.address;
`;
